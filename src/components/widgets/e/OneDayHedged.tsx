import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { fmt } from '../../../lib/snapshot';
import { DAYS, ENTRY, IV, S0, T0, UNITS, straddle, usd0 } from './hedgeSim';

const DT = T0 / DAYS; // one session on the option's clock
const THETA_SESSION = ENTRY.theta * DT * 365 * UNITS;
const BE = S0 * IV * Math.sqrt(DT);

/** E2: one session of a delta-hedged straddle: gamma gain vs theta cost. */
export default function OneDayHedged() {
  const t = useTokens();
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [mv, setMv] = useState(10);
  const sgn = side === 'long' ? 1 : -1;
  const pnl = (d: number) => sgn * UNITS * (straddle(S0 + d, T0 - DT, IV).price - ENTRY.price - ENTRY.delta * d);
  const curve = useMemo(() => {
    const out: { d: number; full: number; gamma: number }[] = [];
    for (let d = -20; d <= 20.001; d += 0.25) out.push({ d, full: pnl(d), gamma: sgn * UNITS * 0.5 * ENTRY.gamma * d * d });
    return out;
  }, [sgn]);
  const now = pnl(mv);
  const g = sgn * UNITS * 0.5 * ENTRY.gamma * mv * mv;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="One session of a hedged straddle"
        sub={`Illustration: 10 straddles at ${fmt.pct(IV, 2)}, delta-hedged at ${S0}; P/L after one session (${(DT * 365).toFixed(2)} calendar days) for each move`}
      />
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <Segmented
          label="Position"
          value={side}
          onChange={setSide}
          options={[
            { value: 'long', label: 'Long straddle' },
            { value: 'short', label: 'Short straddle' },
          ]}
        />
        <Slider label="SPY move over the session" value={mv} min={-20} max={20} step={0.5} onChange={setMv} format={(v) => `${fmt.signed(v, 1)} dollars`} />
      </div>
      <div className="mt-3">
        <PlotFigure
          deps={[side, mv]}
          minHeight={260}
          build={(width, tk) =>
            Plot.plot({
              width,
              height: 260,
              marginLeft: 56,
              marginBottom: 36,
              style: plotStyle(tk),
              x: { label: 'SPY move ($)', domain: [-20, 20] },
              y: { label: 'Hedged P/L, $', grid: true, tickFormat: (d: number) => `${d < 0 ? '−' : ''}${Math.abs(d).toLocaleString()}` },
              marks: [
                Plot.rectX([0], { x1: -BE, x2: BE, fill: sgn > 0 ? tk['loss-wash'] : tk['profit-wash'] }),
                Plot.ruleY([0], { stroke: tk.axis }),
                Plot.ruleY([sgn * THETA_SESSION], { stroke: tk.put, strokeDasharray: '4 3' }),
                Plot.text([sgn * THETA_SESSION], { y: (d: number) => d, frameAnchor: 'right', dx: -4, dy: -7, text: () => `theta ${usd0(sgn * THETA_SESSION)}`, fill: tk.put, textAnchor: 'end' }),
                Plot.line(curve, { x: 'd', y: 'gamma', stroke: tk.muted, strokeDasharray: '5 4', strokeWidth: 1.5 }),
                Plot.line(curve, { x: 'd', y: 'full', stroke: tk.stock, strokeWidth: 2.5 }),
                Plot.dot([{ d: mv, full: now }], { x: 'd', y: 'full', r: 5, fill: tk.stock, stroke: tk.surface, strokeWidth: 2 }),
                Plot.tip(curve, Plot.pointerX({ x: 'd', y: 'full', title: (p: { d: number; full: number }) => `Move ${fmt.signed(p.d, 2)}\nHedged P/L ${usd0(p.full)}` })),
              ],
            })
          }
        />
      </div>
      <Legend
        items={[
          { label: 'Hedged P/L (full reprice)', color: t.stock },
          { label: 'Gamma part: ½ Γ × move²', color: t.muted, kind: 'dash' },
          { label: 'Theta for the session', color: t.put, kind: 'dash' },
          { label: `Breakeven band ±$${BE.toFixed(2)}`, color: sgn > 0 ? t['loss-wash'] : t['profit-wash'], kind: 'box' },
        ]}
      />
      <StatGrid
        items={[
          ['Hedged P/L', usd0(now), `on a ${fmt.signed(mv, 1)} move`, now >= 0 ? t.profit : t.loss],
          ['Gamma part', usd0(g), `Γ = ${(ENTRY.gamma * UNITS).toFixed(1)} shares per $`],
          ['Theta part', usd0(sgn * THETA_SESSION), 'per session'],
          ['Breakeven move', `±$${BE.toFixed(2)}`, 'S × implied × √(one session)'],
        ]}
      />
    </div>
  );
}
