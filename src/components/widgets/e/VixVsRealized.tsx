import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { FWD_H, SKEW_GAP, VIX_FWD } from './vixData';

const H = FWD_H;

export default function VixVsRealized() {
  const t = useTokens();
  const [adj, setAdj] = useState<'raw' | 'adj'>('raw');
  const shift = adj === 'adj' ? SKEW_GAP : 0;
  const data = useMemo(() => VIX_FWD.map((d) => ({ ...d, iv: d.vix - shift, hi: Math.max(d.vix - shift, d.rv) })), [shift]);
  const above = data.filter((d) => d.iv > d.rv).length;
  const mean = data.reduce((a, d) => a + d.iv - d.rv, 0) / data.length;
  const worst = data.reduce((a, d) => (d.iv - d.rv < a.iv - a.rv ? d : a));
  const best = data.reduce((a, d) => (d.iv - d.rv > a.iv - a.rv ? d : a));

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Implied vs the volatility that followed"
        sub={`Each day: VIX that day, and SPY's realized volatility over the next ${H} sessions`}
        right={
          <Segmented
            label="Implied measure"
            value={adj}
            onChange={setAdj}
            options={[
              { value: 'raw', label: 'VIX as quoted' },
              { value: 'adj', label: `VIX − ${SKEW_GAP.toFixed(1)} (ATM-like)` },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[adj]}
        minHeight={290}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 40,
            marginRight: 10,
            style: plotStyle(tk),
            x: { label: null },
            y: { label: 'Annualized %', grid: true, domain: [0, 34] },
            marks: [
              Plot.areaY(data, { x: 'date', y1: 'rv', y2: 'hi', fill: tk['profit-wash'], curve: 'step' }),
              Plot.areaY(data, { x: 'date', y1: 'iv', y2: 'hi', fill: tk['loss'], fillOpacity: 0.35, curve: 'step' }),
              Plot.lineY(data, { x: 'date', y: 'iv', stroke: tk.put, strokeWidth: 1.8 }),
              Plot.lineY(data, { x: 'date', y: 'rv', stroke: tk.call, strokeWidth: 1.8 }),
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.tip(
                data,
                Plot.pointerX({
                  x: 'date',
                  y: 'iv',
                  title: (d: { date: Date; iv: number; rv: number }) =>
                    `${d.date.toDateString().slice(4)}\nImplied: ${d.iv.toFixed(1)}%\nNext ${H}d realized: ${d.rv.toFixed(1)}%\nGap: ${(d.iv - d.rv).toFixed(1)} pts`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: adj === 'raw' ? 'VIX (30-day implied, S&P 500)' : 'VIX minus today’s skew gap', color: t.put },
          { label: `SPY realized, next ${H} sessions`, color: t.call },
          { label: 'Implied above realized', color: t['profit-wash'], kind: 'box' },
          { label: 'Realized above implied', color: t.loss, kind: 'box' },
        ]}
      />
      <StatGrid
        items={[
          ['Days implied > realized', `${above} of ${data.length}`, `${((100 * above) / data.length).toFixed(0)}%`],
          ['Average gap', `${mean.toFixed(1)} pts`, 'implied − realized'],
          ['Worst start date', worst.date.toDateString().slice(4), `${(worst.iv - worst.rv).toFixed(1)} pts`],
          ['Largest gap', best.date.toDateString().slice(4), `${(best.iv - best.rv).toFixed(1)} pts`],
        ]}
      />
    </div>
  );
}
