import { useMemo, useRef, useState } from 'react';
import { scaleLinear, scaleTime, line, timeFormat } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { DAYS, replay } from './stress';
import { sgn0 } from './hlib';

const ENTRIES = ['2026-02-20', '2026-02-27', '2026-03-06', '2026-03-20'];
const fmtD = timeFormat('%b %-d');
const fmtL = (d: string) => fmtD(new Date(d + 'T16:00:00'));

/** H4: replay a short 5% OTM strangle through the March 2026 drawdown. */
export default function StressReplay() {
  const t = useTokens();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const [entry, setEntry] = useState('2026-02-27');
  const [hover, setHover] = useState<number | null>(null);

  const res = useMemo(() => replay(DAYS.findIndex((d) => d.d === entry)), [entry]);
  const ctx = useMemo(() => {
    const i0 = DAYS.findIndex((d) => d.d === '2026-02-02');
    const i1 = DAYS.findIndex((d) => d.d === '2026-04-30');
    return DAYS.slice(i0, i1 + 1);
  }, []);

  const narrow = width < 520;
  const m = { top: 14, right: narrow ? 34 : 44, bottom: 24, left: 48 };
  const iw = Math.max(width - m.left - m.right, 80);
  const h1 = 170;
  const h2 = 150;
  const gap = 26;
  const x = scaleTime().domain([ctx[0].date, ctx[ctx.length - 1].date]).range([0, iw]);
  const yS = scaleLinear().domain([610, 730]).range([h1, 0]);
  const yV = scaleLinear().domain([10, 35]).range([h1, 0]);
  const pnlLo = Math.min(-1200, ...res.pts.map((p) => p.pnl));
  const pnlHi = Math.max(800, ...res.pts.map((p) => p.pnl));
  const yP = scaleLinear().domain([pnlLo, pnlHi]).nice().range([h2, 0]);

  type D = (typeof ctx)[0];
  const sPath = line<D>().x((d) => x(d.date)).y((d) => yS(d.S))(ctx) ?? '';
  const vPath = line<D>().x((d) => x(d.date)).y((d) => yV(d.vix))(ctx) ?? '';
  const pPath = line<(typeof res.pts)[0]>().x((d) => x(d.date)).y((d) => yP(d.pnl))(res.pts) ?? '';
  const hp = hover === null ? null : res.pts[hover];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = x.invert(e.clientX - r.left).getTime();
    let best = 0;
    res.pts.forEach((p, i) => {
      if (Math.abs(p.date.getTime() - dx) < Math.abs(res.pts[best].date.getTime() - dx)) best = i;
    });
    setHover(best);
  }

  const H = h1 + gap + h2;
  const xa = res.pts[0].date;
  const xb = res.pts[res.pts.length - 1].date;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Stress replay: a short strangle through the March 2026 drawdown"
        sub="Sell one four-week strangle with strikes 5% either side of SPY on the entry date, then reprice it on every close. Illustration: IVs are the snapshot smile scaled by VIX."
      />
      <Segmented label="Entry date" value={entry} onChange={setEntry} options={ENTRIES.map((d) => ({ value: d, label: `Sell ${fmtL(d)}` }))} />
      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={H + m.top + m.bottom} role="img" aria-label="SPY and VIX through March 2026, with the replayed strangle P/L below" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            <rect x={x(xa)} width={Math.max(x(xb) - x(xa), 1)} height={H} fill={t['band-2']} />
            {yS.ticks(4).map((v) => (
              <g key={`s${v}`} transform={`translate(0,${yS(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={-6} dy="0.32em" textAnchor="end" fontSize={10.5} fill={t.stock}>
                  {v}
                </text>
              </g>
            ))}
            {yV.ticks(4).map((v) => (
              <text key={`v${v}`} x={iw + 6} y={yV(v)} dy="0.32em" fontSize={10.5} fill={t.put}>
                {v}
              </text>
            ))}
            {[
              [res.Kp, 'put'],
              [res.Kc, 'call'],
            ].map(([k, lbl]) => (
              <g key={lbl}>
                <line x1={x(xa)} x2={x(xb)} y1={yS(+k)} y2={yS(+k)} stroke={t.loss} strokeDasharray="4 3" />
                <text x={x(xa) + 4} y={yS(+k) + (lbl === 'put' ? 12 : -4)} fontSize={10} fill={t.loss}>
                  short {k} {lbl}
                </text>
              </g>
            ))}
            <path d={vPath} fill="none" stroke={t.put} strokeWidth={1.75} />
            <path d={sPath} fill="none" stroke={t.stock} strokeWidth={2} />

            <g transform={`translate(0,${h1 + gap})`}>
              {yP.ticks(4).map((v) => (
                <g key={`p${v}`} transform={`translate(0,${yP(v)})`}>
                  <line x2={iw} stroke={v === 0 ? t.axis : t.grid} />
                  <text x={-6} dy="0.32em" textAnchor="end" fontSize={10.5} fill={t.muted}>
                    {v === 0 ? '$0' : `${v < 0 ? '−' : '+'}$${Math.abs(v).toLocaleString()}`}
                  </text>
                </g>
              ))}
              <path d={pPath} fill="none" stroke={t.ink} strokeWidth={2.25} />
              <circle cx={x(res.worst.date)} cy={yP(res.worst.pnl)} r={4} fill={t.loss} stroke={t.surface} strokeWidth={1.5} />
              <text x={-m.left + 2} y={-8} fontSize={10.5} fill={t['ink-2']} fontWeight={600}>
                Strangle P/L per contract
              </text>
            </g>
            {x.ticks(narrow ? 3 : 6).map((d) => (
              <text key={+d} x={x(d)} y={H + 16} textAnchor="middle" fontSize={10.5} fill={t.muted}>
                {fmtD(d)}
              </text>
            ))}
            {hp && (
              <g pointerEvents="none" transform={`translate(${x(hp.date)},0)`}>
                <line y2={H} stroke={t['ink-2']} />
                <circle cy={yS(hp.S)} r={3.5} fill={t.stock} />
                <circle cy={yV(hp.vix)} r={3.5} fill={t.put} />
                <circle cy={h1 + gap + yP(hp.pnl)} r={3.5} fill={t.ink} />
              </g>
            )}
            <rect width={iw} height={H} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hp && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(hp.date) + 12, width - 170), top: m.top + h1 + 4 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              {fmtD(hp.date)} · {hp.dte} days left
            </div>
            <div>SPY {hp.S.toFixed(2)} · VIX {hp.vix.toFixed(2)}</div>
            <div>
              Strangle P/L: <b>{sgn0(hp.pnl)}</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'SPY close (left axis)', color: t.stock },
          { label: 'VIX (right axis)', color: t.put },
          { label: 'Strangle P/L', color: t.ink },
          { label: 'Holding period', color: t['band-1'], kind: 'box' },
        ]}
      />
      <StatGrid
        cols={4}
        items={[
          ['Sold', `${res.Kp} put / ${res.Kc} call`, `SPY ${res.entry.S.toFixed(2)}, VIX ${res.entry.vix.toFixed(2)}`],
          ['Credit', sgn0(res.credit).replace('+', ''), 'per strangle (model)'],
          ['Worst mark', sgn0(res.worst.pnl), res.worst.pnl < 0 ? `${fmtD(res.worst.date)}: ${(res.worst.pnl / -res.credit).toFixed(1)}× the credit` : 'never under water'],
          ['At expiry', sgn0(res.final.pnl), `${fmtD(res.final.date)}${res.final.dte > 0 ? ` (${res.final.dte}d left)` : ''}`],
        ]}
      />
    </div>
  );
}
