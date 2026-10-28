import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { closes, dates } from '../../../lib/snapshot';
import { rollingVol } from '../../../lib/pricing';

const WINDOWS = [10, 20, 60, 120] as const;
type W = (typeof WINDOWS)[number];

/** SPY historical volatility over several look-back windows at once. */
export default function HistVolWindows() {
  const t = useTokens();
  const [on, setOn] = useState<Record<W, boolean>>({ 10: true, 20: true, 60: true, 120: true });
  const colors: Record<W, string> = { 10: t.aqua, 20: t.call, 60: t.put, 120: t.stock };

  const series = useMemo(
    () =>
      WINDOWS.flatMap((w) =>
        rollingVol(closes, w)
          .map((v, i) => ({ date: dates[i], v: v === null ? null : v * 100, w: `${w}-day` }))
          .filter((d) => d.v !== null),
      ),
    [],
  );
  const last = WINDOWS.map((w) => ({ w, v: series.filter((d) => d.w === `${w}-day`).at(-1)!.v! }));
  const active = series.filter((d) => on[+d.w.split('-')[0] as W]);

  return (
    <div className="viz-card not-content">
      <CardHead title="SPY historical volatility, four look-back windows" sub="Annualized standard deviation of daily log returns over the trailing window. Toggle windows on and off." />
      <div className="mb-2 flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            aria-pressed={on[w]}
            onClick={() => setOn((o) => ({ ...o, [w]: !o[w] }))}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-(--sl-color-hairline-shade) bg-transparent px-2.5 py-1 text-[0.8rem] font-medium text-(--sl-color-gray-2)"
            style={{ opacity: on[w] ? 1 : 0.45 }}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colors[w] }} />
            {w}-day <span className="tabular-nums text-(--sl-color-gray-3)">now {last.find((l) => l.w === w)!.v.toFixed(1)}%</span>
          </button>
        ))}
      </div>
      <PlotFigure
        deps={[on]}
        minHeight={290}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 40,
            marginRight: 14,
            style: plotStyle(tk),
            x: { label: null, ticks: width < 520 ? 4 : 8 },
            y: { label: 'Annualized %', grid: true, domain: [0, 30] },
            color: { domain: WINDOWS.map((w) => `${w}-day`), range: WINDOWS.map((w) => colors[w]) },
            marks: [
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.lineY(active, { x: 'date', y: 'v', stroke: 'w', strokeWidth: (d: { w: string }) => (d.w === '120-day' || d.w === '60-day' ? 2.2 : 1.5) }),
              Plot.tip(
                active,
                Plot.pointerX({
                  x: 'date',
                  y: 'v',
                  stroke: 'w',
                  title: (d: { date: Date; v: number; w: string }) => `${d.date.toDateString().slice(4)}\n${d.w}: ${d.v.toFixed(1)}%`,
                }),
              ),
            ],
          })
        }
      />
      <Legend items={WINDOWS.filter((w) => on[w]).map((w) => ({ label: `${w}-day window`, color: colors[w] }))} />
    </div>
  );
}
