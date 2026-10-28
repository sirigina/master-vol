import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { dates } from '../../../lib/snapshot';
import { stdev } from '../../../lib/pricing';
import { rng } from '../../../lib/position';
import { RET } from './volmath';

const sd = stdev(RET) * 100;

/** Absolute daily SPY moves in calendar order vs the same moves shuffled. */
export default function VolClustering() {
  const t = useTokens();
  const [order, setOrder] = useState<'real' | 'shuffled'>('real');
  const rows = useMemo(() => {
    const abs = RET.map((r) => Math.abs(r) * 100);
    let vals = abs;
    if (order === 'shuffled') {
      const u = rng(2026);
      vals = [...abs];
      for (let i = vals.length - 1; i > 0; i--) {
        const j = Math.floor(u() * (i + 1));
        [vals[i], vals[j]] = [vals[j], vals[i]];
      }
    }
    return vals.map((v, i) => ({ date: dates[i + 1], v, big: v > 2 * sd }));
  }, [order]);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Big days come in bunches"
        sub="Size of each daily SPY move (up or down), in date order. Shuffle the same days to see what no clustering would look like."
        right={
          <Segmented
            label="Order"
            value={order}
            onChange={setOrder}
            options={[
              { value: 'real', label: 'Real order' },
              { value: 'shuffled', label: 'Shuffled' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[order]}
        minHeight={240}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 240,
            marginLeft: 40,
            marginRight: 12,
            style: plotStyle(tk),
            x: { label: null, ticks: width < 520 ? 4 : 8, axis: order === 'real' ? 'bottom' : null },
            y: { label: '|daily move| %', grid: true, domain: [0, 3] },
            marks: [
              Plot.ruleX(rows, { x: 'date', y: 'v', stroke: (d: { big: boolean }) => (d.big ? tk.put : tk.call), strokeWidth: width < 520 ? 1.2 : 2 }),
              Plot.ruleY([2 * sd], { stroke: tk.put, strokeDasharray: '4 3' }),
              Plot.text([2 * sd], { y: (d: number) => d, frameAnchor: 'right', dy: -7, textAnchor: 'end', text: () => `2 SD (${(2 * sd).toFixed(2)}%)`, fill: tk.put }),
              Plot.ruleY([0], { stroke: tk.axis }),
              order === 'real'
                ? Plot.tip(rows, Plot.pointerX({ x: 'date', y: 'v', title: (d: { date: Date; v: number }) => `${d.date.toDateString().slice(4)}\n|move| ${d.v.toFixed(2)}%` }))
                : null,
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Ordinary day', color: t.call },
          { label: 'Beyond 2 SD', color: t.put },
        ]}
      />
      <p className="mt-2 text-[0.8rem] text-(--sl-color-gray-3)">
        {order === 'real'
          ? 'Real order: the big days bunch into late March to early April and into June. Quiet stretches are long and quiet.'
          : 'Shuffled: the same days scattered at random. Big days sprinkle evenly across the year; no calm or stormy seasons.'}
      </p>
    </div>
  );
}
