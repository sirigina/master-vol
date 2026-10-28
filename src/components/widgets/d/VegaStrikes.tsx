import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { S0, IV0, VOL0, g } from './common';

const DTES = [10, 31, 143, 416] as const;
type Row = { K: number; v: number; vega: number; price: number; dte: string };

/** Model vega of calls across strikes for several expiries. */
export default function VegaStrikes() {
  const [unit, setUnit] = useState<'abs' | 'pct'>('abs');
  const [vol, setVol] = useState(VOL0);
  const sigma = vol / 100;
  const data = useMemo(() => {
    const out: Row[] = [];
    for (const d of DTES)
      for (let K = 660; K <= 880; K += 2) {
        const x = g('call', S0, K, d, sigma);
        const pct = x.price > 0.05 ? (x.vega / x.price) * 100 : NaN;
        out.push({ K, vega: x.vega * 100, price: x.price, v: unit === 'abs' ? x.vega * 100 : pct, dte: `${d} days` });
      }
    return out.filter((r) => Number.isFinite(r.v));
  }, [sigma, unit]);

  return (
    <div className="viz-card not-content">
      <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_15rem] sm:items-end">
        <CardHead title="Vega across strikes, four expiries" sub={`Model calls at one flat volatility, SPY ${S0}. Hover to read values.`} />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <Segmented
        label="Units"
        value={unit}
        onChange={setUnit}
        options={[
          { value: 'abs', label: '$ per contract per vol point' },
          { value: 'pct', label: '% of option price' },
        ]}
      />
      <div className="mt-3">
        <PlotFigure
          deps={[data]}
          minHeight={300}
          build={(width, t) =>
            Plot.plot({
              width,
              height: 300,
              marginLeft: 50,
              marginBottom: 40,
              style: plotStyle(t),
              x: { label: 'Strike', domain: [660, 880] },
              y: {
                label: unit === 'abs' ? 'Vega ($ per contract)' : 'Vega as % of price',
                grid: true,
                domain: unit === 'pct' ? [0, 40] : undefined,
              },
              clip: true,
              color: { domain: DTES.map((d) => `${d} days`), range: [t.put, t.call, t.aqua, t.stock], legend: true },
              marks: [
                Plot.ruleY([0], { stroke: t.axis }),
                Plot.ruleX([S0], { stroke: t.muted, strokeDasharray: '3 3' }),
                Plot.text([S0], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => 'SPY', fill: t.muted }),
                Plot.line(data, { x: 'K', y: 'v', stroke: 'dte', strokeWidth: 2 }),
                Plot.tip(
                  data,
                  Plot.pointer({
                    x: 'K',
                    y: 'v',
                    stroke: 'dte',
                    title: (d: Row) => `${d.K} call, ${d.dte}\nVega $${d.vega.toFixed(0)} per contract\nPrice $${d.price.toFixed(2)}\n1 vol pt = ${((d.vega / 100 / d.price) * 100).toFixed(1)}% of price`,
                  }),
                ),
              ],
            })
          }
        />
      </div>
    </div>
  );
}
