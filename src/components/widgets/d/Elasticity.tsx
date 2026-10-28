import * as Plot from '@observablehq/plot';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { CardHead, Legend } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';

const S = snapshot.spot;
type Row = { strike: number; lam: number; type: 'Calls' | 'Puts'; mark: number; delta: number };
const rows: Row[] = [
  ...snapshot.chain.calls.map((c) => ({ strike: c.strike, lam: (c.delta * S) / c.mark, type: 'Calls' as const, mark: c.mark, delta: c.delta })),
  ...snapshot.chain.puts.map((p) => ({ strike: p.strike, lam: (Math.abs(p.delta) * S) / p.mark, type: 'Puts' as const, mark: p.mark, delta: p.delta })),
];

/** Elasticity (leverage) λ = |Δ|·S / V across the real Nov 27 chain. */
export default function Elasticity() {
  return (
    <div className="viz-card not-content">
      <CardHead
        title="Leverage across the real chain: elasticity λ = |Δ| × S ÷ price"
        sub="% change in the option for a 1% move in SPY, Nov 27 expiry, vendor deltas and mid prices"
      />
      <PlotFigure
        deps={[]}
        minHeight={290}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 46,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Strike', domain: [640, 845] },
            y: { label: 'Elasticity (×)', grid: true, domain: [0, 85] },
            color: { domain: ['Calls', 'Puts'], range: [t.call, t.put] },
            marks: [
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.ruleX([S], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([S], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => `SPY ${S}`, fill: t.muted }),
              Plot.line(rows, { x: 'strike', y: 'lam', stroke: 'type', strokeWidth: 2, curve: 'monotone-x' }),
              Plot.dot(rows, { x: 'strike', y: 'lam', fill: 'type', r: 4.5, stroke: t.surface, strokeWidth: 2 }),
              Plot.tip(
                rows,
                Plot.pointer({
                  x: 'strike',
                  y: 'lam',
                  title: (d: Row) =>
                    `${d.strike} ${d.type === 'Calls' ? 'call' : 'put'} at $${d.mark.toFixed(2)}\nDelta ${d.delta.toFixed(3)}\nElasticity ${d.lam.toFixed(1)}×\n1% SPY move ≈ ${d.lam.toFixed(0)}% option move`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Calls (gain when SPY rises)', color: 'var(--viz-call)' },
          { label: 'Puts (gain when SPY falls; shown as magnitude)', color: 'var(--viz-put)' },
        ]}
      />
    </div>
  );
}
