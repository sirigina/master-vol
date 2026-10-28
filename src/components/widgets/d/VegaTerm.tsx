import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';
import { S0, g, expLabel } from './common';

type Row = { label: string; dte: number; vega: number; pct: number; theta: number; iv: number; mark: number };
const rows: Row[] = snapshot.termStructure.map((p) => {
  const x = g('call', S0, 770, p.dte, p.callIv);
  return { label: expLabel(p.expiry), dte: p.dte, vega: x.vega * 100, pct: (x.vega / p.callMark) * 100, theta: x.theta * 100, iv: p.callIv, mark: p.callMark };
});

/** Vega of the real 770 call across the term structure. */
export default function VegaTerm() {
  const [unit, setUnit] = useState<'abs' | 'pct' | 'ratio'>('abs');
  const key = unit === 'abs' ? 'vega' : unit === 'pct' ? 'pct' : 'ratioV';
  const data = rows.map((r) => ({ ...r, ratioV: r.vega / -r.theta }));
  const yLabel = unit === 'abs' ? 'Vega ($ per contract per vol pt)' : unit === 'pct' ? 'Vega as % of price' : 'Vega ÷ daily theta';
  return (
    <div className="viz-card not-content">
      <CardHead
        title="Vega of the 770 call across real expiries"
        sub="Each expiry's vega at its own quoted call IV"
        right={
          <Segmented
            label="Measure"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'abs', label: '$ vega' },
              { value: 'pct', label: '% of price' },
              { value: 'ratio', label: 'Vega ÷ theta' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[unit]}
        minHeight={290}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 52,
            marginBottom: width < 520 ? 56 : 40,
            style: plotStyle(t),
            x: { label: null, domain: data.map((d) => d.label), tickRotate: width < 520 ? -45 : 0, padding: 0.25 },
            y: { label: yLabel, grid: true },
            marks: [
              Plot.barY(data, { x: 'label', y: key, fill: t.call, rx: 2 }),
              Plot.text(data, {
                x: 'label',
                y: key,
                dy: -7,
                text: (d: Row & { ratioV: number }) => (unit === 'abs' ? `$${d.vega.toFixed(0)}` : unit === 'pct' ? `${d.pct.toFixed(1)}%` : d.ratioV.toFixed(1)),
                fill: t['ink-2'],
                fontSize: width < 520 ? 9 : 10.5,
              }),
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.tip(
                data,
                Plot.pointerX({
                  x: 'label',
                  y: key,
                  title: (d: Row & { ratioV: number }) =>
                    `${d.label} · ${d.dte} days\nCall $${d.mark.toFixed(2)}, IV ${(d.iv * 100).toFixed(1)}%\nVega $${d.vega.toFixed(0)} per contract\n1 vol pt = ${d.pct.toFixed(1)}% of price\nTheta −$${(-d.theta).toFixed(0)} per day`,
                }),
              ),
            ],
          })
        }
      />
    </div>
  );
}
