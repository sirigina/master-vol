import { useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, fmt } from '../../../lib/snapshot';
import { Tile, YAxis, XAxis, fmtSigned } from './kit';

const S0 = snapshot.spot;
const K = 770;

/** Forward implied by each expiry's 770 call and put: F = K + (C − P)·e^{rT}. */
const implied = snapshot.termStructure.map((p) => {
  const T = p.dte / 365;
  return { dte: p.dte, F: K + (p.callMark - p.putMark) * Math.exp(snapshot.rate * T), expiry: p.expiry };
});

/** Forward-price calculator plus the forward curve against the forwards the option market implies. */
export default function ForwardCurve() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [rate, setRate] = useState(4.6);
  const [divy, setDivy] = useState(0);
  const [days, setDays] = useState(31);
  const [hover, setHover] = useState<number | null>(null);

  const r = rate / 100;
  const q = divy / 100;
  const fwd = (d: number) => S0 * Math.exp((r - q) * (d / 365));
  const F = fwd(days);
  const curve = Array.from({ length: 421 }, (_, d) => ({ d, F: fwd(d) }));

  const h = 280;
  const m = { top: 16, right: 16, bottom: 40, left: 50 };
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = h - m.top - m.bottom;
  const x = scaleLinear().domain([0, 420]).range([0, iw]);
  const yVals = [...curve.map((c) => c.F), ...implied.map((p) => p.F), S0];
  const y = scaleLinear().domain([Math.min(...yVals) - 4, Math.max(...yVals) + 4]).nice().range([ih, 0]);
  const path = line<{ d: number; F: number }>().x((d) => x(d.d)).y((d) => y(d.F))(curve) ?? '';
  const hp = hover === null ? null : implied[hover];

  return (
    <div className="viz-card not-content">
      <CardHead title="The forward price of SPY" sub="F = S·e^((r−q)T). Dots: the forward each expiry's 770 call and put imply through parity" />
      <div className="mb-3 grid gap-4 sm:grid-cols-3">
        <Slider label="Interest rate" value={rate} min={0} max={8} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="Dividend yield" value={divy} min={0} max={3} step={0.1} onChange={setDivy} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="Days forward" value={days} min={1} max={416} step={1} onChange={setDays} format={(v) => `${v} days`} />
      </div>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={h} role="img" aria-label="Forward price curve over time with option-implied forwards" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            <YAxis y={y} width={iw} t={t} ticks={6} />
            <XAxis x={x} height={ih} width={iw} t={t} ticks={width < 420 ? 4 : 8} label="days to delivery" />
            <line x2={iw} y1={y(S0)} y2={y(S0)} stroke={t.stock} strokeDasharray="4 4" />
            <text x={iw - 4} y={y(S0) + 14} textAnchor="end" fontSize={10.5} fill={t.stock}>
              spot {S0}
            </text>
            <path d={path} fill="none" stroke={t.call} strokeWidth={2.2} />
            <line x1={x(days)} x2={x(days)} y1={y(F)} y2={ih} stroke={t.muted} strokeDasharray="2 3" />
            <circle cx={x(days)} cy={y(F)} r={5} fill={t.call} stroke={t.surface} strokeWidth={2} />
            {implied.map((p, i) => (
              <circle
                key={p.dte}
                cx={x(p.dte)}
                cy={y(p.F)}
                r={hover === i ? 7 : 5}
                fill={t.put}
                stroke={t.surface}
                strokeWidth={1.5}
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </g>
        </svg>
        {hp && (
          <div className="viz-tip" style={{ left: Math.max(4, Math.min(m.left + x(hp.dte) + 12, width - 220)), top: m.top + 8 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              {new Date(hp.expiry + 'T16:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({hp.dte} days)
            </div>
            <div>
              Parity-implied forward: <b>{hp.F.toFixed(2)}</b>
            </div>
            <div>
              Curve at your inputs: <b>{fwd(hp.dte).toFixed(2)}</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'Forward curve at your inputs', color: t.call },
          { label: 'Forward implied by the 770 call − put', color: t.put, kind: 'dot' },
          { label: 'Spot', color: t.stock, kind: 'dash' },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label={`Forward, ${days} days`} value={F.toFixed(2)} accent={t.call} />
        <Tile label="Carry to that date" value={fmtSigned(F - S0)} sub="forward minus spot" />
        <Tile label="The ATM strike, really" value={`≈ ${F.toFixed(1)}`} sub="where call = put" />
      </div>
    </div>
  );
}
