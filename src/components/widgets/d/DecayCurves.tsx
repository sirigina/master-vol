import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { S0, IV0, VOL0, g, usd2 } from './common';

const STRIKES = [
  { K: 740, label: '740 call (ITM)', tok: 'call' as const },
  { K: 770, label: '770 call (ATM)', tok: 'put' as const },
  { K: 800, label: '800 call (OTM)', tok: 'aqua' as const },
];
const MAX_D = 31;

/** Option value vs days left for ITM/ATM/OTM strikes, SPY held at the snapshot. */
export default function DecayCurves() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [vol, setVol] = useState(VOL0);
  const [view, setView] = useState<'time' | 'value'>('time');
  const [hover, setHover] = useState<number | null>(null);
  const sigma = vol / 100;

  const series = useMemo(
    () =>
      STRIKES.map((s) => {
        const intr = Math.max(S0 - s.K, 0);
        const pts: { d: number; v: number; th: number }[] = [];
        for (let d = MAX_D; d >= 0; d -= 0.25) {
          const x = g('call', S0, s.K, d, sigma);
          pts.push({ d, v: view === 'time' ? x.price - intr : x.price, th: x.theta });
        }
        return { ...s, pts };
      }),
    [sigma, view],
  );

  const m = { top: 26, right: 16, bottom: 38, left: 50 };
  const height = 300;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;
  const x = scaleLinear().domain([MAX_D, 0]).range([0, iw]);
  const yMax = Math.max(...series.flatMap((s) => s.pts.map((p) => p.v)));
  const y = scaleLinear().domain([0, yMax * 1.05]).nice().range([ih, 0]);
  const hd = hover === null ? null : Math.round(hover * 4) / 4;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(MAX_D, Math.max(0, x.invert(e.clientX - r.left))));
  }

  return (
    <div className="viz-card not-content">
      <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_15rem] sm:items-end">
        <CardHead title="How three calls decay as expiry approaches" sub={`Model illustration: SPY held at ${S0}, no change in volatility. Hover for values.`} />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <Segmented
        label="Show"
        value={view}
        onChange={setView}
        options={[
          { value: 'time', label: 'Time value only' },
          { value: 'value', label: 'Full option value' },
        ]}
      />
      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label="Option value versus days to expiry for three strikes" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(6).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {v}
                </text>
              </g>
            ))}
            {[31, 25, 20, 15, 10, 5, 0].map((d) => (
              <text key={d} x={x(d)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {d}
              </text>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              Days to expiry
            </text>
            <text x={-m.left + 2} y={-14} fontSize={11} fill={t['ink-2']}>
              {view === 'time' ? 'Time value ($)' : 'Option value ($)'}
            </text>
            {series.map((s) => (
              <path key={s.K} d={line<(typeof s.pts)[0]>().x((p) => x(p.d)).y((p) => y(p.v))(s.pts) ?? ''} fill="none" stroke={t[s.tok]} strokeWidth={2.2} />
            ))}
            {hd !== null && (
              <g pointerEvents="none">
                <line x1={x(hd)} x2={x(hd)} y2={ih} stroke={t['ink-2']} />
                {series.map((s) => {
                  const p = s.pts.find((q) => q.d === hd)!;
                  return <circle key={s.K} cx={x(hd)} cy={y(p.v)} r={4} fill={t[s.tok]} stroke={t.surface} strokeWidth={2} />;
                })}
              </g>
            )}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hd !== null && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(hd) + 12, width - 210), top: m.top + 4 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>{hd} days left</div>
            {series.map((s) => {
              const p = s.pts.find((q) => q.d === hd)!;
              return (
                <div key={s.K}>
                  {s.K}: <b>{usd2(p.v)}</b> · theta {p.th.toFixed(3)}/day
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Legend items={STRIKES.map((s) => ({ label: s.label, color: t[s.tok] }))} />
    </div>
  );
}
