import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { impliedDensity } from './volmath';

/**
 * Lognormal at ATM vol vs the density implied by the Nov 27 smile
 * (Breeden-Litzenberger on a smoothed fit). Illustrative.
 */
export default function ImpliedDistribution() {
  const t = useTokens();
  const D = useMemo(() => impliedDensity(), []);
  const [k, setK] = useState(720);
  const pS = D.cdf(k, 'skew');
  const pF = D.cdf(k, 'flat');
  const rows = D.pts.filter((p) => p.x >= 600 && p.x <= 880);
  const peak = Math.max(...rows.map((p) => Math.max(p.skew, p.flat)));
  const modeS = D.pts.reduce((a, b) => (b.skew > a.skew ? b : a)).x;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="What the smile says about the distribution"
        sub="Illustrative: SPY on Nov 27 under a lognormal at ATM vol vs the shape implied by the smile (smoothed fit of the quoted IVs)."
      />
      <Slider label="Probability SPY finishes below" value={k} min={640} max={800} step={5} onChange={setK} format={(v) => `$${v}`} />
      <PlotFigure
        deps={[k]}
        minHeight={290}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 14,
            marginRight: 14,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'SPY on Nov 27', domain: [600, 880], tickFormat: (d: number) => `$${d}`, ticks: width < 520 ? 4 : 8 },
            y: { axis: null, domain: [0, peak * 1.1] },
            marks: [
              Plot.areaY(rows.filter((p) => p.x <= k), { x: 'x', y: 'skew', fill: tk.put, fillOpacity: 0.22 }),
              Plot.line(rows, { x: 'x', y: 'flat', stroke: tk.call, strokeWidth: 2, strokeDasharray: '6 4' }),
              Plot.line(rows, { x: 'x', y: 'skew', stroke: tk.put, strokeWidth: 2.4 }),
              Plot.ruleX([k], { stroke: tk.ink, strokeWidth: 1.5 }),
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.text(['fatter left tail'], { x: 675, y: peak * 0.12, dy: -8, text: (d: string) => d, fill: tk.put, fontWeight: 600 }),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: `Lognormal at ATM vol (${(D.atm * 100).toFixed(1)}%)`, color: t.call, kind: 'dash' },
          { label: 'Shape implied by the smile', color: t.put },
        ]}
      />
      <StatGrid
        items={[
          [`P(below $${k}), smile`, `${(pS * 100).toFixed(1)}%`, undefined, t.put],
          [`P(below $${k}), lognormal`, `${(pF * 100).toFixed(1)}%`, undefined, t.call],
          ['Ratio', pF > 0.0005 ? `${(pS / pF).toFixed(1)}×` : 'very large', 'smile vs flat-vol model'],
          ['Peak of smile shape', `$${modeS.toFixed(0)}`, 'above spot: small rises are the likeliest outcome'],
        ]}
      />
    </div>
  );
}
