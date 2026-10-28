import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { BOOKS, S0, bookGreeks, bookPnl, sgn0 } from './hlib';

const KEYS = ['shortStrangle', 'shortPut', 'ironCondor', 'longStraddle', 'calendar'];

/** H3: why Greeks are local. Taylor estimates vs full reprice across big moves. */
export default function GreeksVsReprice() {
  const t = useTokens();
  const [book, setBook] = useState('shortStrangle');
  const [dv, setDv] = useState(0);
  const legs = BOOKS[book].legs;
  const g = useMemo(() => bookGreeks(legs), [book]);

  const data = useMemo(() => {
    const out: { m: number; v: number; s: string }[] = [];
    for (let m = -10; m <= 10.001; m += 0.25) {
      const dS = (S0 * m) / 100;
      const full = bookPnl(legs, { S: S0 + dS, volPts: dv });
      const d1 = g.delta * dS + g.vega * dv;
      const d2 = d1 + 0.5 * g.gamma * dS * dS;
      out.push({ m, v: full, s: 'Full reprice' }, { m, v: d2, s: 'Delta + gamma + vega' }, { m, v: d1, s: 'Delta + vega only' });
    }
    return out;
  }, [book, dv]);

  const at = (m: number, s: string) => data.find((d) => Math.abs(d.m - m) < 1e-9 && d.s === s)!.v;
  const err = (m: number) => at(m, 'Delta + gamma + vega') - at(m, 'Full reprice');
  const names = ['Full reprice', 'Delta + gamma + vega', 'Delta + vega only'];

  return (
    <div className="viz-card not-content">
      <CardHead title="Greeks are local: estimate vs full reprice" sub="Instant move in SPY (no time passes), optional parallel IV shift. Dollars for the whole position." />
      <Segmented label="Position" value={book} onChange={setBook} options={KEYS.map((k) => ({ value: k, label: BOOKS[k].label }))} />
      <Slider className="mt-3 sm:w-80" label="IV change at the same time" value={dv} min={-4} max={10} step={1} onChange={setDv} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} vol pts`} />
      <PlotFigure
        deps={[data]}
        minHeight={320}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 320,
            marginLeft: 62,
            marginBottom: 38,
            style: plotStyle(tk),
            x: { label: 'SPY move (%)', domain: [-10, 10], tickFormat: (d: number) => `${d > 0 ? '+' : ''}${d}%` },
            y: { label: 'P/L ($)', grid: true, tickFormat: (d: number) => `${d < 0 ? '−' : ''}$${Math.abs(d).toLocaleString()}` },
            color: { domain: names, range: [tk.ink, tk.call, tk.put] },
            marks: [
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.ruleX([0], { stroke: tk.axis }),
              Plot.areaY(
                MOVES_FOR_AREA.map((m) => ({ m, lo: Math.min(at(m, names[0]), at(m, names[1])), hi: Math.max(at(m, names[0]), at(m, names[1])) })),
                { x: 'm', y1: 'lo', y2: 'hi', fill: tk.call, fillOpacity: 0.14 },
              ),
              Plot.line(data.filter((d) => d.s === names[2]), { x: 'm', y: 'v', stroke: tk.put, strokeWidth: 1.75, strokeDasharray: '5 4' }),
              Plot.line(data.filter((d) => d.s === names[1]), { x: 'm', y: 'v', stroke: tk.call, strokeWidth: 1.75 }),
              Plot.line(data.filter((d) => d.s === names[0]), { x: 'm', y: 'v', stroke: tk.ink, strokeWidth: 2.5 }),
              Plot.tip(
                data.filter((d) => d.s === names[0]),
                Plot.pointerX({
                  x: 'm',
                  y: 'v',
                  title: (d: { m: number }) =>
                    `SPY ${d.m > 0 ? '+' : ''}${d.m.toFixed(2)}%\nFull reprice ${sgn0(at(d.m, names[0]))}\nΔ+Γ+vega ${sgn0(at(d.m, names[1]))}\nΔ+vega ${sgn0(at(d.m, names[2]))}`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Full reprice (Black-Scholes)', color: t.ink },
          { label: 'Delta + gamma + vega estimate', color: t.call },
          { label: 'Delta + vega only', color: t.put, kind: 'dash' },
          { label: 'Error of the gamma estimate', color: t['band-1'], kind: 'box' },
        ]}
      />
      <StatGrid
        cols={4}
        items={[
          ['Error at −2%', sgn0(err(-2)), 'estimate − reprice'],
          ['Error at −5%', sgn0(err(-5))],
          ['Error at −10%', sgn0(err(-10))],
          ['Error at +10%', sgn0(err(10))],
        ]}
      />
    </div>
  );
}

const MOVES_FOR_AREA = Array.from({ length: 81 }, (_, i) => -10 + i * 0.25);
