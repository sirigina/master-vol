import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid, Legend } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';
import { S0, IV0, VOL0, K0, g, usd0 } from './common';

const ALL = snapshot.closes.slice(-61);
const MOVES = ALL.slice(1).map((c, i) => ({ date: new Date(c[0] + 'T16:00:00'), move: c[1] - ALL[i][1] }));

/**
 * Rent vs payoff: a constant-gamma long straddle (the 770 straddle's gamma at the snapshot)
 * replayed over SPY's actual daily moves, rent = ½ΓS²σ²/252 per day.
 */
export default function RentVsPayoff() {
  const [days, setDays] = useState(60);
  const [vol, setVol] = useState(VOL0);
  const sigma = vol / 100;
  const G = g('call', S0, K0, 31, IV0).gamma + g('put', S0, K0, 31, IV0).gamma;
  const rentDay = 0.5 * G * S0 * S0 * sigma * sigma / 252 * 100;
  const be = (S0 * sigma) / Math.sqrt(252);
  const win = MOVES.slice(-days);

  const cum = useMemo(() => {
    let p = 0;
    let r = 0;
    const out: { date: Date; v: number; series: string }[] = [];
    for (const d of win) {
      p += 0.5 * G * d.move * d.move * 100;
      r += rentDay;
      out.push({ date: d.date, v: p, series: 'Gamma payoff' }, { date: d.date, v: r, series: 'Theta rent' });
    }
    return out;
  }, [days, sigma]);

  const payoff = cum[cum.length - 2].v;
  const rent = cum[cum.length - 1].v;
  const realized = Math.sqrt(win.reduce((a, d) => a + d.move * d.move, 0) / win.length) / S0 * Math.sqrt(252);
  const beyond = win.filter((d) => Math.abs(d.move) > be).length;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Rent vs payoff: SPY's actual daily moves"
        sub="One long, delta-hedged straddle with the 770 straddle's gamma held constant, replayed over real closes. Rent priced at the implied volatility you choose."
      />
      <div className="mb-3 grid gap-4 sm:grid-cols-2 sm:items-end">
        <Slider label="Trading days replayed (ending Oct 27)" value={days} min={5} max={60} step={1} onChange={setDays} format={(v) => `${v}`} />
        <Slider label="Implied volatility paid" value={vol} min={6} max={25} step={0.25} onChange={setVol} format={(v) => `${v.toFixed(2)}%`} />
      </div>
      <PlotFigure
        deps={[days, sigma]}
        minHeight={166}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 166,
            marginLeft: 46,
            marginBottom: 6,
            style: plotStyle(t),
            x: { label: null, type: 'band', domain: win.map((d) => d.date), axis: null },
            y: { label: 'Daily move ($)', grid: true, domain: [-16, 16] },
            marks: [
              Plot.rectY([0], { x1: () => win[0].date, x2: () => win[win.length - 1].date, y1: -be, y2: be, fill: t['loss-wash'] }),
              Plot.ruleY([-be, be], { stroke: t.loss, strokeDasharray: '4 3' }),
              Plot.barY(win, { x: 'date', y: 'move', fill: (d: { move: number }) => (Math.abs(d.move) > be ? t.call : t.muted), inset: width < 520 ? 0.5 : 1 }),
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.tip(win, Plot.pointerX({ x: 'date', y: 'move', title: (d: { date: Date; move: number }) => `${d.date.toDateString().slice(4)}\nSPY ${d.move >= 0 ? '+' : '−'}$${Math.abs(d.move).toFixed(2)}\nGamma payoff ${usd0(0.5 * G * d.move * d.move * 100)} vs rent $${rentDay.toFixed(0)}` })),
            ],
          })
        }
      />
      <div className="mt-1 text-[0.75rem] text-(--sl-color-gray-3)">
        {win[0].date.toDateString().slice(4)} → {win[win.length - 1].date.toDateString().slice(4)}. Blue bars beat the ±${be.toFixed(2)} breakeven; grey bars did not.
      </div>
      <div className="mt-3">
        <PlotFigure
          deps={[cum]}
          minHeight={200}
          build={(width, t) =>
            Plot.plot({
              width,
              height: 200,
              marginLeft: 56,
              marginBottom: 30,
              style: plotStyle(t),
              x: { label: null, type: 'utc', ticks: width < 520 ? 3 : 6 },
              y: { label: 'Cumulative $ per straddle', grid: true },
              color: { domain: ['Gamma payoff', 'Theta rent'], range: [t.call, t.loss] },
              marks: [
                Plot.ruleY([0], { stroke: t.axis }),
                Plot.line(cum.filter((d) => d.series === 'Gamma payoff'), { x: 'date', y: 'v', stroke: t.call, strokeWidth: 2.2 }),
                Plot.line(cum.filter((d) => d.series === 'Theta rent'), { x: 'date', y: 'v', stroke: t.loss, strokeWidth: 2.2, strokeDasharray: '6 4' }),
                Plot.tip(cum, Plot.pointerX({ x: 'date', y: 'v', stroke: 'series', title: (d: { date: Date; v: number; series: string }) => `${d.date.toDateString().slice(4)}\n${d.series}: $${d.v.toFixed(0)}` })),
              ],
            })
          }
        />
      </div>
      <Legend
        items={[
          { label: 'Cumulative ½Γ(ΔS)² earned', color: 'var(--viz-call)' },
          { label: 'Cumulative theta paid', color: 'var(--viz-loss)', kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          ['Gamma payoff', `$${Math.round(payoff).toLocaleString('en-US')}`, `${days} days`, 'var(--viz-call)'],
          ['Theta rent', `$${Math.round(rent).toLocaleString('en-US')}`, `$${rentDay.toFixed(2)} per day`, 'var(--viz-loss)'],
          ['Net', usd0(payoff - rent), payoff >= rent ? 'realized beat implied' : 'implied beat realized'],
          ['Realized vol', `${(realized * 100).toFixed(1)}%`, `${beyond} of ${days} days beyond breakeven`],
        ]}
      />
    </div>
  );
}
