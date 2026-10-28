import { useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, callAt, fmt } from '../../../lib/snapshot';
import { Tile, Btn, bsParts } from './kit';

const IV0 = Math.round(callAt(770)!.iv * 1000) / 10; // 14.1
const DEF = { S: snapshot.spot, K: 770, days: snapshot.chain.dte, vol: IV0 };

/** The 770 call as S·N(d1) minus K·e^(−rT)·N(d2), drawn as two bars and their difference. */
export default function BSDecompose() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [v, setV] = useState(DEF);
  const set = (k: keyof typeof DEF) => (x: number) => setV((o) => ({ ...o, [k]: x }));
  const r = snapshot.rate;
  const p = bsParts({ S: v.S, K: v.K, T: v.days / 365, r, sigma: v.vol / 100 });

  const narrow = width < 480;
  const rowH = narrow ? 52 : 44;
  const h = rowH * 3 + (narrow ? 44 : 32);
  const m = { top: narrow ? 20 : 8, right: 64, bottom: 24, left: narrow ? 6 : 150 };
  const iw = Math.max(width - m.left - m.right, 60);
  const maxV = Math.max(p.stockLeg, p.strikeLeg, 10);
  const x = scaleLinear().domain([0, maxV]).nice().range([0, iw]);
  const rows = [
    { name: 'What you receive', sub: 'S × N(d1)', a: 0, b: p.stockLeg, color: t.call },
    { name: 'What you pay', sub: 'K·e^(−rT) × N(d2)', a: 0, b: p.strikeLeg, color: t.put },
    { name: 'Call value', sub: 'the difference', a: p.strikeLeg, b: p.stockLeg, color: t.aqua },
  ];
  const barH = narrow ? 22 : rowH - 16;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Black-Scholes in two pieces"
        sub="The call price is the expected value of the stock you receive minus the expected cost of the strike you pay, both only in the cases where you exercise"
        right={<Btn onClick={() => setV(DEF)}>Reset to 770 call</Btn>}
      />
      <div className="mb-3 grid gap-4 sm:grid-cols-4">
        <Slider label="SPY" value={v.S} min={700} max={840} step={0.5} onChange={set('S')} format={(x) => fmt.usd(x)} />
        <Slider label="Strike" value={v.K} min={700} max={840} step={5} onChange={set('K')} format={(x) => `${x}`} />
        <Slider label="Days left" value={v.days} min={1} max={365} step={1} onChange={set('days')} format={(x) => `${x}`} />
        <Slider label="Volatility" value={v.vol} min={5} max={50} step={0.1} onChange={set('vol')} format={(x) => `${x.toFixed(1)}%`} />
      </div>
      <div ref={wrap} className="w-full">
        <svg width={width} height={h} role="img" aria-label="Bars for the stock term, strike term and call value" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {x.ticks(narrow ? 4 : 8).map((tv) => (
              <g key={tv} transform={`translate(${x(tv)},0)`}>
                <line y2={rowH * 3} stroke={t.grid} />
                <text y={rowH * 3 + 16} textAnchor="middle" fontSize={11} fill={t.muted}>
                  ${tv}
                </text>
              </g>
            ))}
            {rows.map((rw, i) => {
              const y0 = i * rowH + (narrow ? 4 : 8);
              return (
                <g key={rw.name}>
                  {narrow ? (
                    <text x={0} y={y0 - 5} fontSize={11.5} fill={t.ink}>
                      <tspan fontWeight={600}>{rw.name}</tspan>
                      <tspan fill={t.muted}> · {rw.sub}</tspan>
                    </text>
                  ) : (
                    <>
                      <text x={-10} y={y0 + 10} textAnchor="end" fontSize={12} fontWeight={600} fill={t.ink}>
                        {rw.name}
                      </text>
                      <text x={-10} y={y0 + 24} textAnchor="end" fontSize={10.5} fill={t.muted}>
                        {rw.sub}
                      </text>
                    </>
                  )}
                  <rect x={x(rw.a)} y={y0} width={Math.max(x(rw.b) - x(rw.a), 1.5)} height={barH} rx={3} fill={rw.color} fillOpacity={0.85} />
                  <text x={x(rw.b) + 5} y={y0 + barH / 2} dy="0.32em" fontSize={11} fontWeight={600} fill={t['ink-2']}>
                    {fmt.usd(rw.b - rw.a)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="d1 / d2" value={`${p.d1.toFixed(3)} / ${p.d2.toFixed(3)}`} sub="standardized distance to strike" />
        <Tile label="N(d1) = delta" value={p.Nd1.toFixed(3)} sub="hedge ratio" accent={t.call} />
        <Tile label="N(d2)" value={p.Nd2.toFixed(3)} sub="risk-neutral chance of ITM" accent={t.put} />
        <Tile label="Call price" value={fmt.usd(p.call)} sub={`market ${fmt.usd(callAt(770)!.mark)} (770)`} accent={t.aqua} />
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">Rate fixed at 4.6%, no dividend. Starts at the 770 call's quoted IV of {IV0.toFixed(1)}%.</p>
    </div>
  );
}
