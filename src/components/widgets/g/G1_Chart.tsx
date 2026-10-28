import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line, area } from 'd3';
import { useTokens, useWidth, type Tokens } from '../../../lib/useViz';
import { Legend } from '../../ui/Stats';

export interface Series {
  key: string;
  label: string;
  /** token name or resolved color */
  color: (t: Tokens) => string;
  dash?: string;
  width?: number;
  /** P/L per share at price s */
  f: (s: number) => number;
}

interface Props {
  series: Series[];
  lo: number;
  hi: number;
  height?: number;
  spot?: number;
  /** shade profit/loss under this series */
  washKey?: string;
  /** vertical reference lines */
  markers?: { x: number; label: string; color: (t: Tokens) => string }[];
  /** shaded x band, e.g. the ±1 SD range */
  band?: { x0: number; x1: number; label: string };
  /** dots on the zero line */
  dots?: number[];
  mult?: number;
  xLabel?: string;
  yLabel?: string;
  ariaLabel: string;
  /** fixed y domain (per contract) */
  yDomain?: [number, number];
  legend?: boolean;
}

const N = 301;
const fmtMoney = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
const fmtK = (v: number) => {
  if (v === 0) return '$0';
  const a = Math.abs(v);
  const s = a >= 1000 ? `$${(a / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k` : `$${a}`;
  return `${v < 0 ? '−' : '+'}${s}`;
};

/** Multi-series P/L chart used across module G. */
export default function GChart({
  series, lo, hi, height = 320, spot, washKey, markers = [], band, dots = [], mult = 100,
  xLabel = 'SPY price', yLabel = 'P/L per contract', ariaLabel, yDomain, legend = true,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hx, setHx] = useState<number | null>(null);
  const narrow = width < 480;
  const m = { top: 22, right: 14, bottom: 40, left: narrow ? 52 : 70 };
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = height - m.top - m.bottom;

  const xs = useMemo(() => Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1)), [lo, hi]);
  const data = series.map((sr) => xs.map((s) => sr.f(s) * mult));
  let y0 = 0;
  let y1 = 0;
  if (yDomain) [y0, y1] = yDomain;
  else {
    for (const d of data) for (const v of d) {
      if (v < y0) y0 = v;
      if (v > y1) y1 = v;
    }
    const pad = (y1 - y0) * 0.08 || 50;
    y0 -= pad;
    y1 += pad;
  }
  const x = scaleLinear().domain([lo, hi]).range([0, iw]);
  const y = scaleLinear().domain([y0, y1]).nice().range([ih, 0]).clamp(false);
  const yt = y.ticks(narrow ? 5 : 6);
  const xt = x.ticks(Math.max(3, Math.floor(iw / 80)));

  const wi = series.findIndex((s) => s.key === washKey);
  const pts = (i: number) => xs.map((s, j) => [s, data[i][j]] as [number, number]);
  const ln = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]));
  const prof = wi >= 0 ? area<[number, number]>().x((d) => x(d[0])).y0(y(0)).y1((d) => y(Math.max(d[1], 0)))(pts(wi)) ?? '' : '';
  const loss = wi >= 0 ? area<[number, number]>().x((d) => x(d[0])).y0(y(0)).y1((d) => y(Math.min(d[1], 0)))(pts(wi)) ?? '' : '';

  const hi_ = hx === null ? null : Math.round(((hx - lo) / (hi - lo)) * (N - 1));
  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHx(Math.min(hi, Math.max(lo, x.invert(e.clientX - r.left))));
  }
  const clipId = useMemo(() => `gc${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div ref={wrap} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block', touchAction: 'pan-y' }}>
        <defs>
          <clipPath id={clipId}>
            <rect width={iw} height={ih} />
          </clipPath>
        </defs>
        <g transform={`translate(${m.left},${m.top})`}>
          {band && (
            <g>
              <rect x={x(band.x0)} width={Math.max(x(band.x1) - x(band.x0), 0)} height={ih} fill={t['band-2']} />
              <text x={(x(band.x0) + x(band.x1)) / 2} y={-8} textAnchor="middle" fontSize={10} fill={t.call}>
                {band.label}
              </text>
            </g>
          )}
          {yt.map((v) => (
            <g key={`y${v}`} transform={`translate(0,${y(v)})`}>
              <line x2={iw} stroke={v === 0 ? t.axis : t.grid} strokeWidth={v === 0 ? 1.25 : 1} />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={narrow ? 10 : 11} fill={t.muted}>
                {narrow ? fmtK(v) : fmtMoney(v)}
              </text>
            </g>
          ))}
          {xt.map((v) => (
            <text key={`x${v}`} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={narrow ? 10 : 11} fill={t.muted}>
              {v}
            </text>
          ))}
          <text x={iw / 2} y={ih + 35} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
            {xLabel}
          </text>
          {!narrow && (
            <text transform={`translate(${-58},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              {yLabel}
            </text>
          )}
          <g clipPath={`url(#${clipId})`}>
            {wi >= 0 && <path d={prof} fill={t['profit-wash']} />}
            {wi >= 0 && <path d={loss} fill={t['loss-wash']} />}
            {markers.map((mk, i) => (
              <line key={i} x1={x(mk.x)} x2={x(mk.x)} y2={ih} stroke={mk.color(t)} strokeDasharray="2 3" strokeWidth={1.25} />
            ))}
            {spot !== undefined && <line x1={x(spot)} x2={x(spot)} y2={ih} stroke={t.muted} strokeDasharray="3 3" />}
            {series.map((sr, i) => (
              <path key={sr.key} d={ln(pts(i)) ?? ''} fill="none" stroke={sr.color(t)} strokeWidth={sr.width ?? 2} strokeDasharray={sr.dash} strokeLinejoin="round" />
            ))}
            {dots.map((d) => (
              <circle key={d} cx={x(d)} cy={y(0)} r={4} fill={t.surface} stroke={t.ink} strokeWidth={1.75} />
            ))}
          </g>
          {spot !== undefined && (
            <text x={x(spot)} y={-8} textAnchor="middle" fontSize={10} fill={t.muted}>
              {band ? '' : `SPY ${spot.toFixed(0)}`}
            </text>
          )}
          {markers.map((mk, i) => (
            <text key={i} x={x(mk.x)} y={ih - 6 - (i % 2) * 12} textAnchor="middle" fontSize={10} fill={mk.color(t)} stroke={t.surface} strokeWidth={3} paintOrder="stroke">
              {mk.label}
            </text>
          ))}
          {hi_ !== null && (
            <g pointerEvents="none" transform={`translate(${x(xs[hi_])},0)`}>
              <line y2={ih} stroke={t['ink-2']} />
              {series.map((sr, i) => {
                const v = data[i][hi_];
                if (v < y.domain()[0] || v > y.domain()[1]) return null;
                return <circle key={sr.key} cy={y(v)} r={3.5} fill={sr.color(t)} stroke={t.surface} strokeWidth={1.5} />;
              })}
            </g>
          )}
          <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHx(null)} />
        </g>
      </svg>
      {hi_ !== null && (
        <div className="viz-tip" style={{ left: Math.min(Math.max(m.left + x(xs[hi_]) + 12, 0), width - 190), top: m.top + 4 }}>
          <div style={{ color: 'var(--sl-color-gray-3)' }}>SPY at {xs[hi_].toFixed(2)}</div>
          {series.map((sr, i) => (
            <div key={sr.key}>
              <span style={{ color: sr.color(t) }}>●</span> {sr.label}: <b>{fmtMoney(data[i][hi_])}</b>
            </div>
          ))}
        </div>
      )}
      {legend && (
        <Legend
          items={[
            ...series.map((sr) => ({ label: sr.label, color: sr.color(t), kind: (sr.dash ? 'dash' : 'line') as 'dash' | 'line' })),
            ...(wi >= 0
              ? [
                  { label: 'Profit at expiry', color: t['profit-wash'], kind: 'box' as const },
                  { label: 'Loss at expiry', color: t['loss-wash'], kind: 'box' as const },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}
