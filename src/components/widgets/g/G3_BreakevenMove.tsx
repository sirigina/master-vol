import { useMemo, useRef, useState } from 'react';
import { scaleLinear, scaleBand } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { normCdf, expectedMove } from '../../../lib/pricing';
import { leg, expiryStats, S0, R, T_EXPIRY, atmIv } from './G1_kit';

const PAIRS: [number, number][] = [
  [770, 770],
  [765, 775],
  [760, 780],
  [750, 790],
  [740, 800],
];

/** Model probability that SPY finishes below lo or above hi at expiry (lognormal, ATM IV). */
function pOutside(lo: number, hi: number, sigma: number) {
  const d2 = (K: number) => (Math.log(S0 / K) + (R - 0.5 * sigma * sigma) * T_EXPIRY) / (sigma * Math.sqrt(T_EXPIRY));
  return 1 - normCdf(d2(lo)) + normCdf(d2(hi));
}

/** G3: breakevens of straddles and strangles against the 1 SD expected move. */
export default function G3BreakevenMove() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [sd, setSd] = useState<'1' | '0.8'>('1');
  const SD1 = expectedMove(S0, atmIv, 22);
  const band = sd === '1' ? SD1 : SD1 * Math.sqrt(2 / Math.PI);

  const rows = useMemo(
    () =>
      PAIRS.map(([p, c]) => {
        const st = expiryStats([leg('put', p, 1), leg('call', c, 1)]);
        const [lo, hi] = st.be;
        return { label: p === c ? `${p} straddle` : `${p}/${c} strangle`, p, c, cost: st.cost, lo, hi, prob: pOutside(lo, hi, atmIv) };
      }),
    [],
  );

  const narrow = width < 520;
  const m = { top: 26, right: narrow ? 36 : 120, bottom: 30, left: narrow ? 70 : 130 };
  const iw = Math.max(width - m.left - m.right, 60);
  const rowH = 44;
  const ih = rowH * rows.length;
  const height = ih + m.top + m.bottom;
  const x = scaleLinear().domain([725, 815]).range([0, iw]);
  const y = scaleBand<string>().domain(rows.map((r) => r.label)).range([0, ih]).padding(0.35);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="How far SPY must travel: breakevens vs the expected move"
        sub="Breakevens at expiry for long straddles and strangles, against the move the 770 straddle implies."
        right={
          <Segmented
            label="Reference band"
            value={sd}
            onChange={setSd}
            options={[
              { value: '1', label: '±1 SD' },
              { value: '0.8', label: '±0.8 SD (avg move)' },
            ]}
          />
        }
      />
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label="Breakeven ranges compared with the expected move" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            <rect x={x(S0 - band)} width={x(S0 + band) - x(S0 - band)} y={-6} height={ih + 6} fill={t['band-1']} />
            <text x={x(S0)} y={-12} textAnchor="middle" fontSize={10.5} fill={t.call} fontWeight={600}>
              {sd === '1' ? `±1 SD: ${(S0 - band).toFixed(0)} – ${(S0 + band).toFixed(0)}` : `avg move: ±$${band.toFixed(2)}`}
            </text>
            {x.ticks(narrow ? 4 : 8).map((v) => (
              <g key={v}>
                <line x1={x(v)} x2={x(v)} y2={ih} stroke={t.grid} />
                <text x={x(v)} y={ih + 16} textAnchor="middle" fontSize={10.5} fill={t.muted}>
                  {v}
                </text>
              </g>
            ))}
            <line x1={x(S0)} x2={x(S0)} y2={ih} stroke={t.muted} strokeDasharray="3 3" />
            {rows.map((r) => {
              const cy = y(r.label)! + y.bandwidth() / 2;
              return (
                <g key={r.label}>
                  <text x={-8} y={cy} dy="-0.15em" textAnchor="end" fontSize={11} fill={t.ink} fontWeight={600}>
                    {narrow ? (r.p === r.c ? `${r.p} strad.` : `${r.p}/${r.c}`) : r.label}
                  </text>
                  <text x={-8} y={cy} dy="1.05em" textAnchor="end" fontSize={10} fill={t.muted}>
                    costs ${Math.round(r.cost * 100).toLocaleString("en-US")}
                  </text>
                  {/* loss zone between breakevens */}
                  <line x1={x(r.lo)} x2={x(r.hi)} y1={cy} y2={cy} stroke={t.loss} strokeWidth={6} strokeLinecap="butt" opacity={0.75} />
                  {/* strikes */}
                  <line x1={x(r.p)} x2={x(r.p)} y1={cy - 9} y2={cy + 9} stroke={t.put} strokeWidth={2} />
                  <line x1={x(r.c)} x2={x(r.c)} y1={cy - 9} y2={cy + 9} stroke={t.call} strokeWidth={2} />
                  <circle cx={x(r.lo)} cy={cy} r={4} fill={t.surface} stroke={t.ink} strokeWidth={1.75} />
                  <circle cx={x(r.hi)} cy={cy} r={4} fill={t.surface} stroke={t.ink} strokeWidth={1.75} />
                  {!narrow && (
                    <>
                      <text x={x(r.lo) - 7} y={cy} dy="0.32em" textAnchor="end" fontSize={10} fill={t['ink-2']}>
                        {r.lo.toFixed(1)}
                      </text>
                      <text x={x(r.hi) + 7} y={cy} dy="0.32em" fontSize={10} fill={t['ink-2']}>
                        {r.hi.toFixed(1)}
                      </text>
                    </>
                  )}
                  <text x={iw + 8} y={cy} dy="0.32em" fontSize={narrow ? 10 : 11} fill={t.ink}>
                    {narrow ? `${(r.prob * 100).toFixed(0)}%` : `${(r.prob * 100).toFixed(0)}% finish outside`}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <Legend
        items={[
          { label: 'Loses money at expiry (between breakevens)', color: t.loss },
          { label: 'Put strike', color: t.put },
          { label: 'Call strike', color: t.call },
          { label: 'Expected-move band', color: t['band-1'], kind: 'box' },
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Right column: model probability that SPY ends beyond a breakeven, from a lognormal at the {(atmIv * 100).toFixed(1)}% ATM IV. It ignores skew and fat tails, and
        finishing outside is not the same as averaging a profit.
      </p>
    </div>
  );
}
