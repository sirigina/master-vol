import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';
import { expLabel } from './common';

const TS = snapshot.termStructure;
const REF = TS.find((p) => p.dte === snapshot.chain.dte)!;
type Pt = { dte: number; straddle: number; expiry: string; iv: number; root: number };
const pts: Pt[] = TS.map((p) => ({ dte: p.dte, straddle: p.straddle, expiry: p.expiry, iv: p.atmIv, root: REF.straddle * Math.sqrt(p.dte / REF.dte) }));

/** Real 770 straddle prices by expiry vs a square-root-of-time curve through Nov 27. */
export default function StraddleTerm() {
  const [range, setRange] = useState<'near' | 'all'>('near');
  const shown = range === 'near' ? pts.filter((p) => p.dte <= 90) : pts;
  const maxD = range === 'near' ? 85 : 420;
  const curve = Array.from({ length: 200 }, (_, i) => {
    const d = (maxD * i) / 199;
    return { dte: d, v: REF.straddle * Math.sqrt(d / REF.dte) };
  });
  return (
    <div className="viz-card not-content">
      <CardHead
        title="Real 770 straddle prices by expiry vs a √time curve"
        sub="Dots: market straddle (call + put mid). Dashed: the Nov 27 straddle scaled by √(days / 31)."
        right={
          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: 'near', label: 'Next 3 months' },
              { value: 'all', label: 'All expiries' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[range]}
        minHeight={290}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 48,
            marginBottom: 40,
            marginRight: 16,
            style: plotStyle(t),
            x: { label: 'Days to expiry', domain: [0, maxD] },
            y: { label: 'Straddle price ($)', grid: true, domain: [0, Math.max(...shown.map((p) => p.straddle)) * 1.1] },
            marks: [
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.line(curve, { x: 'dte', y: 'v', stroke: t.muted, strokeWidth: 1.8, strokeDasharray: '6 4' }),
              Plot.dot(shown, { x: 'dte', y: 'straddle', r: 5.5, fill: t.put, stroke: t.surface, strokeWidth: 2 }),
              Plot.text(shown, {
                x: 'dte',
                y: 'straddle',
                text: (d: Pt) => expLabel(d.expiry),
                dy: -12,
                fill: t['ink-2'],
                fontSize: 10,
                filter: (d: Pt) => (width < 520 ? [10, 31, 80, 143, 416].includes(d.dte) : true),
              }),
              Plot.tip(
                shown,
                Plot.pointer({
                  x: 'dte',
                  y: 'straddle',
                  title: (d: Pt) =>
                    `${expLabel(d.expiry, true)} · ${d.dte} days\nStraddle $${d.straddle.toFixed(2)}\n√t curve $${d.root.toFixed(2)}\nATM IV ${(d.iv * 100).toFixed(1)}%`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Market 770 straddle', color: 'var(--viz-put)', kind: 'dot' },
          { label: `$${REF.straddle.toFixed(2)} × √(days / 31)`, color: 'var(--viz-muted)', kind: 'dash' },
        ]}
      />
    </div>
  );
}
