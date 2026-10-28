import * as Plot from '@observablehq/plot';
import PlotFigure, { plotStyle } from './PlotFigure';
import { snapshot } from '../../lib/snapshot';

type Row = { strike: number; delta: number; type: 'Calls' | 'Puts'; iv: number };
const rows: Row[] = [
  ...snapshot.chain.calls.map((c) => ({ strike: c.strike, delta: c.delta, type: 'Calls' as const, iv: c.iv })),
  ...snapshot.chain.puts.map((p) => ({ strike: p.strike, delta: p.delta, type: 'Puts' as const, iv: p.iv })),
];

/** Real deltas across the Nov 27 chain. */
export default function DeltaChain() {
  return (
    <div className="viz-card not-content">
      <div className="mb-1 text-[0.95rem] font-semibold text-(--sl-color-white)">
        Delta across the real SPY chain (Nov 27 expiry, {snapshot.chain.dte} days)
      </div>
      <PlotFigure
        deps={[]}
        minHeight={300}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 46,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Strike', domain: [640, 845] },
            y: { label: 'Delta', grid: true, domain: [-1, 1] },
            color: { domain: ['Calls', 'Puts'], range: [t.call, t.put], legend: true },
            marks: [
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.ruleX([snapshot.spot], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([snapshot.spot], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => `SPY ${snapshot.spot}`, fill: t.muted }),
              Plot.line(rows, { x: 'strike', y: 'delta', stroke: 'type', strokeWidth: 2, curve: 'monotone-x' }),
              Plot.dot(rows, { x: 'strike', y: 'delta', fill: 'type', r: 4.5, stroke: t.surface, strokeWidth: 2 }),
              Plot.tip(rows, Plot.pointer({ x: 'strike', y: 'delta', title: (d: Row) => `${d.strike} ${d.type === 'Calls' ? 'call' : 'put'}\nDelta ${d.delta.toFixed(2)}\nIV ${(d.iv * 100).toFixed(1)}%` })),
            ],
          })
        }
      />
    </div>
  );
}
