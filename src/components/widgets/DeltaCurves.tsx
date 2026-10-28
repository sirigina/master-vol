import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from './PlotFigure';
import { Slider } from '../ui/Slider';
import { Segmented } from '../ui/Segmented';
import { snapshot, atmIv } from '../../lib/snapshot';
import { bs } from '../../lib/pricing';

const K = 770;
const DTES = [31, 10, 2] as const;

export default function DeltaCurves() {
  const [vol, setVol] = useState(Math.round(atmIv * 1000) / 10);
  const [right, setRight] = useState<'call' | 'put'>('call');

  const data = useMemo(() => {
    const out: { S: number; delta: number; dte: string }[] = [];
    for (const d of DTES) {
      for (let S = 700; S <= 840; S += 1) {
        const g = bs(right, { S, K, T: d / 365, r: snapshot.rate, sigma: vol / 100 });
        out.push({ S, delta: g.delta, dte: `${d} days left` });
      }
    }
    return out;
  }, [vol, right]);

  const now = bs(right, { S: snapshot.spot, K, T: 31 / 365, r: snapshot.rate, sigma: vol / 100 }).delta;

  return (
    <div className="viz-card not-content">
      <div className="mb-3 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <Segmented
          label="Option type"
          value={right}
          onChange={setRight}
          options={[
            { value: 'call', label: '770 call' },
            { value: 'put', label: '770 put' },
          ]}
        />
        <Slider label="Volatility" value={vol} min={5} max={45} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <PlotFigure
        deps={[data]}
        minHeight={300}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 46,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'SPY price', domain: [700, 840] },
            y: { label: 'Delta', grid: true, domain: right === 'call' ? [0, 1] : [-1, 0] },
            color: { domain: DTES.map((d) => `${d} days left`), range: [t.call, t.aqua, t.put], legend: true },
            marks: [
              Plot.ruleX([K], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([K], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => 'strike 770', fill: t.muted }),
              Plot.ruleY([right === 'call' ? 0.5 : -0.5], { stroke: t.grid, strokeWidth: 1.5 }),
              Plot.line(data, { x: 'S', y: 'delta', stroke: 'dte', strokeWidth: 2 }),
              Plot.dot([{ S: snapshot.spot, delta: now }], { x: 'S', y: 'delta', r: 5, fill: t.ink, stroke: t.surface, strokeWidth: 2 }),
              Plot.tip(data, Plot.pointer({ x: 'S', y: 'delta', stroke: 'dte', title: (d: { S: number; delta: number; dte: string }) => `SPY ${d.S}\n${d.dte}\nDelta ${d.delta.toFixed(2)}` })),
            ],
          })
        }
      />
      <p className="mt-2 text-[0.8rem] text-(--sl-color-gray-3)">
        Black dot: the snapshot, SPY {snapshot.spot}, {snapshot.chain.dte} days left, delta {now.toFixed(2)}. Drag volatility down and watch the curves steepen.
      </p>
    </div>
  );
}
