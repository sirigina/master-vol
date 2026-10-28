import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { DAYS, IV, K, SPD, STEPS, finePath, runHedge, usd0 } from './hedgeSim';
import { RULES } from './rules';

const SEEDS = ['1', '2', '3', '4', '5', '6'];

/** E3: one half-hourly path, and when each hedging rule trades on it. */
export default function HedgeRuleTimeline() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [seed, setSeed] = useState('2');
  const [hover, setHover] = useState<number | null>(null);
  const path = useMemo(() => finePath(+seed, IV), [seed]);
  const runs = useMemo(() => RULES.map((r) => ({ ...r, res: runHedge(path, 1, r.rule) })), [path]);

  const narrow = width < 520;
  const m = { top: 10, right: 10, bottom: 24, left: narrow ? 10 : 108 };
  const pH = 170;
  const lane = narrow ? 48 : 34;
  const mid = narrow ? 32 : lane / 2;
  const hMax = narrow ? 10 : lane / 2 - 4;
  const height = m.top + pH + 18 + lane * RULES.length + m.bottom;
  const iw = Math.max(width - m.left - m.right, 50);
  const x = scaleLinear().domain([0, STEPS]).range([0, iw]);
  const y = scaleLinear()
    .domain([Math.min(...path, K) - 2, Math.max(...path, K) + 2])
    .nice(5)
    .range([pH, 0]);
  const maxTr = Math.max(...runs.flatMap((r) => r.res.trades.slice(1).map((tr) => Math.abs(tr.traded))), 1);
  const colors = [t.stock, t.call, t.aqua, t.put];
  const pathD = line<number>().x((_, i) => x(i)).y((v) => y(v))(path) ?? '';

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(STEPS, Math.round(x.invert(e.clientX - r.left)))));
  }
  const hvDay = hover === null ? 0 : Math.floor(hover / SPD);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="When each rule trades"
        sub="Illustration: one half-hourly SPY path at the implied volatility; each tick is a hedge trade, its height the number of shares"
      />
      <Segmented label="Random path" value={seed} onChange={setSeed} options={SEEDS.map((s) => ({ value: s, label: narrow ? s : `Path ${s}` }))} />
      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label="SPY path with the hedge trades of four rules underneath" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(5).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={narrow ? 2 : -6} dy={narrow ? '-0.3em' : '0.32em'} textAnchor={narrow ? 'start' : 'end'} fontSize={10.5} fill={t.muted}>
                  {v}
                </text>
              </g>
            ))}
            {Array.from({ length: DAYS + 1 }, (_, d) => d)
              .filter((d) => d % 5 === 0)
              .map((d) => (
                <line key={d} x1={x(d * SPD)} x2={x(d * SPD)} y2={pH + 18 + lane * RULES.length} stroke={t.grid} strokeDasharray="2 3" />
              ))}
            <line x2={iw} y1={y(K)} y2={y(K)} stroke={t.muted} strokeDasharray="4 3" />
            <path d={pathD} fill="none" stroke={t.ink} strokeWidth={1.4} />
            {runs.map((r, ri) => {
              const top = pH + 18 + ri * lane;
              return (
                <g key={r.id} transform={`translate(0,${top})`}>
                  <line x2={iw} y1={mid} y2={mid} stroke={t.grid} />
                  {narrow ? (
                    <text x={2} y={9} fontSize={10} fontWeight={600} fill={colors[ri]}>
                      {r.short} · {r.res.trades.length - 1} rehedges
                    </text>
                  ) : (
                    <text x={-8} y={lane / 2 - 4} textAnchor="end" fontSize={11} fontWeight={600} fill={colors[ri]}>
                      {r.short}
                    </text>
                  )}
                  {!narrow && (
                    <text x={-8} y={lane / 2 + 9} textAnchor="end" fontSize={10} fill={t.muted}>
                      {r.res.trades.length - 1} rehedges
                    </text>
                  )}
                  {r.res.trades.slice(1).map((tr) => {
                    const h = 3 + (hMax * Math.abs(tr.traded)) / maxTr;
                    return <line key={tr.step} x1={x(tr.step)} x2={x(tr.step)} y1={mid} y2={mid + (tr.traded > 0 ? -h : h)} stroke={colors[ri]} strokeWidth={1.6} />;
                  })}
                </g>
              );
            })}
            {Array.from({ length: DAYS + 1 }, (_, d) => d)
              .filter((d) => (d % 5 === 0 && d < 20) || d === DAYS)
              .map((d) => (
                <text key={d} x={x(d * SPD)} y={height - m.top - 6} textAnchor={d === 0 ? 'start' : d === DAYS ? 'end' : 'middle'} fontSize={10.5} fill={t.muted}>
                  {d === DAYS ? 'expiry' : narrow && d > 0 ? d : `day ${d}`}
                </text>
              ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y2={pH + 18 + lane * RULES.length} stroke={t['ink-2']} pointerEvents="none" />}
            <rect width={iw} height={pH + 18 + lane * RULES.length} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hover !== null && (
          <div className="viz-tip" style={{ left: m.left + x(hover) > width / 2 ? m.left + x(hover) - 210 : m.left + x(hover) + 12, top: 8 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              Day {hvDay}, half-hour {(hover % SPD) + 1} of {SPD}
            </div>
            <div>
              SPY <b>{path[hover].toFixed(2)}</b>
            </div>
            {runs.map((r, ri) => (
              <div key={r.id}>
                <span style={{ color: colors[ri] }}>{r.short}</span>: hedge <b>{r.res.hedge[hover]}</b> sh, P/L <b>{usd0(r.res.total[hover])}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <Legend items={runs.map((r, ri) => ({ label: `${r.short}: ${usd0(r.res.final)} final, ${Math.round(r.res.sharesTraded).toLocaleString('en-US')} sh traded`, color: colors[ri], kind: 'box' as const }))} />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Ticks above the line are purchases, below are sales. No costs in this view. Hover to compare each rule’s hedge and running P/L.
      </p>
    </div>
  );
}
