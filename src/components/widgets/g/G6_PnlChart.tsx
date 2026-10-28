import { useRef, useState, type ReactNode } from 'react';
import { scaleLinear, line, area } from 'd3';
import { useTokens, useWidth } from '../../../lib/useViz';
import { Legend } from '../../ui/Stats';

export interface Series {
  label: string;
  color: string;
  values: number[];
  dash?: boolean;
  width?: number;
  /** shade profit/loss under this series */
  wash?: boolean;
  opacity?: number;
}

interface Props {
  xs: number[];
  series: Series[];
  height?: number;
  xLabel: string;
  yLabel?: string;
  markers?: { x: number; label: string }[];
  dots?: { x: number; y: number; color: string }[];
  ariaLabel: string;
  tipTitle?: (x: number) => ReactNode;
  /** format for y axis/tooltip */
  money?: boolean;
}

const fmtMoney = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`;

/** Multi-series P/L chart for module G (part 2): hover shows every series at that price. */
export default function PnlChart({ xs, series, height = 300, xLabel, yLabel = 'P/L per contract', markers = [], dots = [], ariaLabel, tipTitle, money = true }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hi, setHi] = useState<number | null>(null);
  const narrow = width < 520;
  const m = { top: 18, right: 12, bottom: 38, left: narrow ? 52 : 70 };
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;

  const all = series.flatMap((s) => s.values).concat([0]);
  let y0 = Math.min(...all);
  let y1 = Math.max(...all);
  const pad = (y1 - y0) * 0.08 || 50;
  y0 -= pad;
  y1 += pad;
  const x = scaleLinear().domain([xs[0], xs[xs.length - 1]]).range([0, iw]);
  const y = scaleLinear().domain([y0, y1]).nice().range([ih, 0]);
  const idx = xs.map((_, i) => i);
  const fmtY = money ? fmtMoney : (v: number) => v.toFixed(2);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const v = x.invert(e.clientX - r.left);
    let best = 0;
    xs.forEach((s, i) => {
      if (Math.abs(s - v) < Math.abs(xs[best] - v)) best = i;
    });
    setHi(best);
  }

  return (
    <div ref={wrap} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block', touchAction: 'pan-y' }}>
        <g transform={`translate(${m.left},${m.top})`}>
          {y.ticks(narrow ? 5 : 6).map((v) => (
            <g key={`y${v}`} transform={`translate(0,${y(v)})`}>
              <line x2={iw} stroke={v === 0 ? t.axis : t.grid} strokeWidth={v === 0 ? 1.25 : 1} />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={narrow ? 10 : 11} fill={t.muted}>
                {fmtY(v)}
              </text>
            </g>
          ))}
          {x.ticks(Math.max(3, Math.floor(iw / 80))).map((v) => (
            <text key={`x${v}`} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={narrow ? 10 : 11} fill={t.muted}>
              {v}
            </text>
          ))}
          <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
            {xLabel}
          </text>
          {!narrow && (
            <text transform={`translate(${-58},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              {yLabel}
            </text>
          )}
          {series
            .filter((s) => s.wash)
            .map((s) => (
              <g key={`w${s.label}`}>
                <path d={area<number>().x((i) => x(xs[i])).y0(y(0)).y1((i) => y(Math.max(s.values[i], 0)))(idx) ?? ''} fill={t['profit-wash']} />
                <path d={area<number>().x((i) => x(xs[i])).y0(y(0)).y1((i) => y(Math.min(s.values[i], 0)))(idx) ?? ''} fill={t['loss-wash']} />
              </g>
            ))}
          {markers.map((mk, i) => (
            <g key={`m${i}`} transform={`translate(${x(mk.x)},0)`}>
              <line y2={ih} stroke={t.muted} strokeDasharray="3 3" />
              <text y={-5} textAnchor="middle" fontSize={10} fill={t.muted}>
                {mk.label}
              </text>
            </g>
          ))}
          {series.map((s) => (
            <path
              key={s.label}
              d={line<number>().x((i) => x(xs[i])).y((i) => y(s.values[i]))(idx) ?? ''}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2}
              strokeDasharray={s.dash ? '5 4' : undefined}
              strokeLinejoin="round"
              opacity={s.opacity ?? 1}
            />
          ))}
          {dots.map((d, i) => (
            <circle key={`d${i}`} cx={x(d.x)} cy={y(d.y)} r={4.5} fill={d.color} stroke={t.surface} strokeWidth={2} />
          ))}
          {hi !== null && (
            <g transform={`translate(${x(xs[hi])},0)`} pointerEvents="none">
              <line y2={ih} stroke={t['ink-2']} />
              {series.map((s) => (
                <circle key={s.label} cy={y(s.values[hi])} r={3.5} fill={s.color} stroke={t.surface} strokeWidth={1.5} />
              ))}
            </g>
          )}
          <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHi(null)} />
        </g>
      </svg>
      {hi !== null && (
        <div className="viz-tip" style={{ left: Math.min(Math.max(m.left + x(xs[hi]) + 12, 0), width - 190), top: m.top + 4 }}>
          <div style={{ color: 'var(--sl-color-gray-3)' }}>{tipTitle ? tipTitle(xs[hi]) : `SPY ${xs[hi].toFixed(0)}`}</div>
          {series.map((s) => (
            <div key={s.label}>
              {s.label}: <b>{fmtY(s.values[hi])}</b>
            </div>
          ))}
        </div>
      )}
      <Legend items={series.map((s) => ({ label: s.label, color: s.color, kind: s.dash ? 'dash' : 'line' }))} />
    </div>
  );
}
