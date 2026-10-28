import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';

type Row = { strike: number; gamma: number; dollar: number; type: 'Calls' | 'Puts'; iv: number };
const S = snapshot.spot;
const rows: Row[] = [
  ...snapshot.chain.calls.map((c) => ({ strike: c.strike, gamma: c.gamma, dollar: (c.gamma * S * S) / 100 * 100, type: 'Calls' as const, iv: c.iv })),
  ...snapshot.chain.puts.map((p) => ({ strike: p.strike, gamma: p.gamma, dollar: (p.gamma * S * S) / 100 * 100, type: 'Puts' as const, iv: p.iv })),
];

/** Vendor gamma across the Nov 27 chain. */
export default function GammaChain() {
  const [unit, setUnit] = useState<'raw' | 'dollar'>('raw');
  const key = unit === 'raw' ? 'gamma' : 'dollar';
  return (
    <div className="viz-card not-content">
      <CardHead
        title={`Gamma across the real SPY chain (Nov 27 expiry, ${snapshot.chain.dte} days)`}
        sub={unit === 'raw' ? 'Quoted gamma: change in delta per $1 move in SPY' : 'Dollar gamma per contract: change in dollar delta for a 1% SPY move'}
        right={
          <Segmented
            label="Units"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'raw', label: 'Gamma' },
              { value: 'dollar', label: '$ gamma / 1%' },
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
            marginLeft: 58,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Strike', domain: [640, 845] },
            y: {
              label: unit === 'raw' ? 'Gamma' : 'Dollar gamma per 1% ($)',
              grid: true,
              tickFormat: unit === 'raw' ? (d: number) => d.toFixed(3) : (d: number) => `${(d / 1000).toFixed(0)}k`,
            },
            color: { domain: ['Calls', 'Puts'], range: [t.call, t.put], legend: true },
            marks: [
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.ruleX([S], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([S], { x: (d: number) => d, frameAnchor: 'bottom', dy: -6, dx: -4, textAnchor: 'end', text: () => `SPY ${S}`, fill: t.muted }),
              Plot.line(rows, { x: 'strike', y: key, stroke: 'type', strokeWidth: 2, curve: 'monotone-x' }),
              Plot.dot(rows, { x: 'strike', y: key, fill: 'type', r: 4.5, stroke: t.surface, strokeWidth: 2 }),
              Plot.tip(
                rows,
                Plot.pointer({
                  x: 'strike',
                  y: key,
                  title: (d: Row) =>
                    `${d.strike} ${d.type === 'Calls' ? 'call' : 'put'}\nGamma ${d.gamma.toFixed(4)}\n$ gamma per 1%: $${Math.round(d.dollar).toLocaleString()}\nIV ${(d.iv * 100).toFixed(1)}%`,
                }),
              ),
            ],
          })
        }
      />
    </div>
  );
}
