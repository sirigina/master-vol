import { useMemo, useRef, useState } from 'react';
import { scaleLinear, area, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, callAt, T_EXPIRY, fmt } from '../../../lib/snapshot';
import { Tile, bsParts, lnPdf } from './kit';

const S0 = snapshot.spot;
const r = snapshot.rate;
const STRIKES = snapshot.chain.calls.map((c) => c.strike);

/** Risk-neutral lognormal at expiry; area above the strike equals N(d2). */
export default function ItmProbability() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [ki, setKi] = useState(STRIKES.indexOf(770));
  const K = STRIKES[ki];
  const [vol, setVol] = useState(Math.round(callAt(770)!.iv * 1000) / 10);
  const sigma = vol / 100;
  const p = bsParts({ S: S0, K, T: T_EXPIRY, r, sigma });
  const fwd = S0 * Math.exp(r * T_EXPIRY);

  const pts = useMemo(() => {
    const out: { s: number; f: number }[] = [];
    for (let s = 660; s <= 880; s += 0.5) out.push({ s, f: lnPdf(s, S0, sigma, T_EXPIRY, r) });
    return out;
  }, [sigma]);

  const h = 270;
  const m = { top: 24, right: 14, bottom: 40, left: 14 };
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = h - m.top - m.bottom;
  const x = scaleLinear().domain([680, 860]).range([0, iw]);
  const fMax = Math.max(lnPdf(S0, S0, 0.06, T_EXPIRY, 0) * 0.62, Math.max(...pts.map((d) => d.f)) * 1.05);
  const y = scaleLinear().domain([0, fMax]).range([ih, 0]);
  const vis = pts.filter((d) => d.s >= 680 && d.s <= 860);
  const all = area<{ s: number; f: number }>().x((d) => x(d.s)).y0(ih).y1((d) => y(Math.min(d.f, fMax)));
  const top = line<{ s: number; f: number }>().x((d) => x(d.s)).y((d) => y(Math.min(d.f, fMax)));

  return (
    <div className="viz-card not-content">
      <CardHead title="N(d2): the shaded area" sub="Risk-neutral distribution of SPY on November 27 (grows at the 4.6% rate). The shaded share finishes above the strike" />
      <div className="mb-3 grid gap-4 sm:grid-cols-2">
        <Slider label="Strike" value={ki} min={0} max={STRIKES.length - 1} step={1} onChange={setKi} format={(i) => `${STRIKES[i]}`} />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.1} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <div ref={wrap} className="w-full">
        <svg width={width} height={h} role="img" aria-label="Lognormal distribution with in-the-money region shaded" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {x.ticks(width < 420 ? 4 : 8).map((v) => (
              <text key={v} x={x(v)} y={ih + 17} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <line x2={iw} y1={ih} y2={ih} stroke={t.axis} />
            <text x={iw} y={ih + 34} textAnchor="end" fontSize={11} fill={t['ink-2']}>
              SPY on Nov 27
            </text>
            <path d={all(vis) ?? ''} fill={t['band-2']} />
            <path d={all(vis.filter((d) => d.s >= K)) ?? ''} fill={t.call} fillOpacity={0.45} />
            <path d={top(vis) ?? ''} fill="none" stroke={t.call} strokeWidth={1.8} />
            <line x1={x(K)} x2={x(K)} y2={ih} stroke={t.ink} strokeWidth={1.5} />
            <text x={x(K) + (x(K) > iw - 90 ? -4 : 4)} y={-8} textAnchor={x(K) > iw - 90 ? 'end' : 'start'} fontSize={11} fontWeight={600} fill={t.ink}>
              strike {K}
            </text>
            <line x1={x(fwd)} x2={x(fwd)} y1={ih * 0.12} y2={ih} stroke={t.stock} strokeDasharray="3 3" />
            <text x={x(fwd) + 4} y={ih * 0.12 + 4} fontSize={10.5} fill={t.stock} textAnchor="start">
              forward {fwd.toFixed(1)}
            </text>
            {x(K) < iw - 30 && (
              <text x={Math.min(x(K) + 10, iw - 4)} y={ih - 12} textAnchor={x(K) > iw - 70 ? 'end' : 'start'} fontSize={13} fontWeight={700} fill={t.ink}>
                {fmt.pct(p.Nd2)}
              </text>
            )}
          </g>
        </svg>
      </div>
      <Legend
        items={[
          { label: `Finishes above ${K}: N(d2) = ${p.Nd2.toFixed(3)}`, color: t.call, kind: 'box' },
          { label: 'Forward price = the mean of this distribution', color: t.stock, kind: 'dash' },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="N(d2)" value={p.Nd2.toFixed(3)} sub="chance call finishes ITM" accent={t.call} />
        <Tile label="N(d1) = delta" value={p.Nd1.toFixed(3)} sub={`always above N(d2)`} />
        <Tile label="Quoted delta" value={callAt(K)!.delta.toFixed(3)} sub={`at the ${K} call's IV ${fmt.pct(callAt(K)!.iv)}`} />
        <Tile label="Gap N(d1) − N(d2)" value={(p.Nd1 - p.Nd2).toFixed(3)} sub="grows with σ√T" />
      </div>
    </div>
  );
}
