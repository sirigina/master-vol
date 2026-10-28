import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { DRAWDOWN, FWD_H, SKEW_GAP, VIX_SERIES, shortVolBacktest } from './vixData';

const X_DOMAIN = [DRAWDOWN[0].date, DRAWDOWN[DRAWDOWN.length - 1].date];

/**
 * E4: VIX spikes, SPY drawdowns, and the result of a hedged short straddle
 * started on each day, to show when the short-volatility edge vanished.
 */
export default function ShortVolTimeline() {
  const t = useTokens();
  const [adj, setAdj] = useState<'raw' | 'adj'>('adj');
  const shift = adj === 'adj' ? SKEW_GAP : 0;
  const bt = useMemo(() => shortVolBacktest(shift), [shift]);
  const losing = bt.filter((d) => d.pnl < 0);
  const avg = bt.reduce((a, d) => a + d.volPts, 0) / bt.length;
  const worst = bt.reduce((a, d) => (d.volPts < a.volPts ? d : a));
  const fmtD = (d: Date) => d.toDateString().slice(4, 10);

  const common = (width: number, tk: Parameters<typeof plotStyle>[0], height: number, extra: Record<string, unknown>) => ({
    width,
    height,
    marginLeft: 44,
    marginRight: 10,
    style: plotStyle(tk),
    x: { domain: X_DOMAIN, label: null, ...((extra.x as object) ?? {}) },
    ...extra,
  });

  return (
    <div className="viz-card not-content">
      <CardHead
        title="When did short volatility stop paying?"
        sub={`VIX, SPY's drawdown from its high, and a hedged short straddle opened each day for ${FWD_H} sessions`}
        right={
          <Segmented
            label="Straddle priced at"
            value={adj}
            onChange={setAdj}
            options={[
              { value: 'adj', label: `VIX − ${SKEW_GAP.toFixed(1)} (ATM-like)` },
              { value: 'raw', label: 'VIX as quoted' },
            ]}
          />
        }
      />
      <div className="text-[0.78rem] font-semibold text-(--sl-color-gray-2)">VIX</div>
      <PlotFigure
        deps={[]}
        minHeight={130}
        build={(width, tk) =>
          Plot.plot(
            common(width, tk, 130, {
              marginBottom: 8,
              x: { domain: X_DOMAIN, axis: null },
              y: { label: null, grid: true, domain: [10, 32], ticks: 4 },
              marks: [
                Plot.ruleY([20], { stroke: tk.muted, strokeDasharray: '3 3' }),
                Plot.areaY(VIX_SERIES, { x: 'date', y1: 20, y2: (d: { vix: number }) => Math.max(d.vix, 20), fill: tk.put, fillOpacity: 0.25 }),
                Plot.lineY(VIX_SERIES, { x: 'date', y: 'vix', stroke: tk.put, strokeWidth: 1.6 }),
                Plot.tip(VIX_SERIES, Plot.pointerX({ x: 'date', y: 'vix', title: (d: { date: Date; vix: number }) => `${d.date.toDateString().slice(4)}\nVIX ${d.vix.toFixed(2)}` })),
              ],
            }),
          )
        }
      />
      <div className="mt-1 text-[0.78rem] font-semibold text-(--sl-color-gray-2)">SPY drawdown from its running high</div>
      <PlotFigure
        deps={[]}
        minHeight={120}
        build={(width, tk) =>
          Plot.plot(
            common(width, tk, 120, {
              marginBottom: 8,
              x: { domain: X_DOMAIN, axis: null },
              y: { label: null, grid: true, domain: [-10, 0], ticks: 3, tickFormat: (d: number) => `${d}%` },
              marks: [
                Plot.areaY(DRAWDOWN, { x: 'date', y: 'dd', fill: tk.stock, fillOpacity: 0.25 }),
                Plot.lineY(DRAWDOWN, { x: 'date', y: 'dd', stroke: tk.stock, strokeWidth: 1.4 }),
                Plot.tip(DRAWDOWN, Plot.pointerX({ x: 'date', y: 'dd', title: (d: { date: Date; close: number; dd: number }) => `${d.date.toDateString().slice(4)}\nSPY ${d.close.toFixed(2)}\nDrawdown ${d.dd.toFixed(1)}%` })),
              ],
            }),
          )
        }
      />
      <div className="mt-1 text-[0.78rem] font-semibold text-(--sl-color-gray-2)">Hedged short straddle opened that day: result in vol points</div>
      <PlotFigure
        deps={[adj]}
        minHeight={170}
        build={(width, tk) =>
          Plot.plot(
            common(width, tk, 170, {
              marginBottom: 26,
              x: { domain: X_DOMAIN, ticks: width < 520 ? 4 : 8 },
              y: { label: null, grid: true, domain: [-9, 15], ticks: 5, tickFormat: (d: number) => `${d > 0 ? '+' : ''}${d}` },
              marks: [
                Plot.ruleY([0], { stroke: tk.axis }),
                Plot.rectY(bt, { x: 'date', interval: 'day', y: 'volPts', fill: (d: { pnl: number }) => (d.pnl >= 0 ? tk.profit : tk.loss), inset: 0 }),
                Plot.tip(
                  bt,
                  Plot.pointerX({
                    x: 'date',
                    y: 'volPts',
                    title: (d: { date: Date; iv: number; pnl: number; volPts: number }) =>
                      `Opened ${d.date.toDateString().slice(4)} at ${d.iv.toFixed(1)}%\nResult ${d.volPts >= 0 ? '+' : ''}${d.volPts.toFixed(1)} vol pts\n${d.pnl >= 0 ? '+' : '−'}$${Math.abs(d.pnl).toFixed(0)} per straddle`,
                  }),
                ),
              ],
            }),
          )
        }
      />
      <Legend
        items={[
          { label: 'VIX above 20', color: t.put, kind: 'box' },
          { label: 'SPY below its high', color: t.stock, kind: 'box' },
          { label: 'Short straddle made money', color: t.profit, kind: 'box' },
          { label: 'Short straddle lost money', color: t.loss, kind: 'box' },
        ]}
      />
      <StatGrid
        items={[
          ['Losing start dates', `${losing.length} of ${bt.length}`, `${((100 * losing.length) / bt.length).toFixed(0)}%`],
          ['Average result', `${avg >= 0 ? '+' : '−'}${Math.abs(avg).toFixed(1)} pts`, 'P/L ÷ starting vega'],
          ['Worst start', fmtD(worst.date), `${worst.volPts.toFixed(1)} pts, opened at ${worst.iv.toFixed(1)}%`],
          ['Deepest drawdown', 'Mar 30', '−9.1% from Jan 27 high'],
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Each bar: sell one at-the-money straddle with {FWD_H} sessions to run, priced at the chosen implied vol, delta-hedge at every close, hold to
        expiry. Zero rates, no costs, closes only, so overnight gaps hit the hedge in full. A rough sketch, not a backtest of a tradable strategy.
      </p>
    </div>
  );
}
