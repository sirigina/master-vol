import { useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, callAt, putAt, T_EXPIRY, fmt } from '../../../lib/snapshot';
import { fmtSigned } from './kit';

const S0 = snapshot.spot;
const STRIKES = [760, 765, 770, 775, 780];

/**
 * Why the call is worth more than the put: call − put = (S − K) + interest on K − dividends.
 * A waterfall from the pieces to the total, compared with the market gap.
 */
export default function CarryBar() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [k, setK] = useState('770');
  const [rate, setRate] = useState(4.6);
  const [divy, setDivy] = useState(0);
  const K = +k;
  const r = rate / 100;
  const q = divy / 100;
  const T = T_EXPIRY;
  const pieces = [
    { name: 'Spot − strike', sub: 'S − K', v: S0 - K, color: t.stock },
    { name: 'Interest on the strike', sub: 'K(1 − e^(−rT))', v: K * (1 - Math.exp(-r * T)), color: t.call },
    { name: 'Dividends forgone', sub: 'S(1 − e^(−qT))', v: -S0 * (1 - Math.exp(-q * T)), color: t.put },
  ];
  const total = pieces.reduce((a, p) => a + p.v, 0);
  const market = callAt(K)!.mark - putAt(K)!.mark;

  const allRows = [...pieces, { name: 'Call − put (model)', sub: 'sum of the above', v: total, color: t.aqua }];
  const narrow = width < 480;
  const m = { top: narrow ? 18 : 6, right: 56, bottom: 26, left: narrow ? 8 : 176 };
  const rowH = narrow ? 52 : 40;
  const h = m.top + m.bottom + rowH * allRows.length;
  const iw = Math.max(width - m.left - m.right, 60);
  // running waterfall positions
  let run = 0;
  const bars = allRows.map((p, i) => {
    if (i === allRows.length - 1) return { ...p, a: 0, b: total };
    const a = run;
    run += p.v;
    return { ...p, a, b: run };
  });
  const lo = Math.min(-2, ...bars.flatMap((b) => [b.a, b.b]), market);
  const hi = Math.max(2, ...bars.flatMap((b) => [b.a, b.b]), market);
  const x = scaleLinear().domain([lo - 0.5, hi + 0.5]).nice().range([0, iw]);
  const barH = narrow ? 22 : rowH - 16;

  return (
    <div className="viz-card not-content">
      <CardHead title="Where the call's extra value comes from" sub="Call − put for one strike, built up from its pieces (November 27 expiry)" />
      <div className="mb-3 grid gap-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
        <Segmented label="Strike" value={k} onChange={setK} options={STRIKES.map((s) => ({ value: String(s), label: String(s) }))} />
        <Slider label="Interest rate" value={rate} min={0} max={8} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="Dividend yield" value={divy} min={0} max={3} step={0.1} onChange={setDivy} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <div ref={wrap} className="w-full">
        <svg width={width} height={h} role="img" aria-label="Waterfall of call minus put into spot minus strike, interest and dividends" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {x.ticks(narrow ? 4 : 6).map((v) => (
              <g key={v} transform={`translate(${x(v)},0)`}>
                <line y2={rowH * allRows.length} stroke={t.grid} />
                <text y={rowH * allRows.length + 16} textAnchor="middle" fontSize={11} fill={t.muted}>
                  {v === 0 ? '0' : `${v > 0 ? '+' : '−'}$${Math.abs(v)}`}
                </text>
              </g>
            ))}
            <line x1={x(0)} x2={x(0)} y2={rowH * allRows.length} stroke={t.axis} strokeWidth={1.5} />
            <line x1={x(market)} x2={x(market)} y1={rowH * 3 + (narrow ? 0 : 4)} y2={rowH * 3 + (narrow ? 4 : 8) + barH + 4} stroke={t.ink} strokeWidth={2} strokeDasharray="3 2" />
            {bars.map((b, i) => {
              const y0 = i * rowH + (narrow ? 4 : 8);
              const x0 = Math.min(x(b.a), x(b.b));
              const w = Math.max(Math.abs(x(b.b) - x(b.a)), 1.5);
              const right = Math.max(x(b.a), x(b.b));
              return (
                <g key={b.name}>
                  {narrow ? (
                    <text x={0} y={y0 - 5} fontSize={11.5} fill={t.ink}>
                      <tspan fontWeight={600}>{b.name}</tspan>
                      <tspan fill={t.muted}> · {b.sub}</tspan>
                    </text>
                  ) : (
                    <>
                      <text x={-10} y={y0 + 9} textAnchor="end" fontSize={12} fontWeight={600} fill={t.ink}>
                        {b.name}
                      </text>
                      <text x={-10} y={y0 + 23} textAnchor="end" fontSize={10.5} fill={t.muted}>
                        {b.sub}
                      </text>
                    </>
                  )}
                  <rect x={x0} y={y0} width={w} height={barH} rx={3} fill={b.color} fillOpacity={0.85} />
                  <text x={right + 5} y={y0 + barH / 2} dy="0.32em" fontSize={11} fill={t['ink-2']}>
                    {fmtSigned(b.v)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <p className="mt-2 text-[0.8rem] text-(--sl-color-gray-3)">
        Model call − put <b className="text-(--sl-color-white)">{fmtSigned(total)}</b> vs market {fmt.usd(callAt(K)!.mark)} − {fmt.usd(putAt(K)!.mark)} ={' '}
        <b className="text-(--sl-color-white)">{fmtSigned(market)}</b> (dashed line). Difference {fmtSigned(market - total)}.
      </p>
    </div>
  );
}
