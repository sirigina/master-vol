import { useRef, useState, type ReactNode } from 'react';
import { scaleLinear, line as d3line } from 'd3';
import { useTokens, useWidth, type Tokens } from '../../../lib/useViz';

/**
 * Module-local multi-series line chart (D3 scales + JSX) with a hover
 * crosshair and tooltip. Shared by the I and J lesson widgets.
 */
export interface Series {
  key: string;
  label: string;
  /** resolved color (token) */
  color: string;
  points: { x: number; y: number }[];
  dash?: boolean;
  width?: number;
  /** dim the series (used to highlight another one) */
  faded?: boolean;
  /** draw dots at points instead of / as well as the line */
  dots?: boolean;
  noLine?: boolean;
}

export interface Band {
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  fill: string;
}

interface Props {
  series: Series[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xFmt?: (v: number) => string;
  yFmt?: (v: number) => string;
  /** tooltip value format */
  tipFmt?: (v: number) => string;
  tipTitle?: (x: number) => string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  /** vertical reference lines */
  vlines?: { x: number; label?: string; color?: string }[];
  /** horizontal reference lines */
  hlines?: { y: number; label?: string; color?: string; dash?: boolean }[];
  bands?: Band[];
  /** zero line emphasis */
  zero?: boolean;
  ariaLabel: string;
  /** shade area between y=0 and the given series key (profit green / loss red) */
  pnlShadeKey?: string;
  extra?: (ctx: { x: (v: number) => number; y: (v: number) => number; iw: number; ih: number; t: Tokens }) => ReactNode;
  marginLeft?: number;
  /** no hover tooltip */
  noHover?: boolean;
}

export default function LineChart({
  series,
  height = 300,
  xLabel,
  yLabel,
  xFmt = (v) => String(v),
  yFmt = (v) => String(v),
  tipFmt,
  tipTitle,
  xDomain,
  yDomain,
  vlines = [],
  hlines = [],
  bands = [],
  zero = true,
  ariaLabel,
  pnlShadeKey,
  extra,
  marginLeft,
  noHover,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hx, setHx] = useState<number | null>(null);
  const narrow = width < 520;

  const m = { top: 14, right: narrow ? 12 : 20, bottom: xLabel ? 42 : 28, left: marginLeft ?? (narrow ? 50 : 62) };
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = height - m.top - m.bottom;

  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const allY = series.flatMap((s) => s.points.map((p) => p.y)).filter((v) => Number.isFinite(v));
  const xd = xDomain ?? [Math.min(...allX), Math.max(...allX)];
  let yd = yDomain;
  if (!yd) {
    const lo = Math.min(...allY, zero ? 0 : Infinity);
    const hi = Math.max(...allY, zero ? 0 : -Infinity);
    const pad = (hi - lo) * 0.08 || 1;
    yd = [lo - pad, hi + pad];
  }
  const x = scaleLinear().domain(xd).range([0, iw]);
  const y = scaleLinear().domain(yd).nice().range([ih, 0]);
  const xTicks = x.ticks(Math.max(3, Math.floor(iw / (narrow ? 70 : 90))));
  const yTicks = y.ticks(narrow ? 5 : 6);

  const path = (pts: { x: number; y: number }[]) =>
    d3line<{ x: number; y: number }>()
      .defined((d) => Number.isFinite(d.y))
      .x((d) => x(d.x))
      .y((d) => y(Math.max(Math.min(d.y, y.domain()[1]), y.domain()[0])))(pts) ?? '';

  const shade = pnlShadeKey ? series.find((s) => s.key === pnlShadeKey) : undefined;

  // hover: nearest x among the first series with a line
  const ref = series.find((s) => !s.noLine) ?? series[0];
  const nearest = (s: Series, xv: number) => {
    let best = s.points[0];
    for (const p of s.points) if (Math.abs(p.x - xv) < Math.abs(best.x - xv)) best = p;
    return best;
  };
  const hoverX = hx === null || !ref ? null : nearest(ref, hx).x;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHx(x.invert(e.clientX - r.left));
  }

  return (
    <div ref={wrap} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block', touchAction: 'pan-y' }}>
        <defs>
          <clipPath id={`clip-${ariaLabel.length}-${iw}`}>
            <rect width={iw} height={ih} />
          </clipPath>
        </defs>
        <g transform={`translate(${m.left},${m.top})`}>
          {bands.map((b, i) => (
            <rect
              key={i}
              x={b.x0 === undefined ? 0 : x(b.x0)}
              width={(b.x1 === undefined ? iw : x(b.x1)) - (b.x0 === undefined ? 0 : x(b.x0))}
              y={b.y1 === undefined ? 0 : y(b.y1)}
              height={(b.y0 === undefined ? ih : y(b.y0)) - (b.y1 === undefined ? 0 : y(b.y1))}
              fill={b.fill}
            />
          ))}
          {yTicks.map((v) => (
            <g key={`y${v}`} transform={`translate(0,${y(v)})`}>
              <line x2={iw} stroke={v === 0 && zero ? t.axis : t.grid} strokeWidth={v === 0 && zero ? 1.25 : 1} />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={narrow ? 10 : 11} fill={t.muted}>
                {yFmt(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={narrow ? 10 : 11} fill={t.muted}>
              {xFmt(v)}
            </text>
          ))}
          {xLabel && (
            <text x={iw / 2} y={ih + 36} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              {xLabel}
            </text>
          )}
          {yLabel && !narrow && (
            <text transform={`translate(${-m.left + 12},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              {yLabel}
            </text>
          )}
          <g clipPath={`url(#clip-${ariaLabel.length}-${iw})`}>
            {shade && (
              <>
                <path
                  d={`${path(shade.points.map((p) => ({ x: p.x, y: Math.max(p.y, 0) })))}L${x(shade.points[shade.points.length - 1].x)},${y(0)}L${x(shade.points[0].x)},${y(0)}Z`}
                  fill={t['profit-wash']}
                />
                <path
                  d={`${path(shade.points.map((p) => ({ x: p.x, y: Math.min(p.y, 0) })))}L${x(shade.points[shade.points.length - 1].x)},${y(0)}L${x(shade.points[0].x)},${y(0)}Z`}
                  fill={t['loss-wash']}
                />
              </>
            )}
            {hlines.map((h, i) => (
              <line key={`h${i}`} x2={iw} y1={y(h.y)} y2={y(h.y)} stroke={h.color ?? t.muted} strokeDasharray={h.dash === false ? undefined : '4 4'} />
            ))}
            {vlines.map((v, i) => (
              <line key={`v${i}`} x1={x(v.x)} x2={x(v.x)} y2={ih} stroke={v.color ?? t.muted} strokeDasharray="3 3" />
            ))}
            {[...series]
              .sort((a, b) => Number(!a.faded) - Number(!b.faded))
              .map((s) => (
                <g key={s.key} opacity={s.faded ? 0.28 : 1}>
                  {!s.noLine && (
                    <path d={path(s.points)} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash ? '6 4' : undefined} strokeLinejoin="round" />
                  )}
                  {s.dots && s.points.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r={s.noLine ? 2.6 : 4} fill={s.color} stroke={s.noLine ? 'none' : t.surface} strokeWidth={1.5} />)}
                </g>
              ))}
            {extra?.({ x, y, iw, ih, t })}
          </g>
          {vlines.map((v, i) =>
            v.label ? (
              <text key={`vl${i}`} x={x(v.x)} y={-3} textAnchor="middle" fontSize={10} fill={v.color ?? t.muted}>
                {v.label}
              </text>
            ) : null,
          )}
          {hlines.map((h, i) =>
            h.label ? (
              <text key={`hl${i}`} x={iw - 4} y={y(h.y) - 5} textAnchor="end" fontSize={10} fill={h.color ?? t.muted}>
                {h.label}
              </text>
            ) : null,
          )}
          {hoverX !== null && (
            <g pointerEvents="none" transform={`translate(${x(hoverX)},0)`}>
              <line y2={ih} stroke={t['ink-2']} />
              {series
                .filter((s) => !s.faded && !s.noLine)
                .map((s) => {
                  const p = nearest(s, hoverX);
                  return Number.isFinite(p.y) && Math.abs(p.x - hoverX) < 1e-9 + Math.abs(xd[1] - xd[0]) / 40 ? (
                    <circle key={s.key} cy={y(p.y)} r={4} fill={s.color} stroke={t.surface} strokeWidth={2} />
                  ) : null;
                })}
            </g>
          )}
          {!noHover && (
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHx(null)} />
          )}
        </g>
      </svg>
      {hoverX !== null && (
        <div className="viz-tip" style={{ left: Math.max(4, Math.min(m.left + x(hoverX) + 12, width - 210)), top: m.top + 4 }}>
          <div style={{ color: 'var(--sl-color-gray-3)' }}>{tipTitle ? tipTitle(hoverX) : xFmt(hoverX)}</div>
          {series
            .filter((s) => !s.noLine)
            .map((s) => {
              const p = nearest(s, hoverX);
              if (!Number.isFinite(p.y) || Math.abs(p.x - hoverX) > Math.abs(xd[1] - xd[0]) / 40) return null;
              return (
                <div key={s.key} style={{ opacity: s.faded ? 0.6 : 1 }}>
                  <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}: <b>{(tipFmt ?? yFmt)(p.y)}</b>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

/** Small helpers shared by I/J widgets. */
export const money0 = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
export const moneySigned = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
export const kfmt = (v: number) => (v === 0 ? '$0' : `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`);
export const kfmtSigned = (v: number) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}$${(Math.abs(v) / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`);
