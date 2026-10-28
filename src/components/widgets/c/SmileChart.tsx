import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { smile, skewMetrics, type SmilePt } from './volmath';

type Axis = 'strike' | 'money' | 'delta';
type Exp = 'nov' | 'dec' | 'both';
const S = snapshot.spot;
const DATA = { nov: smile('nov'), dec: smile('dec') };
const NAMES = { nov: 'Nov 27 (31d)', dec: 'Dec 18 (52d)' };
const SK = { nov: skewMetrics('nov'), dec: skewMetrics('dec') };

const xOf = (p: SmilePt, a: Axis) => (a === 'strike' ? p.strike : a === 'money' ? (p.strike / S) * 100 : p.delta);

/** SPY implied vol by strike for the Nov and Dec chains, with axis and expiry toggles. */
export default function SmileChart() {
  const t = useTokens();
  const [axis, setAxis] = useState<Axis>('strike');
  const [exp, setExp] = useState<Exp>('nov');
  const which = exp === 'both' ? (['nov', 'dec'] as const) : ([exp] as const);
  const rows = which.flatMap((w) => DATA[w].map((p) => ({ ...p, x: xOf(p, axis), iv: p.iv * 100, exp: NAMES[w] })));
  const sm = SK[exp === 'dec' ? 'dec' : 'nov'];

  const xCfg =
    axis === 'strike'
      ? { label: 'Strike', domain: [640, 850] }
      : axis === 'money'
        ? { label: 'Strike as % of spot', domain: [83, 110], tickFormat: (d: number) => `${d}%` }
        : { label: 'Call delta (puts below spot shown at their call-equivalent delta)', domain: [1, 0], tickFormat: (d: number) => d.toFixed(1) };
  const atmX = axis === 'strike' ? S : axis === 'money' ? 100 : 0.5;

  return (
    <div className="viz-card not-content">
      <CardHead title="SPY volatility smile" sub="Out-of-the-money puts below 770, out-of-the-money calls above, the average of both at 770" />
      <div className="mb-2 flex flex-wrap gap-3">
        <Segmented
          label="X axis"
          value={axis}
          onChange={setAxis}
          options={[
            { value: 'strike', label: 'Strike' },
            { value: 'money', label: 'Moneyness' },
            { value: 'delta', label: 'Delta' },
          ]}
        />
        <Segmented
          label="Expiry"
          value={exp}
          onChange={setExp}
          options={[
            { value: 'nov', label: 'Nov 27' },
            { value: 'dec', label: 'Dec 18' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </div>
      <PlotFigure
        deps={[axis, exp]}
        minHeight={300}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 40,
            marginRight: 14,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { ...xCfg, grid: true, ticks: width < 520 ? 5 : 8 } as Plot.ScaleOptions,
            y: { label: 'Implied vol (%)', domain: [10, 34], grid: true },
            color: { domain: [NAMES.nov, NAMES.dec], range: [tk.call, tk.stock] },
            marks: [
              Plot.ruleX([atmX], { stroke: tk.muted, strokeDasharray: '3 3' }),
              Plot.text([atmX], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => (axis === 'delta' ? '50 delta' : `spot ${S}`), fill: tk.muted }),
              Plot.line(rows, { x: 'x', y: 'iv', stroke: 'exp', strokeWidth: 2, curve: 'monotone-x' }),
              Plot.dot(rows, {
                x: 'x',
                y: 'iv',
                fill: (d: { side: string; exp: string }) => (d.side === 'put' ? tk.put : d.exp === NAMES.dec ? tk.stock : tk.call),
                stroke: tk.surface,
                strokeWidth: 1.5,
                r: 4.5,
                symbol: (d: { exp: string }) => (d.exp === NAMES.dec ? 'square' : 'circle'),
              }),
              Plot.tip(
                rows,
                Plot.pointer({
                  x: 'x',
                  y: 'iv',
                  title: (d: (typeof rows)[0]) =>
                    `${d.exp}: ${d.strike} ${d.side === 'atm' ? 'ATM' : d.side}\nIV ${d.iv.toFixed(2)}%\n${((d.strike / S) * 100).toFixed(1)}% of spot · call delta ${d.delta.toFixed(2)}`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          ...(exp !== 'dec' ? [{ label: 'Nov 27 smile', color: t.call }] : []),
          ...(exp !== 'nov' ? [{ label: 'Dec 18 smile (squares)', color: t.stock }] : []),
          { label: 'Out-of-the-money put strikes', color: t.put, kind: 'dot' as const },
        ]}
      />
      {exp === 'both' ? (
        <StatGrid
          items={[
            ['25d risk reversal, Nov', `${(SK.nov.rr25 * 100).toFixed(2)} pts`, 'call IV minus put IV'],
            ['25d risk reversal, Dec', `${(SK.dec.rr25 * 100).toFixed(2)} pts`, 'larger than November'],
            ['Put wing vs ATM, Nov', `+${(SK.nov.putWing * 100).toFixed(2)} pts`, '25-delta put minus 50 delta'],
            ['Put wing vs ATM, Dec', `+${(SK.dec.putWing * 100).toFixed(2)} pts`, '25-delta put minus 50 delta'],
          ]}
        />
      ) : (
        <StatGrid
          items={[
            ['ATM (50 delta)', `${(sm.atm * 100).toFixed(2)}%`, NAMES[exp]],
            ['25-delta put', `${(sm.put25 * 100).toFixed(2)}%`, `+${(sm.putWing * 100).toFixed(2)} vs ATM`],
            ['25-delta call', `${(sm.call25 * 100).toFixed(2)}%`, `${((sm.call25 - sm.atm) * 100).toFixed(2)} vs ATM`],
            ['25-delta risk reversal', `${(sm.rr25 * 100).toFixed(2)} pts`, 'call IV minus put IV'],
          ]}
        />
      )}
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Delta-based metrics are interpolated linearly between quoted strikes, using Black-Scholes call deltas at each strike's own IV.
      </p>
    </div>
  );
}
