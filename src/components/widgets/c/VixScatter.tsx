import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';

const spyMap = new Map(snapshot.closes);
const common = snapshot.vix.filter(([d]) => spyMap.has(d));
type Pt = { date: string; spy: number; dv: number; vix: number };
const pts: Pt[] = common.slice(1).map(([d, v], i) => {
  const [d0, v0] = common[i];
  return { date: d, spy: (spyMap.get(d)! / spyMap.get(d0)! - 1) * 100, dv: v - v0, vix: v };
});

function fit(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  const b = sxy / sxx;
  return { b, a: my - b * mx, r: sxy / Math.sqrt(sxx * syy) };
}
const F = fit(pts.map((p) => p.spy), pts.map((p) => p.dv));
const opposite = pts.filter((p) => Math.sign(p.spy) !== Math.sign(p.dv)).length;
const up = pts.filter((p) => p.spy > 0);
const down = pts.filter((p) => p.spy <= 0);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** SPY daily % change vs VIX daily change in points, with a least-squares line. */
export default function VixScatter() {
  const t = useTokens();
  const [color, setColor] = useState<'flat' | 'level'>('flat');

  return (
    <div className="viz-card not-content">
      <CardHead
        title="When SPY falls, VIX jumps"
        sub={`Each dot is one day (${pts.length} days). Hover a dot for the date.`}
        right={
          <Segmented
            label="Color"
            value={color}
            onChange={setColor}
            options={[
              { value: 'flat', label: 'Plain' },
              { value: 'level', label: 'By VIX level' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[color]}
        minHeight={320}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 320,
            marginLeft: 44,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'SPY daily change (%)', domain: [-3, 3], tickFormat: (d: number) => `${d > 0 ? '+' : ''}${d}%`, grid: true },
            y: { label: 'VIX change (points)', domain: [-6, 7], grid: true },
            color: color === 'level' ? { type: 'linear', domain: [13, 31], range: [tk.call, tk.put], legend: true, label: 'VIX close' } : undefined,
            marks: [
              Plot.ruleX([0], { stroke: tk.axis }),
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.line(
                [
                  [-3, F.a - 3 * F.b],
                  [3, F.a + 3 * F.b],
                ],
                { stroke: tk.ink, strokeWidth: 2, strokeDasharray: '6 4' },
              ),
              Plot.dot(pts, {
                x: 'spy',
                y: 'dv',
                r: 3.5,
                fill: color === 'level' ? 'vix' : tk.call,
                fillOpacity: 0.65,
                stroke: tk.surface,
                strokeWidth: 0.6,
              }),
              Plot.tip(
                pts,
                Plot.pointer({
                  x: 'spy',
                  y: 'dv',
                  title: (d: Pt) => `${d.date}\nSPY ${d.spy >= 0 ? '+' : '−'}${Math.abs(d.spy).toFixed(2)}%\nVIX ${d.dv >= 0 ? '+' : '−'}${Math.abs(d.dv).toFixed(2)} to ${d.vix.toFixed(2)}`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          ...(color === 'flat' ? [{ label: 'One trading day', color: t.call, kind: 'dot' as const }] : []),
          { label: `Fit: VIX change ≈ −${Math.abs(F.b).toFixed(2)} × SPY % change`, color: t.ink, kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          ['Slope', `−${Math.abs(F.b).toFixed(2)} pts`, 'VIX points per 1% SPY move'],
          ['Correlation', `−${Math.abs(F.r).toFixed(2)}`, `R² ${(F.r * F.r).toFixed(2)}`],
          ['Moved opposite ways', `${((100 * opposite) / pts.length).toFixed(0)}%`, `${opposite} of ${pts.length} days`],
          ['VIX on SPY down days', `+${avg(down.map((p) => p.dv)).toFixed(2)} pts`, `−${Math.abs(avg(up.map((p) => p.dv))).toFixed(2)} on up days (average)`],
        ]}
      />
    </div>
  );
}
