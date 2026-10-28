import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { snapshot, type ChainRow } from '../../../lib/snapshot';
import { S0 } from './common';

type Pt = { strike: number; ad: number; type: 'Calls' | 'Puts'; delta: number };
const pts: Pt[] = [
  ...snapshot.chain.calls.map((c) => ({ strike: c.strike, ad: c.delta, type: 'Calls' as const, delta: c.delta })),
  ...snapshot.chain.puts.map((p) => ({ strike: p.strike, ad: -p.delta, type: 'Puts' as const, delta: p.delta })),
];

/** Linear interpolation of the strike whose |delta| equals target. */
export function strikeAtDelta(rows: ChainRow[], target: number): number | null {
  for (let i = 0; i < rows.length - 1; i++) {
    const a = Math.abs(rows[i].delta);
    const b = Math.abs(rows[i + 1].delta);
    if ((a - target) * (b - target) <= 0 && a !== b) return rows[i].strike + ((rows[i + 1].strike - rows[i].strike) * (target - a)) / (b - a);
  }
  return null;
}

/** Moneyness two ways: by strike distance and by delta. */
export default function MoneynessDelta() {
  const [d, setD] = useState(0.25);
  const kc = strikeAtDelta(snapshot.chain.calls, d);
  const kp = strikeAtDelta(snapshot.chain.puts, d);
  const label = (k: number | null) => (k === null ? 'beyond listed strikes' : k.toFixed(1));
  const dist = (k: number | null) => (k === null ? '' : `${k > S0 ? '+' : '−'}${Math.abs(k - S0).toFixed(1)} (${k > S0 ? '+' : '−'}${Math.abs(((k - S0) / S0) * 100).toFixed(1)}%) from SPY`);

  return (
    <div className="viz-card not-content">
      <CardHead title="Moneyness by strike vs by delta" sub="Real deltas (absolute value) on the Nov 27 chain. Pick a delta; see which strikes carry it." />
      <Slider className="mb-2 sm:w-80" label="Target delta (absolute)" value={d} min={0.05} max={0.9} step={0.05} onChange={setD} format={(v) => `${Math.round(v * 100)}-delta`} />
      <PlotFigure
        deps={[d]}
        minHeight={300}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 44,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Strike', domain: [640, 845] },
            y: { label: '|Delta|', grid: true, domain: [0, 1] },
            color: { domain: ['Calls', 'Puts'], range: [t.call, t.put], legend: true },
            marks: [
              Plot.ruleX([S0], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([S0], { x: (v: number) => v, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => `SPY ${S0}`, fill: t.muted }),
              Plot.ruleY([d], { stroke: t.stock, strokeWidth: 1.5 }),
              Plot.line(pts, { x: 'strike', y: 'ad', stroke: 'type', strokeWidth: 2, curve: 'monotone-x' }),
              Plot.dot(pts, { x: 'strike', y: 'ad', fill: 'type', r: 4, stroke: t.surface, strokeWidth: 1.5 }),
              kc !== null ? Plot.dot([{ x: kc, y: d }], { x: 'x', y: 'y', r: 6, fill: t.call, stroke: t.ink, strokeWidth: 2 }) : null,
              kp !== null ? Plot.dot([{ x: kp, y: d }], { x: 'x', y: 'y', r: 6, fill: t.put, stroke: t.ink, strokeWidth: 2 }) : null,
              Plot.tip(pts, Plot.pointer({ x: 'strike', y: 'ad', title: (p: Pt) => `${p.strike} ${p.type === 'Calls' ? 'call' : 'put'}\nDelta ${p.delta.toFixed(2)}\n${p.strike > S0 ? '+' : '−'}${Math.abs(p.strike - S0).toFixed(2)} from SPY` })),
            ],
          })
        }
      />
      <StatGrid
        cols={2}
        items={[
          [`${Math.round(d * 100)}-delta call`, label(kc), dist(kc), 'var(--viz-call)'],
          [`${Math.round(d * 100)}-delta put`, label(kp), dist(kp), 'var(--viz-put)'],
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">Strikes between listed rows are interpolated from the quoted deltas.</p>
    </div>
  );
}
