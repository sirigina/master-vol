import { useRef, useState } from 'react';
import { scaleLinear, scaleBand } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, callAt, putAt, T_EXPIRY, fmt } from '../../../lib/snapshot';
import { bs, type Right } from '../../../lib/pricing';
import { fmtSigned } from './kit';

const K = 770;

interface Shock {
  name: string;
  detail: string;
  lo: string;
  hi: string;
  apply: (sgn: 1 | -1) => { S: number; T: number; r: number; q: number; sigma: number };
}

/** Tornado: price change of the 770 call/put for realistic one-day-to-one-week changes in each input. */
export default function InputTornado() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [right, setRight] = useState<Right>('call');
  const iv = (right === 'call' ? callAt(K)! : putAt(K)!).iv;
  const b = { S: snapshot.spot, T: T_EXPIRY, r: snapshot.rate, q: 0, sigma: iv };
  const base = bs(right, { ...b, K }).price;

  const shocks: Shock[] = [
    { name: 'SPY ±1%', detail: 'about one typical day', lo: '−1%', hi: '+1%', apply: (s) => ({ ...b, S: b.S * (1 + 0.01 * s) }) },
    { name: 'Volatility ±1 pt', detail: 'a normal week for IV', lo: '−1 pt', hi: '+1 pt', apply: (s) => ({ ...b, sigma: b.sigma + 0.01 * s }) },
    { name: 'One week passes', detail: 'time only moves one way', lo: '', hi: '−7 days', apply: (s) => ({ ...b, T: s === 1 ? b.T - 7 / 365 : b.T }) },
    { name: 'Rate ±0.5%', detail: 'a big move in rates', lo: '−0.5%', hi: '+0.5%', apply: (s) => ({ ...b, r: b.r + 0.005 * s }) },
    { name: 'Dividend ±0.5%', detail: 'a big dividend surprise', lo: '−0.5%', hi: '+0.5%', apply: (s) => ({ ...b, q: b.q + 0.005 * s }) },
  ];
  const rows = shocks.map((sh) => {
    const up = bs(right, { ...sh.apply(1), K }).price - base;
    const dn = bs(right, { ...sh.apply(-1), K }).price - base;
    return { ...sh, up, dn };
  });

  const narrow = width < 480;
  const labelW = narrow ? 8 : 160;
  const m = { top: narrow ? 20 : 8, right: narrow ? 8 : 54, bottom: 30, left: labelW };
  const rowH = narrow ? 58 : 46;
  const h = m.top + m.bottom + rowH * rows.length;
  const iw = Math.max(width - m.left - m.right, 60);
  const ext = Math.max(...rows.flatMap((r) => [Math.abs(r.up), Math.abs(r.dn)]));
  const x = scaleLinear().domain([-ext * (narrow ? 1.45 : 1.08), ext * (narrow ? 1.45 : 1.08)]).nice().range([0, iw]);
  const y = scaleBand<string>().domain(rows.map((r) => r.name)).range([0, rowH * rows.length]).paddingInner(narrow ? 0.5 : 0.28).paddingOuter(narrow ? 0.1 : 0.28);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Which input moves the price most?"
        sub={`Change in the 770 ${right} for a realistic change in each input, everything else at the snapshot (base ${fmt.usd(base)})`}
        right={
          <Segmented
            label="Option"
            value={right}
            onChange={setRight}
            options={[
              { value: 'call', label: '770 call' },
              { value: 'put', label: '770 put' },
            ]}
          />
        }
      />
      <div ref={wrap} className="w-full">
        <svg width={width} height={h} role="img" aria-label="Tornado chart of price sensitivity to each input" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {x.ticks(narrow ? 5 : 9).map((v) => (
              <g key={v} transform={`translate(${x(v)},0)`}>
                <line y2={rowH * rows.length} stroke={t.grid} />
                <text y={rowH * rows.length + 17} textAnchor="middle" fontSize={11} fill={t.muted}>
                  {v === 0 ? '0' : `${v > 0 ? '+' : '−'}$${Math.abs(v)}`}
                </text>
              </g>
            ))}
            <line x1={x(0)} x2={x(0)} y2={rowH * rows.length} stroke={t.axis} strokeWidth={1.5} />
            {rows.map((r) => {
              const y0 = y(r.name)!;
              const bh = y.bandwidth();
              const bars = [
                { v: r.up, lab: r.hi, up: true },
                { v: r.dn, lab: r.lo, up: false },
              ].filter((b) => Math.abs(b.v) > 1e-9);
              return (
                <g key={r.name}>
                  {narrow ? (
                    <text x={0} y={y0 - 6} fontSize={11.5} fill={t.ink}>
                      <tspan fontWeight={600}>{r.name}</tspan>
                      <tspan fill={t.muted}> · {r.detail}</tspan>
                    </text>
                  ) : (
                    <>
                      <text x={-10} y={y0 + bh / 2 - 6} textAnchor="end" fontSize={12} fontWeight={600} fill={t.ink}>
                        {r.name}
                      </text>
                      <text x={-10} y={y0 + bh / 2 + 9} textAnchor="end" fontSize={10.5} fill={t.muted}>
                        {r.detail}
                      </text>
                    </>
                  )}
                  {bars.map((b) => {
                    const x0 = Math.min(x(0), x(b.v));
                    const w = Math.abs(x(b.v) - x(0));
                    const pos = b.v > 0;
                    return (
                      <g key={String(b.up)}>
                        <rect x={x0} y={y0} width={Math.max(w, 1)} height={bh} rx={3} fill={pos ? t.profit : t.loss} fillOpacity={b.up ? 0.85 : 0.5} />
                        <text
                          x={pos ? x(b.v) + 4 : x(b.v) - 4}
                          y={y0 + bh / 2}
                          dy="0.32em"
                          textAnchor={pos ? 'start' : 'end'}
                          fontSize={10.5}
                          fill={t['ink-2']}
                        >
                          {fmtSigned(b.v)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <Legend
        items={[
          { label: 'Option gains', color: t.profit, kind: 'box' },
          { label: 'Option loses', color: t.loss, kind: 'box' },
          { label: 'Solid bar: input rises (or a week passes). Pale bar: input falls', color: t.muted, kind: 'dot' },
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Priced with Black-Scholes at the 770 {right}'s own IV ({fmt.pct(iv, 2)}), {snapshot.chain.dte} days, 4.6% rate, no dividend.
      </p>
    </div>
  );
}
