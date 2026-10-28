import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { S0, IV0, VOL0, K0, g } from './common';

const DTES = [31, 10, 2] as const;
type Row = { S: number; gamma: number; dte: string };

/** Gamma of the 770 strike across SPY prices at several days to expiry. */
export default function GammaCurves() {
  const [vol, setVol] = useState(VOL0);
  const sigma = vol / 100;
  const data = useMemo(() => {
    const out: Row[] = [];
    for (const d of DTES) for (let S = 720; S <= 820; S += 0.5) out.push({ S, gamma: g('call', S, K0, d, sigma).gamma, dte: `${d} days left` });
    return out;
  }, [sigma]);
  const at = DTES.map((d) => g('call', S0, K0, d, sigma).gamma);
  const yMax = Math.max(...data.map((d) => d.gamma)) * 1.08;

  return (
    <div className="viz-card not-content">
      <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_16rem] sm:items-end">
        <CardHead title="Gamma of the 770 strike vs SPY price" sub="Model curves (call and put gamma are identical). Hover to read a value." />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <PlotFigure
        deps={[data]}
        minHeight={300}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 52,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'SPY price', domain: [720, 820] },
            y: { label: 'Gamma (delta change per $1)', grid: true, domain: [0, yMax], tickFormat: (d: number) => d.toFixed(3) },
            color: { domain: DTES.map((d) => `${d} days left`), range: [t.call, t.aqua, t.put], legend: true },
            marks: [
              Plot.ruleX([K0], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([K0], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => 'strike 770', fill: t.muted }),
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.line(data, { x: 'S', y: 'gamma', stroke: 'dte', strokeWidth: 2 }),
              Plot.tip(data, Plot.pointer({ x: 'S', y: 'gamma', stroke: 'dte', title: (d: Row) => `SPY ${d.S.toFixed(1)}\n${d.dte}\nGamma ${d.gamma.toFixed(4)}` })),
            ],
          })
        }
      />
      <StatGrid
        cols={3}
        items={DTES.map((d, i) => [
          `Gamma at SPY ${S0}, ${d}d`,
          at[i].toFixed(4),
          `delta moves ${(at[i] * 5).toFixed(2)} on a $5 move`,
        ])}
      />
    </div>
  );
}
