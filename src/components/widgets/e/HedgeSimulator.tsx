import { useMemo, useRef, useState } from 'react';
import * as Plot from '@observablehq/plot';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { scaleLinear, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { fmt } from '../../../lib/snapshot';
import { DAYS, ENTRY, IV, K, S0, UNITS, dailyCloses, finePath, runHedge, straddle, T0, usd0 } from './hedgeSim';

const SEEDS = ['1', '2', '3', '4', '5', '6'];
const CLOUD = 120;

/**
 * E2: delta-hedge 10 long or short 770 straddles once a day along a seeded
 * random path, and watch option P/L and hedge P/L add up.
 */
export default function HedgeSimulator() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [rv, setRv] = useState(10);
  const [seed, setSeed] = useState('1');
  const [hover, setHover] = useState<number | null>(null);

  const sgn = side === 'long' ? 1 : -1;
  const path = useMemo(() => dailyCloses(finePath(+seed, rv / 100)), [seed, rv]);
  const res = useMemo(() => runHedge(path, sgn, { kind: 'every', steps: 1 }), [path, sgn]);
  const cloud = useMemo(
    () =>
      Array.from({ length: CLOUD }, (_, i) => {
        const r = runHedge(dailyCloses(finePath(i + 1, rv / 100)), sgn, { kind: 'every', steps: 1 });
        return { seed: i + 1, gap: (r.realized - IV) * 100, pnl: r.final };
      }),
    [rv, sgn],
  );
  const curve = useMemo(() => {
    const out: { gap: number; pnl: number }[] = [];
    for (let v = 3; v <= 36; v += 0.25) out.push({ gap: v - IV * 100, pnl: sgn * UNITS * (straddle(S0, T0, v / 100).price - ENTRY.price) });
    return out;
  }, [sgn]);
  const expected = sgn * UNITS * (straddle(S0, T0, res.realized).price - ENTRY.price);
  const days = Array.from({ length: DAYS + 1 }, (_, i) => i);

  const narrow = width < 520;
  const m = { top: 8, right: narrow ? 22 : 26, bottom: 26, left: narrow ? 44 : 56 };
  const pH = 120;
  const gap = 40;
  const height = m.top + 18 + pH * 3 + gap * 2 + m.bottom;
  const iw = Math.max(width - m.left - m.right, 50);
  const x = scaleLinear().domain([0, DAYS]).range([0, iw]);

  const sLo = Math.min(...path, K) - 4;
  const sHi = Math.max(...path, K) + 4;
  const yS = scaleLinear().domain([sLo, sHi]).nice(4).range([pH, 0]);
  const hMax = Math.max(...res.hedge.map(Math.abs), 100);
  const yH = scaleLinear().domain([-hMax, hMax]).nice(4).range([pH, 0]);
  const pAll = [...res.optPnl, ...res.hedgePnl, ...res.total];
  const yP = scaleLinear().domain([Math.min(...pAll, -1000), Math.max(...pAll, 1000)]).nice(4).range([pH, 0]);

  const ln = (ys: number[], y: (v: number) => number) => line<number>().x((_, i) => x(i)).y((v) => y(v))(ys) ?? '';
  const step = (ys: number[], y: (v: number) => number) => {
    let d = `M${x(0)},${y(ys[0])}`;
    for (let i = 1; i < ys.length; i++) d += `H${x(i)}V${y(ys[i])}`;
    return d;
  };

  const panel = (i: number, title: string, y: ReturnType<typeof scaleLinear<number, number>>, tickFmt: (v: number) => string, children: React.ReactNode) => (
    <g transform={`translate(0,${i * (pH + gap)})`}>
      <text x={-m.left + 2} y={-14} fontSize={10.5} fontWeight={600} fill={t['ink-2']}>
        {title}
      </text>
      {y.ticks(4).map((v) => (
        <g key={v} transform={`translate(0,${y(v)})`}>
          <line x2={iw} stroke={v === 0 && i > 0 ? t.axis : t.grid} />
          <text x={-6} dy="0.32em" textAnchor="end" fontSize={10.5} fill={t.muted}>
            {tickFmt(v)}
          </text>
        </g>
      ))}
      {children}
    </g>
  );
  const k = (v: number) => (Math.abs(v) >= 1000 ? `${v < 0 ? '−' : ''}${Math.abs(v / 1000).toFixed(Math.abs(v) % 1000 ? 1 : 0)}k` : `${v < 0 ? '−' : ''}${Math.abs(v)}`);
  const hv = hover;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(DAYS, Math.round(x.invert(e.clientX - r.left)))));
  }

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Hedge a 770 straddle every day to expiry"
        sub={`Illustration: 10 straddles priced at ${fmt.pct(IV, 2)} implied; SPY follows a random path from ${S0} at the volatility you set`}
      />
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Position</div>
          <Segmented
            label="Position"
            value={side}
            onChange={setSide}
            options={[
              { value: 'long', label: 'Long straddle' },
              { value: 'short', label: 'Short straddle' },
            ]}
          />
        </div>
        <Slider label="Volatility SPY actually delivers" value={rv} min={6} max={26} step={0.5} onChange={setRv} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <div className="mt-3">
        <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Random path</div>
        <Segmented label="Random path" value={seed} onChange={setSeed} options={SEEDS.map((s) => ({ value: s, label: narrow ? s : `Path ${s}` }))} />
      </div>

      <div ref={wrap} className="relative mt-4 w-full">
        <svg width={width} height={height} role="img" aria-label="SPY path, hedge position and cumulative P/L by day" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top + 18})`}>
            {panel(
              0,
              'SPY',
              yS,
              (v) => `${v}`,
              <>
                <line x2={iw} y1={yS(K)} y2={yS(K)} stroke={t.muted} strokeDasharray="4 3" />
                <text x={iw - 2} y={yS(K) - 4} textAnchor="end" fontSize={10} fill={t.muted}>
                  strike 770
                </text>
                <path d={ln(path, yS)} fill="none" stroke={t.stock} strokeWidth={2} />
              </>,
            )}
            {panel(
              1,
              'Hedge, shares of SPY',
              yH,
              k,
              <path d={step(res.hedge, yH)} fill="none" stroke={t.aqua} strokeWidth={2} />,
            )}
            {panel(
              2,
              'Cumulative P/L, $',
              yP,
              k,
              <>
                <path d={ln(res.optPnl, yP)} fill="none" stroke={t.call} strokeWidth={1.6} strokeDasharray="5 3" />
                <path d={ln(res.hedgePnl, yP)} fill="none" stroke={t.put} strokeWidth={1.6} strokeDasharray="2 3" />
                <path d={ln(res.total, yP)} fill="none" stroke={t.ink} strokeWidth={2.4} />
                <circle cx={x(DAYS)} cy={yP(res.final)} r={4} fill={res.final >= 0 ? t.profit : t.loss} stroke={t.surface} strokeWidth={2} />
              </>,
            )}
            {days.filter((d) => (d % (narrow ? 5 : 2) === 0 && d < DAYS - (narrow ? 1 : 3)) || d === DAYS).map((d) => (
              <text key={d} x={x(d)} y={pH * 3 + gap * 2 + 16} textAnchor={d === DAYS ? 'end' : 'middle'} fontSize={10.5} fill={t.muted}>
                {d === DAYS ? (narrow ? '22' : 'Nov 27 (22)') : d === 0 ? (narrow ? '0' : 'session 0') : d}
              </text>
            ))}
            {hv !== null && <line x1={x(hv)} x2={x(hv)} y2={pH * 3 + gap * 2} stroke={t['ink-2']} pointerEvents="none" />}
            <rect width={iw} height={pH * 3 + gap * 2} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hv !== null && (
          <div className="viz-tip" style={{ left: x(hv) + m.left > width / 2 ? m.left + x(hv) - 200 : m.left + x(hv) + 12, top: m.top + pH + gap }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>{hv === 0 ? 'Trade date' : `Session ${hv} of ${DAYS}`}</div>
            <div>
              SPY <b>{path[hv].toFixed(2)}</b>
            </div>
            <div>
              Hedge <b>{res.hedge[hv] > 0 ? '+' : ''}{res.hedge[hv]} sh</b>
            </div>
            <div>
              Options <b>{usd0(res.optPnl[hv])}</b>, hedge <b>{usd0(res.hedgePnl[hv])}</b>
            </div>
            <div>
              Total <b>{usd0(res.total[hv])}</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'SPY path', color: t.stock },
          { label: 'Hedge shares', color: t.aqua },
          { label: 'Straddle P/L', color: t.call, kind: 'dash' },
          { label: 'Stock hedge P/L', color: t.put, kind: 'dash' },
          { label: 'Total', color: t.ink },
        ]}
      />
      <StatGrid
        items={[
          ['Final P/L', usd0(res.final), `${side} 10 straddles, hedged daily`, res.final >= 0 ? t.profit : t.loss],
          ['Realized on this path', fmt.pct(res.realized), `${fmt.signed((res.realized - IV) * 100, 1)} pts vs implied`],
          ['Vol-gap estimate', usd0(expected), 'straddle valued at this path’s realized − price'],
          ['Path-by-path estimate', usd0(res.gammaEstimate), '½ Γ S² (move² − implied²), summed'],
        ]}
      />

      <div className="mt-5 text-[0.9rem] font-semibold text-(--sl-color-white)">Final P/L vs realized minus implied, {CLOUD} paths</div>
      <div className="text-[0.8rem] text-(--sl-color-gray-3)">Same position and volatility setting; each dot is one random path. The selected path is ringed.</div>
      <PlotFigure
        deps={[cloud, curve, seed]}
        minHeight={260}
        build={(w, tk) => {
          const xs = cloud.map((d) => d.gap);
          const lo = Math.min(...xs, -2) - 0.5;
          const hi = Math.max(...xs, 2) + 0.5;
          const cur = cloud[+seed - 1];
          return Plot.plot({
            width: w,
            height: 260,
            marginLeft: 56,
            marginBottom: 36,
            style: plotStyle(tk),
            x: { label: 'Realized − implied (vol points)', domain: [lo, hi] },
            y: { label: 'Final P/L, $', grid: true, tickFormat: (d: number) => (d === 0 ? '0' : `${d < 0 ? '−' : ''}${Math.abs(d / 1000)}k`) },
            marks: [
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.ruleX([0], { stroke: tk.axis }),
              Plot.line(curve.filter((d) => d.gap >= lo && d.gap <= hi), { x: 'gap', y: 'pnl', stroke: tk.muted, strokeWidth: 1.5, strokeDasharray: '5 4' }),
              Plot.dot(cloud, { x: 'gap', y: 'pnl', r: 3, fill: tk.call, fillOpacity: 0.55 }),
              Plot.dot([cur], { x: 'gap', y: 'pnl', r: 7, stroke: tk.ink, strokeWidth: 2 }),
              Plot.tip(cloud, Plot.pointer({ x: 'gap', y: 'pnl', title: (d: { seed: number; gap: number; pnl: number }) => `Path ${d.seed}\nRealized − implied: ${d.gap.toFixed(1)} pts\nFinal P/L: ${usd0(d.pnl)}` })),
            ],
          });
        }}
      />
      <Legend
        items={[
          { label: 'One path, hedged daily', color: t.call, kind: 'dot' },
          { label: 'Straddle value at the realized vol − price paid', color: t.muted, kind: 'dash' },
        ]}
      />

      <details className="mt-3 text-[0.8rem]">
        <summary className="cursor-pointer text-(--sl-color-gray-2)">Daily hedge trades ({res.trades.length})</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full tabular-nums" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="text-left text-(--sl-color-gray-3)">
                {['Session', 'SPY', 'Options delta', 'Trade', 'Hedge after', 'P/L so far'].map((h) => (
                  <th key={h} className="sticky top-0 whitespace-nowrap border-b border-(--sl-color-hairline) bg-(--viz-surface) px-2 py-1 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {res.trades.map((tr) => (
                <tr key={tr.step}>
                  <td className="px-2 py-0.5">{tr.step}</td>
                  <td className="px-2 py-0.5">{tr.S.toFixed(2)}</td>
                  <td className="px-2 py-0.5">{fmt.signed(tr.optDelta, 0)}</td>
                  <td className="whitespace-nowrap px-2 py-0.5" style={{ color: tr.traded > 0 ? t.profit : t.loss }}>
                    {tr.traded > 0 ? 'Buy' : 'Sell'} {Math.abs(tr.traded)}
                  </td>
                  <td className="px-2 py-0.5">{fmt.signed(tr.hedge, 0)}</td>
                  <td className="px-2 py-0.5">{usd0(tr.cumPnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Simplified: zero interest rate, options marked at the entry implied vol throughout, 22 sessions spread evenly over the 31 days to expiry, whole
        shares, no costs. Option P/L includes the premium paid ({fmt.usd(ENTRY.price * UNITS, 0)}) or received.
      </p>
    </div>
  );
}
