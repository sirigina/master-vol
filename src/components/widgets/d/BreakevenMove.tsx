import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid, Legend } from '../../ui/Stats';
import { S0, IV0, VOL0, K0, g, usd0 } from './common';

/** One trading day = 1/252 year = 365/252 calendar days (spreads weekend decay over weekdays). */
const DAY = 365 / 252;
const DTE = 31;
type Row = { m: number; v: number };

function straddle(S: number, d: number, sigma: number) {
  const c = g('call', S, K0, d, sigma);
  const p = g('put', S, K0, d, sigma);
  return { v: c.price + p.price, delta: c.delta + p.delta, gamma: c.gamma + p.gamma, theta: c.theta + p.theta };
}

/** One-day P/L of a delta-hedged long 770 straddle vs the size of SPY's move. */
export default function BreakevenMove() {
  const [vol, setVol] = useState(VOL0);
  const [n, setN] = useState(10);
  const sigma = vol / 100;
  const b = straddle(S0, DTE, sigma);
  const pnl = (m: number) => (straddle(S0 + m, DTE - DAY, sigma).v - b.v - b.delta * m) * 100 * n;

  const data = useMemo(() => {
    const out: Row[] = [];
    for (let m = -20; m <= 20; m += 0.25) out.push({ m, v: pnl(m) });
    return out;
  }, [sigma, n]);

  const find = (sign: 1 | -1) => {
    let lo = 0;
    let hi = 20 * sign;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (pnl(mid) > 0) hi = mid;
      else lo = mid;
    }
    return lo;
  };
  const up = find(1);
  const dn = find(-1);
  const theory = S0 * sigma / Math.sqrt(252);
  const rent = -pnl(0);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="One day in a delta-hedged long 770 straddle"
        sub={`Model, 31 days to expiry, hedged at SPY ${S0}; one trading day (1/252 of a year) passes, then SPY has moved by the x-axis amount`}
      />
      <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_1fr] sm:items-end">
        <Slider label="Implied volatility (pricing and hedging)" value={vol} min={6} max={35} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="Straddles" value={n} min={1} max={50} step={1} onChange={setN} format={(v) => `${v}`} />
      </div>
      <PlotFigure
        deps={[data]}
        minHeight={280}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 280,
            marginLeft: 60,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: "SPY's move over the day ($)", domain: [-20, 20] },
            y: { label: 'Hedged P/L ($)', grid: true },
            marks: [
              Plot.rectX([{ a: dn, b: up }], { x1: 'a', x2: 'b', fill: t['loss-wash'] }),
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.ruleX([dn, up], { stroke: t.loss, strokeDasharray: '4 3' }),
              Plot.text([up], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: (d: number) => `+$${d.toFixed(2)}`, fill: t.loss }),
              Plot.text([dn], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: -4, textAnchor: 'end', text: (d: number) => `−$${Math.abs(d).toFixed(2)}`, fill: t.loss }),
              Plot.line(data, { x: 'm', y: 'v', stroke: t.call, strokeWidth: 2.2 }),
              Plot.tip(data, Plot.pointerX({ x: 'm', y: 'v', title: (d: Row) => `SPY ${d.m >= 0 ? '+' : '−'}$${Math.abs(d.m).toFixed(2)}\nHedged P/L ${usd0(d.v)}` })),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Hedged P/L after one day (full reprice)', color: 'var(--viz-call)' },
          { label: 'Moves too small to pay the day’s rent', color: 'var(--viz-loss-wash)', kind: 'box' },
        ]}
      />
      <StatGrid
        items={[
          ['Rent (no move)', usd0(-rent).replace('+', ''), 'one trading day of theta', 'var(--viz-loss)'],
          ['Breakeven move', `±$${((up - dn) / 2).toFixed(2)}`, `${(((up - dn) / 2 / S0) * 100).toFixed(2)}% of SPY`],
          ['Rule-of-16 move', `$${theory.toFixed(2)}`, 'σ ÷ √252 × SPY'],
          ['Straddle gamma', b.gamma.toFixed(4), `${(b.gamma * 100 * n).toFixed(1)} shares per $1, position`],
        ]}
      />
    </div>
  );
}
