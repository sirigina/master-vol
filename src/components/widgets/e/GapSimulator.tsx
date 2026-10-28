import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { fmt } from '../../../lib/snapshot';
import { DAYS, IV, S0, T0, UNITS, straddle, usd0 } from './hedgeSim';

const DT = T0 / DAYS;
const STEPS = 13;
type Left = '22' | '5' | '2';

/** Hedged P/L over one session for a move of `pct`, either as one overnight gap or as a steady drift rehedged every half hour. */
function session(sgn: number, pct: number, left: number) {
  const tau0 = DT * left;
  const v0 = straddle(S0, tau0, IV);
  const S1 = S0 * (1 + pct / 100);
  const gap = sgn * UNITS * (straddle(S1, tau0 - DT, IV).price - v0.price - v0.delta * (S1 - S0));
  let pnl = 0;
  let S = S0;
  let v = v0;
  for (let i = 1; i <= STEPS; i++) {
    const Sn = S0 * Math.pow(S1 / S0, i / STEPS);
    const vn = straddle(Sn, tau0 - (DT * i) / STEPS, IV);
    pnl += vn.price - v.price - v.delta * (Sn - S);
    S = Sn;
    v = vn;
  }
  const flat = sgn * UNITS * (straddle(S0, tau0 - DT, IV).price - v0.price);
  return { gap, drift: sgn * UNITS * pnl, flat, gamma: v0.gamma * UNITS };
}

const REAL = [
  { label: 'Jun 5, 2026', pct: -2.58 },
  { label: 'Mar 31, 2026', pct: 2.91 },
  { label: 'Apr 8, 2026', pct: 2.55 },
];

/** E4: an overnight gap against a hedged 770 straddle. */
export default function GapSimulator() {
  const t = useTokens();
  const [side, setSide] = useState<'short' | 'long'>('short');
  const [left, setLeft] = useState<Left>('22');
  const [pct, setPct] = useState(-2.58);
  const sgn = side === 'long' ? 1 : -1;
  const L = +left;
  const curve = useMemo(() => {
    const out: { pct: number; gap: number; drift: number }[] = [];
    for (let p = -5; p <= 5.0001; p += 0.1) {
      const r = session(sgn, p, L);
      out.push({ pct: +p.toFixed(1), gap: r.gap, drift: r.drift });
    }
    return out;
  }, [sgn, L]);
  const now = session(sgn, pct, L);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="An overnight gap vs the same move during the day"
        sub={`Illustration: 10 Nov 27 770 straddles at ${fmt.pct(IV, 2)}, delta-hedged at ${S0}; P/L over one session`}
      />
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Position</div>
          <Segmented
            label="Position"
            value={side}
            onChange={setSide}
            options={[
              { value: 'short', label: 'Short straddle' },
              { value: 'long', label: 'Long straddle' },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Sessions to expiry</div>
          <Segmented
            label="Sessions to expiry"
            value={left}
            onChange={setLeft}
            options={[
              { value: '22', label: '22 (today)' },
              { value: '5', label: '5' },
              { value: '2', label: '2' },
            ]}
          />
        </div>
      </div>
      <Slider className="mt-3" label="Overnight gap in SPY" value={pct} min={-5} max={5} step={0.1} onChange={setPct} format={(v) => `${fmt.signed(v, 2)}% (${fmt.signed((S0 * v) / 100, 2)})`} />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.78rem] text-(--sl-color-gray-3)">
        SPY’s biggest daily moves of the year:
        {REAL.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setPct(r.pct)}
            className="cursor-pointer rounded-md border border-(--sl-color-hairline) bg-transparent px-2 py-0.5 text-[0.78rem] text-(--sl-color-gray-2) hover:text-(--sl-color-white)"
          >
            {r.label} {fmt.signed(r.pct, 2)}%
          </button>
        ))}
      </div>
      <div className="mt-3">
        <PlotFigure
          deps={[side, left, pct]}
          minHeight={270}
          build={(width, tk) =>
            Plot.plot({
              width,
              height: 270,
              marginLeft: 56,
              marginBottom: 36,
              style: plotStyle(tk),
              x: { label: 'SPY move over the session (%)', domain: [-5, 5], tickFormat: (d: number) => `${d > 0 ? '+' : ''}${d}%` },
              y: { label: 'Hedged P/L, $', grid: true, tickFormat: (d: number) => (d === 0 ? '0' : `${d < 0 ? '−' : ''}${Math.abs(d / 1000)}k`) },
              marks: [
                Plot.ruleY([0], { stroke: tk.axis }),
                Plot.ruleX([pct], { stroke: tk.muted, strokeDasharray: '3 3' }),
                Plot.line(curve, { x: 'pct', y: 'drift', stroke: tk.aqua, strokeWidth: 2 }),
                Plot.line(curve, { x: 'pct', y: 'gap', stroke: tk.put, strokeWidth: 2.5 }),
                Plot.dot([{ pct, v: now.gap }], { x: 'pct', y: 'v', r: 5, fill: tk.put, stroke: tk.surface, strokeWidth: 2 }),
                Plot.dot([{ pct, v: now.drift }], { x: 'pct', y: 'v', r: 5, fill: tk.aqua, stroke: tk.surface, strokeWidth: 2 }),
                Plot.tip(curve, Plot.pointerX({ x: 'pct', y: 'gap', title: (d: { pct: number; gap: number; drift: number }) => `Move ${fmt.signed(d.pct, 1)}%\nAs a gap: ${usd0(d.gap)}\nAs a steady drift: ${usd0(d.drift)}` })),
              ],
            })
          }
        />
      </div>
      <Legend
        items={[
          { label: 'Gap: whole move before you can rehedge', color: t.put },
          { label: 'Same move as a steady drift, rehedged every half hour', color: t.aqua },
        ]}
      />
      <StatGrid
        items={[
          ['P/L with the gap', usd0(now.gap), `${fmt.signed(pct, 2)}% overnight`, now.gap >= 0 ? t.profit : t.loss],
          ['P/L as a drift', usd0(now.drift), '13 half-hour rehedges'],
          ['Quiet day', usd0(now.flat), 'theta only, no move'],
          ['Gamma at the open', `${now.gamma.toFixed(1)} sh/$`, `${L} sessions to expiry`],
        ]}
      />
    </div>
  );
}
