import { useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { normCdf, normPdf } from '../../../lib/pricing';
import { lognormalPdf } from '../../../lib/position';
import { snapshot, fmt } from '../../../lib/snapshot';

const HORIZONS = [
  { d: 7, label: '1 week' },
  { d: 31, label: '31 days (Nov 27)' },
  { d: 91, label: '3 months' },
  { d: 182, label: '6 months' },
  { d: 365, label: '1 year' },
  { d: 730, label: '2 years' },
  { d: 1095, label: '3 years' },
  { d: 1825, label: '5 years' },
];
const S0 = snapshot.spot;

/**
 * Normal vs lognormal model of SPY's future price with the same volatility.
 * Zero drift in price terms (mean = today's price) so only the shape differs.
 */
export default function LognormalCompare() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [vol, setVol] = useState(14);
  const [hi, setHi] = useState(1);
  const [space, setSpace] = useState<'price' | 'log'>('price');

  const sigma = vol / 100;
  const T = HORIZONS[hi].d / 365;
  const s = sigma * Math.sqrt(T);
  const sdN = S0 * s; // normal model SD in dollars
  const median = S0 * Math.exp(-0.5 * s * s);
  const mode = S0 * Math.exp(-1.5 * s * s);
  const pNeg = normCdf(-1 / s);
  const pBelow = normCdf(0.5 * s);

  const narrow = width < 520;
  const m = { top: 16, right: 14, bottom: 40, left: 14 };
  const height = 300;
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = height - m.top - m.bottom;

  let xs: number[];
  let fL: (x: number) => number;
  let fN: (x: number) => number;
  let x: ReturnType<typeof scaleLinear<number, number>>;
  let marks: { v: number; label: string; color: string }[];
  let tickFmt: (v: number) => string;

  if (space === 'price') {
    const lo = Math.min(S0 - 3.6 * sdN, median * Math.exp(-3.6 * s));
    const hiX = Math.max(S0 + 3.6 * sdN, median * Math.exp(3.6 * s));
    const xlo = Math.max(lo, -0.6 * S0);
    const xhi = Math.min(hiX, S0 * 6);
    x = scaleLinear().domain([xlo, xhi]).range([0, iw]);
    xs = Array.from({ length: 400 }, (_, i) => xlo + ((xhi - xlo) * i) / 399);
    fL = (v) => lognormalPdf(v, S0, sigma, T);
    fN = (v) => normPdf((v - S0) / sdN) / sdN;
    marks = [
      { v: S0, label: `mean ${S0.toFixed(0)}`, color: t.ink },
      { v: median, label: `median ${median.toFixed(0)}`, color: t.call },
      { v: mode, label: `mode ${mode.toFixed(0)}`, color: t.muted },
    ];
    tickFmt = (v) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(0)}`;
  } else {
    // y = ln(S_T / S0). Lognormal → normal in y. Normal-in-price → skewed in y (and undefined below 0).
    const mu = -0.5 * s * s;
    const ylo = mu - 4 * s;
    const yhi = mu + 4 * s;
    x = scaleLinear().domain([ylo, yhi]).range([0, iw]);
    xs = Array.from({ length: 400 }, (_, i) => ylo + ((yhi - ylo) * i) / 399);
    fL = (y) => normPdf((y - mu) / s) / s;
    fN = (y) => {
      const S = S0 * Math.exp(y);
      return (normPdf((S - S0) / sdN) / sdN) * S;
    };
    marks = [
      { v: 0, label: 'no change', color: t.ink },
      { v: mu, label: `center ${(mu * 100).toFixed(1)}%`, color: t.call },
    ];
    tickFmt = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(0)}%`;
  }

  const peak = Math.max(...xs.map(fL), ...xs.map(fN));
  const y = scaleLinear().domain([0, peak * 1.12]).range([ih, 0]);
  const mk = (f: (v: number) => number) => line<number>().x((v) => x(v)).y((v) => y(f(v)))(xs) ?? '';
  const negZone = space === 'price' && x.domain()[0] < 0;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Two models of SPY's future price, same volatility"
        sub="Normal model: dollar moves are bell-shaped. Lognormal model: percentage (log) moves are bell-shaped. Both start at SPY 769.66 with the mean held at today's price."
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Slider label="Volatility" value={vol} min={5} max={60} step={1} onChange={setVol} format={(v) => `${v}%`} />
        <Slider label="Horizon" value={hi} min={0} max={HORIZONS.length - 1} step={1} onChange={setHi} format={(v) => HORIZONS[v].label} />
        <Segmented
          label="Axis"
          value={space}
          onChange={setSpace}
          options={[
            { value: 'price', label: 'Price' },
            { value: 'log', label: 'Log return' },
          ]}
        />
      </div>

      <div ref={wrap} className="mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label="Normal and lognormal distributions of SPY's future price" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {negZone && (
              <>
                <rect x={0} width={x(0)} height={ih} fill={t['loss-wash']} />
                {x(0) > 90 && (
                  <text x={x(0) - 4} y={ih - 8} textAnchor="end" fontSize={10.5} fill={t.loss}>
                    negative prices
                  </text>
                )}
              </>
            )}
            <line x2={iw} y1={ih} y2={ih} stroke={t.axis} />
            {x.ticks(narrow ? 4 : 7).map((v) => (
              <g key={v} transform={`translate(${x(v)},${ih})`}>
                <line y2={4} stroke={t.axis} />
                <text y={17} textAnchor="middle" fontSize={11} fill={t.muted}>
                  {tickFmt(v)}
                </text>
              </g>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              {space === 'price' ? `SPY price in ${HORIZONS[hi].label}` : `Log return ln(S/S₀) over ${HORIZONS[hi].label}`}
            </text>
            <path d={mk(fN)} fill="none" stroke={t.put} strokeWidth={2} strokeDasharray="6 4" />
            <path d={mk(fL)} fill="none" stroke={t.call} strokeWidth={2.4} />
            {marks.map((mk2, i) => (
              <g key={mk2.label} transform={`translate(${x(mk2.v)},0)`}>
                <line y1={ih} y2={14 + i * 15} stroke={mk2.color} strokeDasharray={i === 0 ? undefined : '3 3'} />
                <text
                  y={10 + i * 15}
                  x={(i === 2 || (space === 'log' && i === 1)) && x(mk2.v) > 60 ? -4 : 4}
                  textAnchor={(i === 2 || (space === 'log' && i === 1)) && x(mk2.v) > 60 ? 'end' : 'start'}
                  fontSize={10.5}
                  fill={mk2.color}
                  stroke={t.surface}
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {mk2.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <Legend
        items={[
          { label: 'Lognormal (the standard option model)', color: t.call },
          { label: 'Normal in price', color: t.put, kind: 'dash' },
          ...(negZone ? [{ label: 'Negative prices (impossible)', color: t['loss-wash'], kind: 'box' as const }] : []),
        ]}
      />
      <StatGrid
        items={[
          ['σ√t (one SD of log return)', `${(s * 100).toFixed(1)}%`],
          ['Lognormal median', fmt.usd(median), `${((median / S0 - 1) * 100).toFixed(1)}% vs today`],
          ['Lognormal: chance below today', `${(pBelow * 100).toFixed(1)}%`, 'mean is today, yet more than half end lower'],
          ['Normal model: chance below $0', pNeg < 1e-6 ? '≈ 0%' : `${(pNeg * 100).toFixed(pNeg < 0.01 ? 2 : 1)}%`, 'impossible for a real stock'],
        ]}
      />
    </div>
  );
}
