import { useRef, useState } from 'react';
import { scaleLinear, area, line } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { volCone, tradingDaysBetween } from './volmath';

const cone = volCone();
const term = snapshot.termStructure
  .map((p) => ({ td: tradingDaysBetween(snapshot.asOf, p.expiry), iv: p.atmIv * 100, expiry: p.expiry, dte: p.dte }))
  .filter((p) => p.td <= 130);

/** Push labels apart vertically so none overlap (input in any order). */
function dodge<T extends { y: number }>(items: T[], gap: number): T[] {
  const out = [...items].sort((a, b) => a.y - b.y).map((d) => ({ ...d }));
  for (let i = 1; i < out.length; i++) if (out[i].y - out[i - 1].y < gap) out[i].y = out[i - 1].y + gap;
  const shift = (out[out.length - 1].y - items.reduce((a, d) => Math.max(a, d.y), -Infinity)) / 2;
  return out.map((d) => ({ ...d, y: d.y - Math.max(shift, 0) }));
}

/** Volatility cone from one year of SPY closes, with the snapshot's ATM implied vols overlaid. */
export default function VolCone() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [show, setShow] = useState<'both' | 'cone'>('both');
  const [hover, setHover] = useState<number | null>(null);

  const narrow = width < 520;
  const m = { top: 16, right: narrow ? 14 : 70, bottom: 38, left: 42 };
  const height = 330;
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = height - m.top - m.bottom;
  const x = scaleLinear().domain([5, 125]).range([0, iw]);
  const y = scaleLinear().domain([0, 26]).range([ih, 0]);
  type C = (typeof cone)[0];
  const band = (a: keyof C, b: keyof C) => area<C>().x((d) => x(d.w)).y0((d) => y(d[a] as number)).y1((d) => y(d[b] as number))(cone) ?? '';
  const ln = (k: keyof C) => line<C>().x((d) => x(d.w)).y((d) => y(d[k] as number))(cone) ?? '';
  const ivPath = line<(typeof term)[0]>().x((d) => x(d.td)).y((d) => y(d.iv))(term) ?? '';
  const hc = hover === null ? null : cone[hover];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const w = x.invert(e.clientX - r.left);
    let best = 0;
    cone.forEach((c, i) => {
      if (Math.abs(c.w - w) < Math.abs(cone[best].w - w)) best = i;
    });
    setHover(best);
  }

  const edge = cone[cone.length - 1];
  return (
    <div className="viz-card not-content">
      <CardHead
        title="SPY volatility cone"
        sub="For each window length: the range of every realized vol measured over the past year. Dots are today's implied vols by expiry."
        right={
          <Segmented
            label="Overlay"
            value={show}
            onChange={setShow}
            options={[
              { value: 'both', label: 'With implied' },
              { value: 'cone', label: 'Cone only' },
            ]}
          />
        }
      />
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label="Volatility cone showing minimum, quartiles, median and maximum realized volatility by window, with implied volatility overlaid" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(6).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {v}%
                </text>
              </g>
            ))}
            {cone.map((c) => (
              <text key={c.w} x={x(c.w)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {c.w}
              </text>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              Window (trading days)
            </text>
            <path d={band('min', 'max')} fill={t['band-2']} />
            <path d={band('p25', 'p75')} fill={t['band-1']} />
            <path d={ln('max')} fill="none" stroke={t.call} strokeOpacity={0.5} strokeWidth={1} />
            <path d={ln('min')} fill="none" stroke={t.call} strokeOpacity={0.5} strokeWidth={1} />
            <path d={ln('med')} fill="none" stroke={t.call} strokeWidth={2} />
            <path d={ln('cur')} fill="none" stroke={t.aqua} strokeWidth={2} strokeDasharray="5 3" />
            {cone.map((c) => (
              <circle key={c.w} cx={x(c.w)} cy={y(c.cur)} r={3.5} fill={t.aqua} stroke={t.surface} strokeWidth={1.5} />
            ))}
            {show === 'both' && (
              <g>
                <path d={ivPath} fill="none" stroke={t.put} strokeWidth={2} />
                {term.map((p) => (
                  <circle key={p.expiry} cx={x(p.td)} cy={y(p.iv)} r={4.5} fill={t.put} stroke={t.surface} strokeWidth={2} />
                ))}
              </g>
            )}
            {!narrow &&
              dodge(
                [
                  ['max', edge.max],
                  ['75th', edge.p75],
                  ['median', edge.med],
                  ['25th', edge.p25],
                  ['min', edge.min],
                ].map(([l, v]) => ({ l: l as string, v: v as number, y: y(v as number) })),
                13,
              ).map((d) => (
                <text key={d.l} x={iw + 6} y={d.y} dy="0.32em" fontSize={10.5} fill={t['ink-2']}>
                  {d.l} {d.v.toFixed(1)}
                </text>
              ))}
            {hc && <line x1={x(hc.w)} x2={x(hc.w)} y2={ih} stroke={t['ink-2']} strokeDasharray="3 3" pointerEvents="none" />}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hc && (
          <div className="viz-tip" style={{ left: Math.max(4, Math.min(m.left + x(hc.w) + 12, width - 190)), top: m.top + 4 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>{hc.w}-day windows ({hc.n})</div>
            <div>
              max <b>{hc.max.toFixed(1)}%</b> · 75th <b>{hc.p75.toFixed(1)}%</b>
            </div>
            <div>
              median <b>{hc.med.toFixed(1)}%</b>
            </div>
            <div>
              25th <b>{hc.p25.toFixed(1)}%</b> · min <b>{hc.min.toFixed(1)}%</b>
            </div>
            <div>
              now <b>{hc.cur.toFixed(1)}%</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'Min to max', color: t['band-2'], kind: 'box' },
          { label: '25th to 75th percentile', color: t['band-1'], kind: 'box' },
          { label: 'Median', color: t.call },
          { label: 'Realized now (trailing)', color: t.aqua, kind: 'dash' },
          ...(show === 'both' ? [{ label: 'ATM implied by expiry (Nov 6 to Mar 19)', color: t.put }] : []),
        ]}
      />
    </div>
  );
}
