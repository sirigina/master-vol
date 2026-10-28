import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { useTokens, useWidth, type Tokens } from '../../../lib/useViz';

export interface Series {
  label: string;
  /** token name for the stroke */
  color: keyof Tokens;
  fn: (x: number) => number;
  dash?: boolean;
  width?: number;
}

interface Props {
  series: Series[];
  lo: number;
  hi: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  /** vertical marker lines */
  marks?: { x: number; label: string }[];
  yFormat?: (v: number) => string;
  tipFormat?: (v: number) => string;
  /** force y domain to include these values */
  yInclude?: number[];
  ariaLabel: string;
}

const N = 201;

/** Small multi-line chart with hover readout, shared by the module F figures. */
export default function LinesChart({
  series, lo, hi, height = 300, xLabel = 'SPY price at expiration', yLabel = 'Profit / loss per share', marks = [],
  yFormat, tipFormat, yInclude = [0], ariaLabel,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hx, setHx] = useState<number | null>(null);
  const narrow = width < 520;
  const m = { top: 18, right: 14, bottom: 40, left: narrow ? 52 : 66 };
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;

  const xs = useMemo(() => Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1)), [lo, hi]);
  const data = series.map((s) => xs.map((x) => ({ x, y: s.fn(x) })));
  const ys = [...data.flat().map((d) => d.y), ...yInclude];
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (y1 - y0 < 1e-6) {
    y0 -= 1;
    y1 += 1;
  }
  const pad = (y1 - y0) * 0.08;
  const x = scaleLinear().domain([lo, hi]).range([0, iw]);
  const y = scaleLinear().domain([y0 - pad, y1 + pad]).nice().range([ih, 0]);
  const fy = yFormat ?? ((v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
  const ft = tipFormat ?? ((v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(v).toFixed(2)}`);

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHx(Math.min(hi, Math.max(lo, x.invert(e.clientX - r.left))));
  }

  return (
    <div ref={wrap} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block', touchAction: 'pan-y' }}>
        <g transform={`translate(${m.left},${m.top})`}>
          {y.ticks(6).map((v) => (
            <g key={`y${v}`} transform={`translate(0,${y(v)})`}>
              <line x2={iw} stroke={v === 0 ? t.axis : t.grid} strokeWidth={v === 0 ? 1.25 : 1} />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                {fy(v)}
              </text>
            </g>
          ))}
          {x.ticks(Math.max(3, Math.floor(iw / 80))).map((v) => (
            <text key={`x${v}`} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
              {v}
            </text>
          ))}
          <text x={iw / 2} y={ih + 35} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
            {xLabel}
          </text>
          {!narrow && (
            <text transform={`translate(${-54},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              {yLabel}
            </text>
          )}
          {marks.map((mk) => (
            <g key={mk.label} transform={`translate(${x(mk.x)},0)`}>
              <line y2={ih} stroke={t.muted} strokeDasharray="3 3" />
              <text y={-5} textAnchor="middle" fontSize={10} fill={t.muted}>
                {mk.label}
              </text>
            </g>
          ))}
          {data.map((d, i) => (
            <path
              key={series[i].label}
              d={line<{ x: number; y: number }>().x((p) => x(p.x)).y((p) => y(p.y))(d) ?? ''}
              fill="none"
              stroke={t[series[i].color]}
              strokeWidth={series[i].width ?? 2}
              strokeDasharray={series[i].dash ? '6 4' : undefined}
              strokeLinejoin="round"
            />
          ))}
          {hx !== null && (
            <g pointerEvents="none" transform={`translate(${x(hx)},0)`}>
              <line y2={ih} stroke={t['ink-2']} />
              {series.map((s) => (
                <circle key={s.label} cy={y(s.fn(hx))} r={3.5} fill={t[s.color]} stroke={t.surface} strokeWidth={1.5} />
              ))}
            </g>
          )}
          <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHx(null)} />
        </g>
      </svg>
      {hx !== null && (
        <div className="viz-tip" style={{ left: Math.min(m.left + x(hx) + 12, width - 210), top: m.top + 4 }}>
          <div style={{ color: 'var(--sl-color-gray-3)' }}>SPY at {hx.toFixed(2)}</div>
          {series.map((s) => (
            <div key={s.label}>
              {s.label}: <b>{ft(s.fn(hx))}</b>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.78rem] text-(--sl-color-gray-3)">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" stroke={t[s.color]} strokeWidth="2" strokeDasharray={s.dash ? '5 4' : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
