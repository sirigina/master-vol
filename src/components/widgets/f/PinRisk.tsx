import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line, area } from 'd3';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { normCdf, normPdf } from '../../../lib/pricing';

const K = 770;
const SHARES = 1000;

/**
 * Pin risk on expiration day for a 10-lot 770 conversion (long 1,000 SPY,
 * short 10 calls, long 10 puts). Illustration with model numbers.
 */
export default function PinRisk() {
  const t = useTokens();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const [spot, setSpot] = useState(770.3);
  const [mins, setMins] = useState(60);
  const [ah, setAh] = useState(0.6);
  const [vol, setVol] = useState(14);

  // SD of the close given `mins` of trading left (390-minute day, 252 days).
  const sdClose = spot * (vol / 100) * Math.sqrt(mins / 390 / 252);
  // Probability that call holders exercise, given the close c: after-hours drift until the exercise cutoff.
  const pAssign = (c: number) => normCdf((c - K) / ah);
  // Chance of ending with an unwanted position: below K you exercise puts, so assignment leaves you short;
  // above K you hold the stock and rely on assignment, so no assignment leaves you long.
  const pBad = (c: number) => (c < K ? pAssign(c) : 1 - pAssign(c));

  const lo = 764;
  const hi = 776;
  const xs = useMemo(() => Array.from({ length: 241 }, (_, i) => lo + ((hi - lo) * i) / 240), []);
  const dens = xs.map((c) => normPdf((c - spot) / sdClose) / sdClose);
  let pShort = 0;
  let pLong = 0;
  let pNear = 0;
  // Integrate over ±6 SD of the closing distribution.
  for (let c = spot - 6 * sdClose; c <= spot + 6 * sdClose; c += sdClose / 200) {
    const w = (normPdf((c - spot) / sdClose) / sdClose) * (sdClose / 200);
    if (c < K) pShort += w * pAssign(c);
    else pLong += w * (1 - pAssign(c));
    if (Math.abs(c - K) <= 0.5) pNear += w;
  }
  const weekendSd = K * (vol / 100) / Math.sqrt(252) * SHARES;

  const narrow = width < 520;
  const m = { top: 16, right: narrow ? 40 : 54, bottom: 40, left: narrow ? 40 : 52 };
  const H = 280;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = H - m.top - m.bottom;
  const x = scaleLinear().domain([lo, hi]).range([0, iw]);
  const dMax = Math.max(...dens);
  const yd = scaleLinear().domain([0, dMax * 1.1]).range([ih, 0]);
  const yp = scaleLinear().domain([0, 1]).range([ih, 0]);
  const densPath = area<number>().x((_, i) => x(xs[i])).y0(ih).y1((d) => yd(d))(dens) ?? '';
  const badPath = line<number>().x((c) => x(c)).y((c) => yp(pBad(c)))(xs) ?? '';
  const assignPath = line<number>().x((c) => x(c)).y((c) => yp(pAssign(c)))(xs) ?? '';

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Pin risk: a 770 conversion on expiration day"
        sub="Long 1,000 SPY, short 10 calls, long 10 puts. Will the calls be assigned? An illustration with model numbers."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="SPY now" value={spot} min={766} max={774} step={0.05} onChange={setSpot} format={(v) => v.toFixed(2)} />
        <Slider label="Minutes to the close" value={mins} min={5} max={390} step={5} onChange={setMins} format={(v) => `${v}`} />
        <Slider label="Volatility" value={vol} min={8} max={40} step={1} onChange={setVol} format={(v) => `${v}%`} />
        <Slider
          label="After-hours uncertainty (1 SD, $)"
          value={ah}
          min={0.1}
          max={3}
          step={0.05}
          onChange={setAh}
          format={(v) => `$${v.toFixed(2)}`}
        />
      </div>
      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={H} role="img" aria-label="Distribution of the closing price and probability of an unwanted position">
          <g transform={`translate(${m.left},${m.top})`}>
            {yp.ticks(5).map((v) => (
              <g key={v} transform={`translate(0,${yp(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={iw + 6} dy="0.32em" fontSize={11} fill={t.muted}>
                  {Math.round(v * 100)}%
                </text>
              </g>
            ))}
            {x.ticks(narrow ? 4 : 7).map((v) => (
              <text key={v} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <text x={iw / 2} y={ih + 35} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              SPY closing price
            </text>
            <path d={densPath} fill={t['band-1']} />
            <line x1={x(K)} x2={x(K)} y2={ih} stroke={t.muted} strokeDasharray="3 3" />
            <text x={x(K)} y={-4} textAnchor="middle" fontSize={10} fill={t.muted}>
              strike 770
            </text>
            <path d={assignPath} fill="none" stroke={t.call} strokeWidth={1.75} strokeDasharray="5 4" />
            <path d={badPath} fill="none" stroke={t.loss} strokeWidth={2.5} />
            <line x1={x(spot)} x2={x(spot)} y1={ih} y2={ih - 8} stroke={t.ink} strokeWidth={2} />
          </g>
        </svg>
      </div>
      <Legend
        items={[
          { label: 'Where SPY may close (density)', color: 'var(--viz-band-1)', kind: 'box' },
          { label: 'Chance the calls are assigned', color: 'var(--viz-call)', kind: 'dash' },
          { label: 'Chance of an unwanted weekend position', color: 'var(--viz-loss)' },
        ]}
      />
      <StatGrid
        items={[
          ['Close within $0.50 of 770', `${(pNear * 100).toFixed(0)}%`, `close 1 SD ±$${sdClose.toFixed(2)}`],
          ['Surprise short 1,000', `${(pShort * 100).toFixed(1)}%`, 'you exercised puts, then got assigned'],
          ['Surprise long 1,000', `${(pLong * 100).toFixed(1)}%`, 'you held stock, calls not assigned'],
          ['Exposure if it happens', `$${Math.round(K * SHARES).toLocaleString()}`, `1-day 1 SD ≈ $${Math.round(weekendSd).toLocaleString()}`, 'var(--viz-loss)'],
        ]}
      />
    </div>
  );
}
