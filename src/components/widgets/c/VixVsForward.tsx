import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { vixVsForward } from './volmath';

const data = vixVsForward(21);
const pos = data.filter((d) => d.prem > 0).length;
const meanPrem = data.reduce((a, d) => a + d.prem, 0) / data.length;
const meanVix = data.reduce((a, d) => a + d.vix, 0) / data.length;
const meanFwd = data.reduce((a, d) => a + d.fwd, 0) / data.length;
const flips = data.filter((d) => d.prem < 0);
const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** VIX on each day vs the SPY volatility that actually followed over the next 21 sessions. */
export default function VixVsForward() {
  const t = useTokens();
  const [view, setView] = useState<'levels' | 'gap'>('levels');

  return (
    <div className="viz-card not-content">
      <CardHead
        title="The forecast vs the weather that followed"
        sub="Each day: VIX (implied) against SPY's realized volatility over the next 21 trading days"
        right={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'levels', label: 'Both lines' },
              { value: 'gap', label: 'The gap' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[view]}
        minHeight={290}
        build={(width, tk) =>
          view === 'levels'
            ? Plot.plot({
                width,
                height: 290,
                marginLeft: 40,
                marginRight: 14,
                style: plotStyle(tk),
                x: { label: null, ticks: width < 520 ? 4 : 8 },
                y: { label: 'Annualized %', grid: true, domain: [0, 34] },
                marks: [
                  Plot.differenceY(data, {
                    x: 'date',
                    y1: 'fwd',
                    y2: 'vix',
                    positiveFill: tk.call,
                    negativeFill: tk.loss,
                    fillOpacity: 0.16,
                    negativeFillOpacity: 0.5,
                    stroke: tk.call,
                    strokeWidth: 2,
                  }),
                  Plot.lineY(data, { x: 'date', y: 'fwd', stroke: tk.put, strokeWidth: 2 }),
                  Plot.ruleY([0], { stroke: tk.axis }),
                  Plot.tip(
                    data,
                    Plot.pointerX({
                      x: 'date',
                      y: 'vix',
                      title: (d: (typeof data)[0]) =>
                        `${d.date.toDateString().slice(4)}\nVIX ${d.vix.toFixed(1)}\nNext 21 days realized ${d.fwd.toFixed(1)}%\nGap ${d.prem >= 0 ? '+' : '−'}${Math.abs(d.prem).toFixed(1)} pts`,
                    }),
                  ),
                ],
              })
            : Plot.plot({
                width,
                height: 290,
                marginLeft: 40,
                marginRight: 14,
                style: plotStyle(tk),
                x: { label: null, ticks: width < 520 ? 4 : 8 },
                y: { label: 'VIX minus realized (vol points)', grid: true },
                marks: [
                  Plot.rectY(data, {
                    x1: (d: (typeof data)[0]) => d.date,
                    x2: (d: (typeof data)[0]) => new Date(d.date.getTime() + 86400000),
                    y: 'prem',
                    fill: (d: (typeof data)[0]) => (d.prem >= 0 ? tk.call : tk.loss),
                  }),
                  Plot.ruleY([0], { stroke: tk.ink }),
                  Plot.ruleY([meanPrem], { stroke: tk.muted, strokeDasharray: '4 3' }),
                  Plot.text([meanPrem], { y: (d: number) => d, frameAnchor: 'right', dy: -7, textAnchor: 'end', text: () => `average +${meanPrem.toFixed(1)}`, fill: tk['ink-2'], stroke: tk.surface, strokeWidth: 3, paintOrder: 'stroke' }),
                  Plot.tip(data, Plot.pointerX({ x: 'date', y: 'prem', title: (d: (typeof data)[0]) => `${d.date.toDateString().slice(4)}\nGap ${d.prem >= 0 ? '+' : '−'}${Math.abs(d.prem).toFixed(1)} pts` })),
                ],
              })
        }
      />
      <Legend
        items={
          view === 'levels'
            ? [
                { label: 'VIX on the day (implied)', color: t.call },
                { label: 'SPY realized over the next 21 sessions', color: t.put },
                { label: 'VIX below what followed', color: t.loss, kind: 'box' },
              ]
            : [
                { label: 'VIX above realized (premium)', color: t.call, kind: 'box' },
                { label: 'VIX below realized', color: t.loss, kind: 'box' },
              ]
        }
      />
      <StatGrid
        items={[
          ['VIX above what followed', `${pos} of ${data.length} days`, `${((100 * pos) / data.length).toFixed(0)}% of the time`],
          ['Average gap', `+${meanPrem.toFixed(1)} pts`, `VIX ${meanVix.toFixed(1)} vs ${meanFwd.toFixed(1)}% realized`],
          ['Flipped (VIX too low)', `${flips.length} days`, `${fmtD(flips[0].date)} to ${fmtD(flips[flips.length - 1].date)}`],
          ['Last day with a full 21', fmtD(data[data.length - 1].date), 'later days lack a full window'],
        ]}
      />
    </div>
  );
}
