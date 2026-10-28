import { useMemo, useRef, useState } from 'react';
import { scaleLinear, scaleSequentialSqrt, interpolateRgb } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { S0, IV0, VOL0, K0, g } from './common';

type Greek = 'delta' | 'gamma' | 'theta' | 'vega';
const S_LO = 700;
const S_HI = 840;
const S_STEP = 2;
const D_LO = 1;
const D_HI = 60;
const LABEL: Record<Greek, string> = {
  delta: 'Delta',
  gamma: 'Gamma',
  theta: 'Theta ($/day, per share)',
  vega: 'Vega ($ per vol pt, per share)',
};

/** Heatmap of a 770-call Greek over SPY price × days to expiry. */
export default function GreekHeatmap() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [greek, setGreek] = useState<Greek>('gamma');
  const [vol, setVol] = useState(VOL0);
  const [hover, setHover] = useState<{ S: number; d: number } | null>(null);
  const sigma = vol / 100;

  const cells = useMemo(() => {
    const out: { S: number; d: number; v: number }[] = [];
    for (let d = D_LO; d <= D_HI; d++)
      for (let S = S_LO; S <= S_HI; S += S_STEP) {
        const x = g('call', S, K0, d, sigma);
        out.push({ S, d, v: greek === 'theta' ? -x.theta : x[greek] });
      }
    return out;
  }, [greek, sigma]);
  const vMax = Math.max(...cells.map((c) => c.v));

  const m = { top: 10, right: 12, bottom: 40, left: 46 };
  const height = width < 520 ? 300 : 340;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;
  const x = scaleLinear().domain([S_LO - S_STEP / 2, S_HI + S_STEP / 2]).range([0, iw]);
  const y = scaleLinear().domain([D_HI + 0.5, D_LO - 0.5]).range([0, ih]);
  const color = scaleSequentialSqrt(interpolateRgb(t.surface, greek === 'theta' ? t.put : greek === 'vega' ? t.aqua : t.call)).domain([0, vMax]);
  const cw = x(S_STEP) - x(0) + 0.6;
  const ch = Math.abs(y(1) - y(0)) + 0.6;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const S = Math.round(x.invert(e.clientX - r.left) / S_STEP) * S_STEP;
    const d = Math.round(y.invert(e.clientY - r.top));
    setHover({ S: Math.min(S_HI, Math.max(S_LO, S)), d: Math.min(D_HI, Math.max(D_LO, d)) });
  }
  const hv = hover ? g('call', hover.S, K0, hover.d, sigma) : null;
  const fmtV = (v: number) => (greek === 'gamma' ? v.toFixed(4) : greek === 'delta' ? v.toFixed(3) : v.toFixed(3));

  return (
    <div className="viz-card not-content">
      <CardHead title="A Greek of the 770 call over price and time" sub="Model illustration, rate 4.6%. Darker = larger (square-root color scale; theta shown as decay per day). Hover or tap for values." />
      <div className="mb-3 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <Segmented
          label="Greek"
          value={greek}
          onChange={setGreek}
          options={[
            { value: 'delta', label: 'Delta' },
            { value: 'gamma', label: 'Gamma' },
            { value: 'theta', label: 'Theta' },
            { value: 'vega', label: 'Vega' },
          ]}
        />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label={`Heatmap of ${greek} over SPY price and days to expiry`} style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {cells.map((c) => (
              <rect key={`${c.S}-${c.d}`} x={x(c.S - S_STEP / 2)} y={y(c.d + 0.5)} width={cw} height={ch} fill={color(c.v)} />
            ))}
            <line x1={x(K0)} x2={x(K0)} y2={ih} stroke={t['ink-2']} strokeDasharray="3 3" />
            <circle cx={x(S0)} cy={y(31)} r={4.5} fill="none" stroke={t.ink} strokeWidth={2} />
            {[700, 720, 740, 760, 780, 800, 820, 840].filter((v, i) => width >= 520 || i % 2 === 0).map((v) => (
              <text key={v} x={x(v)} y={ih + 16} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <text x={iw / 2} y={ih + 33} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              SPY price
            </text>
            {[1, 10, 20, 31, 40, 50, 60].map((d) => (
              <text key={d} x={-6} y={y(d)} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                {d}
              </text>
            ))}
            <text transform={`translate(${-34},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              Days to expiry
            </text>
            {hover && <rect x={x(hover.S - S_STEP / 2)} y={y(hover.d + 0.5)} width={cw} height={ch} fill="none" stroke={t.ink} strokeWidth={1.5} pointerEvents="none" />}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hover && hv && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(hover.S) + 14, width - 190), top: Math.max(4, m.top + y(hover.d) - 70) }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              SPY {hover.S}, {hover.d} days left
            </div>
            <div>
              Delta <b>{hv.delta.toFixed(3)}</b> · Gamma <b>{hv.gamma.toFixed(4)}</b>
            </div>
            <div>
              Theta <b>{hv.theta.toFixed(3)}</b> · Vega <b>{hv.vega.toFixed(3)}</b>
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.78rem] text-(--sl-color-gray-3)">
        <span className="inline-flex items-center gap-2">
          {LABEL[greek]}: 0
          <svg width="110" height="10" aria-hidden="true">
            <defs>
              <linearGradient id={`hm-${greek}`}>
                <stop offset="0%" stopColor={color(0)} />
                <stop offset="50%" stopColor={color(vMax / 2)} />
                <stop offset="100%" stopColor={color(vMax)} />
              </linearGradient>
            </defs>
            <rect width="110" height="10" rx="2" fill={`url(#hm-${greek})`} stroke={t.grid} />
          </svg>
          {fmtV(vMax)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke={t.ink} strokeWidth="2" />
          </svg>
          Snapshot (SPY {S0}, 31 days)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="22" y2="4" stroke={t['ink-2']} strokeWidth="1.5" strokeDasharray="3 3" />
          </svg>
          Strike 770
        </span>
      </div>
    </div>
  );
}
