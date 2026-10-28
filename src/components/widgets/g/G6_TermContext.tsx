import { useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';

const TS = snapshot.termStructure.filter((p) => p.dte <= 233);

/** Forward volatility between two expiries from total variance. */
export function forwardVol(s1: number, d1: number, s2: number, d2: number): number {
  return Math.sqrt((s2 * s2 * d2 - s1 * s1 * d1) / (d2 - d1));
}

const FWD = TS.slice(1).map((p, i) => ({ d0: TS[i].dte, d1: p.dte, v: forwardVol(TS[i].atmIv, TS[i].dte, p.atmIv, p.dte) }));

/** ATM term structure with the forward vol between consecutive expiries. */
export default function TermContext() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hi, setHi] = useState<number | null>(null);
  const narrow = width < 520;
  const m = { top: 22, right: 14, bottom: 40, left: narrow ? 42 : 52 };
  const height = 300;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;
  const x = scaleLinear().domain([0, 240]).range([0, iw]);
  const vals = [...TS.map((p) => p.atmIv), ...FWD.map((f) => f.v)];
  const y = scaleLinear().domain([Math.min(...vals) - 0.005, Math.max(...vals) + 0.005]).nice().range([ih, 0]);
  const spot = line<(typeof TS)[0]>().x((p) => x(p.dte)).y((p) => y(p.atmIv))(TS) ?? '';
  const nov = TS.find((p) => p.dte === 31)!;
  const dec = TS.find((p) => p.dte === 52)!;
  const fwd = forwardVol(nov.atmIv, 31, dec.atmIv, 52);
  const fmtP = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="viz-card not-content">
      <CardHead title="SPY term structure and forward volatility" sub="At-the-money IV by expiry (dots) and the volatility implied for each gap between expiries (steps)" />
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label="At-the-money implied volatility by days to expiry with forward volatility steps" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(5).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {(v * 100).toFixed(0)}%
                </text>
              </g>
            ))}
            {x.ticks(narrow ? 4 : 8).map((v) => (
              <text key={v} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              Calendar days to expiry
            </text>
            <rect x={x(31)} width={x(52) - x(31)} height={ih} fill={t['band-2']} />
            <text x={(x(31) + x(52)) / 2} y={-8} textAnchor="middle" fontSize={10} fill={t['ink-2']}>
              Nov 27 to Dec 18
            </text>
            {FWD.map((f, i) => (
              <line key={i} x1={x(f.d0)} x2={x(f.d1)} y1={y(f.v)} y2={y(f.v)} stroke={t.put} strokeWidth={i === 3 ? 3.5 : 2} />
            ))}
            <path d={spot} fill="none" stroke={t.call} strokeWidth={2} />
            {TS.map((p, i) => (
              <circle key={p.expiry} cx={x(p.dte)} cy={y(p.atmIv)} r={hi === i ? 6 : 4.5} fill={t.call} stroke={t.surface} strokeWidth={2} onPointerEnter={() => setHi(i)} onPointerDown={() => setHi(i)} onPointerLeave={() => setHi(null)} />
            ))}
          </g>
        </svg>
        {hi !== null && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(TS[hi].dte) + 12, width - 190), top: m.top + 10 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              {TS[hi].expiry} ({TS[hi].dte} days)
            </div>
            <div>
              ATM IV: <b>{fmtP(TS[hi].atmIv)}</b>
            </div>
            {hi > 0 && (
              <div>
                Forward from previous: <b>{fmtP(FWD[hi - 1].v)}</b>
              </div>
            )}
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'ATM implied vol (spot)', color: t.call },
          { label: 'Forward vol between expiries', color: t.put },
        ]}
      />
      <StatGrid
        cols={3}
        items={[
          ['Nov 27 ATM IV', fmtP(nov.atmIv), '31 days'],
          ['Dec 18 ATM IV', fmtP(dec.atmIv), '52 days'],
          ['Forward, Nov 27 to Dec 18', fmtP(fwd), 'the 21 days a calendar owns', t.put],
        ]}
      />
    </div>
  );
}
