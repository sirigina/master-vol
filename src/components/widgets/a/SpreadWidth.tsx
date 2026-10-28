import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';
import { S0 } from './common';

type Unit = 'pct' | 'usd';
type Row = { strike: number; type: 'Calls' | 'Puts'; usd: number; pct: number; bid: number; ask: number; mark: number };
const rows: Row[] = [
  ...snapshot.chain.calls.map((c) => ({ strike: c.strike, type: 'Calls' as const, usd: c.ask - c.bid, pct: ((c.ask - c.bid) / c.mark) * 100, bid: c.bid, ask: c.ask, mark: c.mark })),
  ...snapshot.chain.puts.map((p) => ({ strike: p.strike, type: 'Puts' as const, usd: p.ask - p.bid, pct: ((p.ask - p.bid) / p.mark) * 100, bid: p.bid, ask: p.ask, mark: p.mark })),
];

/** Bid-ask spread across the real chain, in dollars or as % of the mark. */
export default function SpreadWidth() {
  const [unit, setUnit] = useState<Unit>('usd');
  return (
    <div className="viz-card not-content">
      <CardHead
        title="How wide is the spread?"
        sub="Ask minus bid on every quoted strike, Nov 27, 2026 expiry. Hover a point."
        right={
          <Segmented
            label="Units"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'usd', label: 'Dollars' },
              { value: 'pct', label: '% of mark' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[unit]}
        minHeight={300}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 46,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Strike', domain: [640, 845] },
            y: unit === 'usd' ? { label: 'Spread ($ per share)', grid: true, domain: [0, 3] } : { label: 'Spread (% of mark)', grid: true, domain: [0, 8.5] },
            color: { domain: ['Calls', 'Puts'], range: [t.call, t.put], legend: true },
            marks: [
              Plot.ruleX([S0], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([S0], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => `SPY ${S0}`, fill: t.muted }),
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.line(rows, { x: 'strike', y: unit, stroke: 'type', strokeWidth: 1.5, curve: 'linear' }),
              Plot.dot(rows, { x: 'strike', y: unit, fill: 'type', r: 4.5, stroke: t.surface, strokeWidth: 1.5 }),
              Plot.tip(
                rows,
                Plot.pointer({
                  x: 'strike',
                  y: unit,
                  title: (d: Row) =>
                    `${d.strike} ${d.type === 'Calls' ? 'call' : 'put'}\nBid ${d.bid.toFixed(2)} / Ask ${d.ask.toFixed(2)}\nSpread $${d.usd.toFixed(2)} (${d.pct.toFixed(2)}% of mark)\n$${Math.round(d.usd * 100)} per contract`,
                }),
              ),
            ],
          })
        }
      />
      <p className="mt-2 text-[0.8rem] text-(--sl-color-gray-3)">
        In dollars, the spread is tight near the money and jumps for deep in-the-money options. As a percentage of the price, the far out-of-the-money
        840 call is the most expensive to trade.
      </p>
    </div>
  );
}
