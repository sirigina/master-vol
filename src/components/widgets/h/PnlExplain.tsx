import { useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { BOOKS, S0, bookGreeks, bookPnl, sgn0 } from './hlib';

/** H2: one-day P/L explain. Greeks × moves, versus a full reprice. */
export default function PnlExplain() {
  const t = useTokens();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 600);
  const [book, setBook] = useState('shortStrangle');
  const [move, setMove] = useState(-1);
  const [dv, setDv] = useState(1);
  const days = 1;

  const legs = BOOKS[book].legs;
  const g = useMemo(() => bookGreeks(legs), [book]);
  const dS = (S0 * move) / 100;
  const parts = [
    { k: 'Delta', v: g.delta * dS, how: `${g.delta.toFixed(1)} sh × ${dS.toFixed(2)}` },
    { k: 'Gamma', v: 0.5 * g.gamma * dS * dS, how: `½ × ${g.gamma.toFixed(2)} × ${dS.toFixed(2)}²` },
    { k: 'Vega', v: g.vega * dv, how: `${g.vega.toFixed(0)} × ${dv.toFixed(1)}` },
    { k: 'Theta', v: g.theta * days, how: `${g.theta.toFixed(0)} × 1 day` },
  ];
  const explained = parts.reduce((a, p) => a + p.v, 0);
  const actual = bookPnl(legs, { S: S0 + dS, volPts: dv, days });
  const resid = actual - explained;
  const all = [...parts, { k: 'Unexplained', v: resid, how: 'cross terms, higher order' }];

  // waterfall
  let run = 0;
  const steps = all.map((p) => {
    const from = run;
    run += p.v;
    return { ...p, from, to: run };
  });
  const ext = Math.max(10, ...steps.flatMap((s) => [Math.abs(s.from), Math.abs(s.to)]), Math.abs(actual));
  const labelW = width < 480 ? 86 : 110;
  const valW = 70;
  const x = scaleLinear().domain([-ext * 1.05, ext * 1.05]).range([labelW, width - valW]);
  const rowH = 28;
  const rowsAll = [...steps, { k: 'Full reprice', v: actual, from: 0, to: actual, how: '' }];
  const h = rowsAll.length * rowH + 22;

  return (
    <div className="viz-card not-content">
      <CardHead title="Reading the risk report: one-day P/L explain" sub="Predict tomorrow's P/L from today's Greeks, then compare with a full Black-Scholes reprice" />
      <Segmented
        label="Book"
        value={book}
        onChange={setBook}
        options={['shortStrangle', 'ironCondor', 'longStraddle', 'calendar'].map((k) => ({ value: k, label: BOOKS[k].label }))}
      />
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Slider label="SPY move overnight" value={move} min={-4} max={4} step={0.25} onChange={setMove} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}% (${dS >= 0 ? '+' : '−'}$${Math.abs(dS).toFixed(2)})`} />
        <Slider label="Change in every IV" value={dv} min={-4} max={6} step={0.5} onChange={setDv} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} vol pts`} />
      </div>
      <div ref={wrap} className="mt-4 w-full">
        <svg width={width} height={h} role="img" aria-label="Waterfall of P/L by Greek, compared with full reprice" style={{ display: 'block' }}>
          <line x1={x(0)} x2={x(0)} y1={0} y2={h - 20} stroke={t.axis} />
          {rowsAll.map((s, i) => {
            const y0 = i * rowH + 2;
            const final = s.k === 'Full reprice';
            const a = x(Math.min(s.from, s.to));
            const w = Math.abs(x(s.to) - x(s.from));
            const fill = final ? t.stock : s.k === 'Unexplained' ? t.muted : s.v >= 0 ? t.profit : t.loss;
            return (
              <g key={s.k} transform={`translate(0,${y0})`}>
                {final && <line x1={0} x2={width} y1={-1} y2={-1} stroke={t.grid} />}
                <text x={0} y={rowH / 2} dy="0.32em" fontSize={11.5} fill={final ? t.ink : t['ink-2']} fontWeight={final ? 700 : 400}>
                  {s.k}
                </text>
                <rect x={a} y={5} width={Math.max(w, 1.5)} height={rowH - 10} rx={2} fill={fill} />
                {i < rowsAll.length - 2 && <line x1={x(s.to)} x2={x(s.to)} y1={rowH - 5} y2={rowH + 5} stroke={t.muted} strokeDasharray="2 2" />}
                <text x={width - 2} y={rowH / 2} dy="0.32em" textAnchor="end" fontSize={11.5} fill={t.ink} fontWeight={final ? 700 : 500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {sgn0(s.v)}
                </text>
              </g>
            );
          })}
          {x.ticks(width < 480 ? 3 : 5).map((v) => (
            <text key={v} x={x(v)} y={h - 4} textAnchor="middle" fontSize={10} fill={t.muted}>
              {v === 0 ? '$0' : `${v < 0 ? '−' : '+'}$${Math.abs(v).toLocaleString()}`}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 text-[0.75rem] text-(--sl-color-gray-3) sm:grid-cols-2">
        {parts.map((p) => (
          <div key={p.k} className="tabular-nums">
            {p.k}: {p.how}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.82rem] text-(--sl-color-gray-2)">
        Greeks explain <b>{sgn0(explained)}</b>; the full reprice gives <b>{sgn0(actual)}</b>. The {Math.abs(resid) < 0.05 * Math.max(Math.abs(actual), 20) ? 'small ' : ''}gap of{' '}
        <b>{sgn0(resid)}</b> is what the Greek report misses.
      </p>
      <p className="mt-1 text-[0.75rem] text-(--sl-color-gray-3)">Snapshot Greeks; IVs shift in parallel; one calendar day passes. Model reprice, not a market forecast.</p>
    </div>
  );
}
