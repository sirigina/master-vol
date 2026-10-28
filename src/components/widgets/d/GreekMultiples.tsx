import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { S0, K0, g } from './common';

const VOLS = [10, 14, 25] as const;
type Row = { S: number; v: number; vol: string };
const GREEKS = [
  { key: 'delta', label: 'Delta' },
  { key: 'gamma', label: 'Gamma' },
  { key: 'theta', label: 'Theta (per day)' },
  { key: 'vega', label: 'Vega (per vol pt)' },
] as const;

/** Small multiples: each Greek of the 770 call vs SPY price at three volatilities. */
export default function GreekMultiples() {
  const [dte, setDte] = useState<'31' | '10'>('31');
  const d = +dte;
  const data = useMemo(() => {
    const out: Record<string, Row[]> = { delta: [], gamma: [], theta: [], vega: [] };
    for (const v of VOLS)
      for (let S = 700; S <= 840; S += 1) {
        const x = g('call', S, K0, d, v / 100);
        for (const k of GREEKS) out[k.key].push({ S, v: x[k.key], vol: `${v}% vol` });
      }
    return out;
  }, [d]);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Each Greek of the 770 call vs SPY price, at three volatilities"
        sub="Model illustration. Low vol concentrates the Greeks near the strike; high vol spreads them out."
        right={
          <Segmented
            label="Days left"
            value={dte}
            onChange={setDte}
            options={[
              { value: '31', label: '31 days' },
              { value: '10', label: '10 days' },
            ]}
          />
        }
      />
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        {GREEKS.map((k) => (
          <div key={k.key}>
            <div className="text-[0.8rem] font-semibold text-(--sl-color-gray-2)">{k.label}</div>
            <PlotFigure
              deps={[data]}
              minHeight={170}
              build={(width, t) =>
                Plot.plot({
                  width,
                  height: 170,
                  marginLeft: 46,
                  marginBottom: 28,
                  marginTop: 8,
                  style: plotStyle(t),
                  x: { label: null, domain: [700, 840], ticks: 5 },
                  y: { label: null, grid: true, ticks: 4, tickFormat: k.key === 'gamma' ? (v: number) => v.toFixed(3) : (v: number) => v.toFixed(2) },
                  color: { domain: VOLS.map((v) => `${v}% vol`), range: [t.call, t.aqua, t.put] },
                  marks: [
                    Plot.ruleX([K0], { stroke: t.muted, strokeDasharray: '3 3' }),
                    Plot.ruleY([0], { stroke: t.axis }),
                    Plot.line(data[k.key], { x: 'S', y: 'v', stroke: 'vol', strokeWidth: 1.8 }),
                    Plot.tip(data[k.key], Plot.pointer({ x: 'S', y: 'v', stroke: 'vol', title: (r: Row) => `SPY ${r.S}, ${r.vol}\n${k.label}: ${r.v.toFixed(k.key === 'gamma' ? 4 : 3)}` })),
                  ],
                })
              }
            />
          </div>
        ))}
      </div>
      <Legend items={VOLS.map((v, i) => ({ label: `${v}% volatility`, color: ['var(--viz-call)', 'var(--viz-aqua)', 'var(--viz-put)'][i] }))} />
      <p className="mt-1 text-[0.78rem] text-(--sl-color-gray-3)">x-axis: SPY price, 700 to 840; dashed line: strike 770; SPY at the snapshot: {S0}.</p>
    </div>
  );
}
