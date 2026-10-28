import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { positionPnlAtExpiry, type Leg } from '../../../lib/pricing';
import { useWidth } from '../../../lib/useViz';
import { Legend } from '../../ui/Stats';

export interface Series {
  label: string;
  color: string;
  legs: Leg[];
  dash?: boolean;
  /** constant added per share (e.g. interest earned on cash) */
  extra?: number;
}

const N = 241;

/** Several expiry P/L lines on one chart (per contract), with a shared hover readout. */
export default function MultiPayoff({
  series,
  lo,
  hi,
  spot,
  height = 300,
  tokens: t,
  marks = [],
  ariaLabel,
}: {
  series: Series[];
  lo: number;
  hi: number;
  spot?: number;
  height?: number;
  tokens: Record<string, string>;
  marks?: { x: number; label: string }[];
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const [hover, setHover] = useState<number | null>(null);
  const narrow = width < 520;
  const m = { top: 18, right: 14, bottom: 40, left: narrow ? 58 : 78 };
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;

  const xs = useMemo(() => Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1)), [lo, hi]);
  const vals = series.map((s) => xs.map((x) => (positionPnlAtExpiry(s.legs, x) + (s.extra ?? 0)) * 100));
  const all = vals.flat();
  const yMin = Math.min(0, ...all);
  const yMax = Math.max(0, ...all);
  const pad = (yMax - yMin) * 0.08 || 100;
  const x = scaleLinear().domain([lo, hi]).range([0, iw]);
  const y = scaleLinear().domain([yMin - pad, yMax + pad]).nice().range([ih, 0]);
  const fmtMoney = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`;
  const fmtK = (v: number) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}$${(Math.abs(v) / 1000).toLocaleString()}k`);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(hi, Math.max(lo, x.invert(e.clientX - r.left))));
  }

  return (
    <div>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(6).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={v === 0 ? t.axis : t.grid} strokeWidth={v === 0 ? 1.25 : 1} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {narrow ? fmtK(v) : fmtMoney(v)}
                </text>
              </g>
            ))}
            {x.ticks(narrow ? 4 : 8).map((v) => (
              <text key={v} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              {narrow ? 'SPY at expiration' : 'SPY at expiration (P/L per contract / 100 shares)'}
            </text>
            {spot !== undefined && (
              <g transform={`translate(${x(spot)},0)`}>
                <line y2={ih} stroke={t.muted} strokeDasharray="3 3" />
                <text y={-5} textAnchor="middle" fontSize={10} fill={t.muted}>
                  today {spot.toFixed(2)}
                </text>
              </g>
            )}
            {marks.map((mk) => (
              <g key={mk.label} transform={`translate(${x(mk.x)},0)`}>
                <line y1={ih - 14} y2={ih} stroke={t.muted} />
                <text y={ih - 18} textAnchor="middle" fontSize={10} fill={t.muted}>
                  {mk.label}
                </text>
              </g>
            ))}
            {series.map((s, i) => (
              <path
                key={s.label}
                d={line<number>().x((_, j) => x(xs[j])).y((v) => y(v))(vals[i]) ?? ''}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dash ? 1.75 : 2.5}
                strokeDasharray={s.dash ? '5 4' : undefined}
                strokeLinejoin="round"
              />
            ))}
            {hover !== null && (
              <g pointerEvents="none" transform={`translate(${x(hover)},0)`}>
                <line y2={ih} stroke={t['ink-2']} />
                {series.map((s) => (
                  <circle key={s.label} cy={y((positionPnlAtExpiry(s.legs, hover) + (s.extra ?? 0)) * 100)} r={4} fill={s.color} stroke={t.surface} strokeWidth={2} />
                ))}
              </g>
            )}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hover !== null && (
          <div className="viz-tip" style={{ left: Math.min(Math.max(m.left + x(hover) + 12, 0), width - 210), top: m.top + 4 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>SPY at {hover.toFixed(2)}</div>
            {series.map((s) => (
              <div key={s.label}>
                <span style={{ color: s.color }}>■</span> {s.label}: <b>{fmtMoney((positionPnlAtExpiry(s.legs, hover) + (s.extra ?? 0)) * 100)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color, kind: s.dash ? 'dash' : 'line' }))} />
    </div>
  );
}
