import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { closes, fmt } from '../../../lib/snapshot';
import { realizedVol } from '../../../lib/pricing';
import { STRADDLE_IV, STRADDLE_MKT, straddleTheo } from './edgeData';

const RV_1Y = realizedVol(closes) * 100;
const RV_20 = realizedVol(closes.slice(-21)) * 100;
const VEGA = straddleTheo(STRADDLE_IV).vega;

/** E1: edge on one 770 straddle as a function of the volatility forecast. */
export default function StraddleEdgeLine() {
  const t = useTokens();
  const [f, setF] = useState(12.7);
  const curve = useMemo(() => {
    const out: { f: number; edge: number; approx: number }[] = [];
    for (let v = 6; v <= 26.001; v += 0.25) {
      out.push({ f: v, edge: (straddleTheo(v / 100).price - STRADDLE_MKT) * 100, approx: VEGA * (v - STRADDLE_IV * 100) * 100 });
    }
    return out;
  }, []);
  const cur = (straddleTheo(f / 100).price - STRADDLE_MKT) * 100;
  const approx = VEGA * (f - STRADDLE_IV * 100) * 100;

  return (
    <div className="viz-card not-content">
      <CardHead title="Edge on one 770 straddle vs your forecast" sub={`Market: ${fmt.usd(STRADDLE_MKT)} (call 13.90 + put 11.24), which is ${fmt.pct(STRADDLE_IV, 2)} implied`} />
      <Slider label="Your volatility forecast" value={f} min={6} max={26} step={0.1} onChange={setF} format={(v) => `${v.toFixed(1)}%`} />
      <div className="mt-3">
        <PlotFigure
          deps={[f]}
          minHeight={280}
          build={(width, tk) =>
            Plot.plot({
              width,
              height: 280,
              marginLeft: 56,
              marginRight: 12,
              marginBottom: 36,
              style: plotStyle(tk),
              x: { label: 'Volatility forecast (%)', domain: [6, 26] },
              y: { label: 'Edge, $ per straddle', grid: true, tickFormat: (d: number) => `${d < 0 ? '−' : ''}$${Math.abs(d).toLocaleString()}` },
              marks: [
                Plot.rectX([0], { x1: 6, x2: STRADDLE_IV * 100, fill: tk['loss-wash'] }),
                Plot.rectX([0], { x1: STRADDLE_IV * 100, x2: 26, fill: tk['profit-wash'] }),
                Plot.ruleY([0], { stroke: tk.axis }),
                Plot.ruleX([STRADDLE_IV * 100], { stroke: tk.put, strokeDasharray: '4 3' }),
                Plot.text([STRADDLE_IV * 100], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => 'implied', fill: tk.put }),
                Plot.ruleX([RV_1Y, RV_20], { stroke: tk.muted, strokeDasharray: '2 3' }),
                Plot.text([RV_20], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: -3, textAnchor: 'end', text: () => (width < 520 ? '20d' : '20d realized'), fill: tk.muted }),
                Plot.text([RV_1Y], { x: (d: number) => d, frameAnchor: 'top', dy: 18, dx: -3, textAnchor: 'end', text: () => (width < 520 ? '1y' : '1y realized'), fill: tk.muted }),
                Plot.line(curve, { x: 'f', y: 'approx', stroke: tk.muted, strokeDasharray: '5 4', strokeWidth: 1.5 }),
                Plot.line(curve, { x: 'f', y: 'edge', stroke: tk.stock, strokeWidth: 2.5 }),
                Plot.dot([{ f, edge: cur }], { x: 'f', y: 'edge', r: 5, fill: tk.stock, stroke: tk.surface, strokeWidth: 2 }),
                Plot.tip(curve, Plot.pointerX({ x: 'f', y: 'edge', title: (d: { f: number; edge: number; approx: number }) => `Forecast ${d.f.toFixed(2)}%\nFull reprice: ${d.edge < 0 ? '−' : '+'}$${Math.abs(d.edge).toFixed(0)}\nVega rule: ${d.approx < 0 ? '−' : '+'}$${Math.abs(d.approx).toFixed(0)}` })),
              ],
            })
          }
        />
      </div>
      <Legend
        items={[
          { label: 'Theoretical value − market price (full reprice)', color: t.stock },
          { label: 'Vega × (forecast − implied)', color: t.muted, kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          ['Theoretical value', fmt.usd(straddleTheo(f / 100).price), `at ${f.toFixed(1)}%`],
          ['Edge per straddle', `${cur < 0 ? '−' : '+'}$${Math.abs(cur).toFixed(0)}`, cur > 0 ? 'theoretically cheap' : 'theoretically rich', cur > 0 ? t.profit : t.loss],
          ['Edge in vol points', fmt.signed(f - STRADDLE_IV * 100, 2), 'forecast − implied'],
          ['Vega rule', `${approx < 0 ? '−' : '+'}$${Math.abs(approx).toFixed(0)}`, `vega ${VEGA.toFixed(2)} × 100 per point`],
        ]}
      />
    </div>
  );
}
