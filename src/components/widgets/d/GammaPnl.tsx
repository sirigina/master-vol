import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid, Legend } from '../../ui/Stats';
import { callAt, putAt, snapshot } from '../../../lib/snapshot';
import { S0, K0, g, usd0 } from './common';

const C = callAt(K0)!;
const P = putAt(K0)!;
const D0 = snapshot.chain.dte;

function straddle(S: number, dte: number) {
  const c = g('call', S, K0, dte, C.iv);
  const p = g('put', S, K0, dte, P.iv);
  return { price: c.price + p.price, delta: c.delta + p.delta, gamma: c.gamma + p.gamma, theta: c.theta + p.theta };
}

type Row = { move: number; v: number; series: string };

/** Delta-hedged straddle P/L for an instant move: full reprice vs ½Γ(ΔS)². */
export default function GammaPnl() {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [time, setTime] = useState<'off' | 'on'>('off');
  const [move, setMove] = useState(10);
  const sign = side === 'long' ? 1 : -1;
  const base = straddle(S0, D0);
  const dte1 = time === 'on' ? D0 - 1 : D0;

  const pnl = (m: number) => {
    const full = (straddle(S0 + m, dte1).price - base.price - base.delta * m) * 100 * sign;
    const approx = (0.5 * base.gamma * m * m + (time === 'on' ? base.theta : 0)) * 100 * sign;
    return { full, approx };
  };

  const data = useMemo(() => {
    const out: Row[] = [];
    for (let m = -30; m <= 30; m += 0.5) {
      const { full, approx } = pnl(m);
      out.push({ move: m, v: full, series: 'Full reprice' }, { move: m, v: approx, series: 'Approximation' });
    }
    return out;
  }, [side, time]);

  const cur = pnl(move);
  const ext = Math.max(...data.map((d) => Math.abs(d.v)));

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Delta-hedged 770 straddle: P/L from one move"
        sub="1 straddle (100 shares), hedged with SPY at the snapshot, then SPY jumps by the amount on the x-axis"
      />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Segmented
          label="Position"
          value={side}
          onChange={setSide}
          options={[
            { value: 'long', label: 'Long straddle' },
            { value: 'short', label: 'Short straddle' },
          ]}
        />
        <Segmented
          label="Time"
          value={time}
          onChange={setTime}
          options={[
            { value: 'off', label: 'Instant move' },
            { value: 'on', label: 'Move + 1 day decay' },
          ]}
        />
        <Slider className="w-full" label="SPY move" value={move} min={-30} max={30} step={0.5} onChange={setMove} format={(v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(1)}`} />
      </div>
      <PlotFigure
        deps={[data, move]}
        minHeight={290}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 56,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'SPY move ($)', domain: [-30, 30] },
            y: { label: 'Hedged P/L per straddle ($)', grid: true, domain: [-ext * 1.05, ext * 1.05] },
            color: { domain: ['Full reprice', 'Approximation'], range: [t.call, t.put] },
            marks: [
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.ruleX([move], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.line(data.filter((d) => d.series === 'Full reprice'), { x: 'move', y: 'v', stroke: t.call, strokeWidth: 2 }),
              Plot.line(data.filter((d) => d.series === 'Approximation'), { x: 'move', y: 'v', stroke: t.put, strokeWidth: 2, strokeDasharray: '6 4' }),
              Plot.dot([{ move, v: cur.full }], { x: 'move', y: 'v', r: 5, fill: t.call, stroke: t.surface, strokeWidth: 2 }),
              Plot.tip(data, Plot.pointer({ x: 'move', y: 'v', stroke: 'series', title: (d: Row) => `Move ${d.move >= 0 ? '+' : '−'}$${Math.abs(d.move).toFixed(1)}\n${d.series}: ${usd0(d.v)}` })),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Full Black-Scholes reprice', color: 'var(--viz-call)' },
          { label: time === 'on' ? '½Γ(ΔS)² + one day of theta' : '½Γ(ΔS)²', color: 'var(--viz-put)', kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          ['Straddle gamma', base.gamma.toFixed(4), `${(base.gamma * 100).toFixed(2)} shares per $1, per straddle`],
          ['Full reprice', usd0(cur.full), `at a ${move >= 0 ? '+' : '−'}$${Math.abs(move)} move`, 'var(--viz-call)'],
          ['½Γ(ΔS)² estimate', usd0(cur.approx), time === 'on' ? 'includes theta' : 'gamma term only', 'var(--viz-put)'],
          ['One day of theta', usd0(base.theta * 100 * sign), 'call + put, per straddle'],
        ]}
      />
    </div>
  );
}
