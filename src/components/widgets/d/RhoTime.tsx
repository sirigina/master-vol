import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid, Legend } from '../../ui/Stats';
import { S0, VOL0, g } from './common';
import { snapshot } from '../../../lib/snapshot';

type Row = { d: number; v: number; right: string };
const MAXD = 730;

/** Rho of the 770 call and put vs days to expiry. */
export default function RhoTime() {
  const [vol, setVol] = useState(VOL0);
  const sigma = vol / 100;
  const data = useMemo(() => {
    const out: Row[] = [];
    for (let d = 1; d <= MAXD; d += 3) {
      out.push({ d, v: g('call', S0, 770, d, sigma).rho * 100, right: '770 call' });
      out.push({ d, v: g('put', S0, 770, d, sigma).rho * 100, right: '770 put' });
    }
    return out;
  }, [sigma]);
  // Stat cards use each expiry's quoted IVs (not the slider) so they match the real chain.
  const marks = [31, 416].map((d) => {
    const q = snapshot.termStructure.find((p) => p.dte === d)!;
    return { d, c: g('call', S0, 770, d, q.callIv), p: g('put', S0, 770, d, q.putIv) };
  });

  return (
    <div className="viz-card not-content">
      <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_15rem] sm:items-end">
        <CardHead title="Rho of the 770 strike vs time to expiry" sub={`Model illustration: SPY ${S0}, rate 4.6%, no dividend. Per contract, for a 1-point rate change.`} />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <PlotFigure
        deps={[data]}
        minHeight={280}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 280,
            marginLeft: 56,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Days to expiry', domain: [0, MAXD] },
            y: { label: 'Rho ($ per contract per 1% rate)', grid: true },
            color: { domain: ['770 call', '770 put'], range: [t.call, t.put] },
            marks: [
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.ruleX([31, 416], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([31, 416], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: (d: number) => (d === 31 ? 'Nov 27' : "Dec '27"), fill: t.muted }),
              Plot.line(data, { x: 'd', y: 'v', stroke: 'right', strokeWidth: 2 }),
              Plot.tip(data, Plot.pointer({ x: 'd', y: 'v', stroke: 'right', title: (d: Row) => `${d.right}, ${d.d} days\nRho ${d.v >= 0 ? '+' : '−'}$${Math.abs(d.v).toFixed(0)} per contract` })),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: '770 call', color: 'var(--viz-call)' },
          { label: '770 put', color: 'var(--viz-put)' },
        ]}
      />
      <StatGrid
        items={[
          ['Nov 27 call rho', `+$${(marks[0].c.rho * 100).toFixed(0)}`, '31 days, at quoted IV'],
          ['Nov 27 put rho', `−$${Math.abs(marks[0].p.rho * 100).toFixed(0)}`, '31 days, at quoted IV'],
          ["Dec '27 call rho", `+$${(marks[1].c.rho * 100).toFixed(0)}`, '416 days, at quoted IV', 'var(--viz-call)'],
          ["Dec '27 put rho", `−$${Math.abs(marks[1].p.rho * 100).toFixed(0)}`, '416 days, at quoted IV', 'var(--viz-put)'],
        ]}
      />
    </div>
  );
}
