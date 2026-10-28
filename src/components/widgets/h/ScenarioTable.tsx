import { useMemo, useState } from 'react';
import { interpolateRgb } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { BOOKS, S0, bookGreeks, bookPnl, sgn0 } from './hlib';
import { SCENARIOS } from './scenarios';

const KEYS = ['shortStrangle', 'ironCondor', 'longStraddle', 'calendar', 'coveredCall'];

/** H3: named stress scenarios across the preset books. */
export default function ScenarioTable() {
  const t = useTokens();
  const [view, setView] = useState<'full' | 'greeks' | 'gap'>('full');

  const cells = useMemo(
    () =>
      SCENARIOS.map((s) =>
        KEYS.map((k) => {
          const legs = BOOKS[k].legs;
          const g = bookGreeks(legs);
          const dS = (S0 * s.move) / 100;
          const full = bookPnl(legs, { S: S0 + dS, volPts: s.vol, days: s.days });
          const est = g.delta * dS + 0.5 * g.gamma * dS * dS + g.vega * s.vol + g.theta * s.days;
          return { full, est, gap: est - full };
        }),
      ),
    [],
  );
  const val = (c: { full: number; est: number; gap: number }) => (view === 'full' ? c.full : view === 'greeks' ? c.est : c.gap);
  const ext = Math.max(...cells.flat().map((c) => Math.abs(val(c))), 1);
  const bg = (v: number) => interpolateRgb(t.surface, v >= 0 ? t.profit : t.loss)(Math.min(Math.abs(v) / ext, 1) ** 0.7 * 0.6);

  return (
    <div className="viz-card not-content">
      <CardHead title="Stress scenarios across five books" sub="One unit of each preset book, dollars. Moves are instantaneous unless the row says otherwise." />
      <Segmented
        label="Show"
        value={view}
        onChange={setView}
        options={[
          { value: 'full', label: 'Full reprice' },
          { value: 'greeks', label: 'Greek estimate' },
          { value: 'gap', label: 'Estimate − reprice' },
        ]}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-separate border-spacing-0.5 text-[0.8rem]">
          <thead>
            <tr className="text-(--sl-color-gray-3)">
              <th className="text-left font-medium">Scenario</th>
              {KEYS.map((k) => (
                <th key={k} className="px-1 text-right font-medium">
                  {BOOKS[k].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((s, i) => (
              <tr key={s.id}>
                <td className="py-1 pr-2 text-(--sl-color-gray-2)">{s.label}</td>
                {cells[i].map((c, j) => (
                  <td key={j} className="rounded px-1.5 py-1 text-right font-semibold tabular-nums text-(--sl-color-white)" style={{ background: bg(val(c)) }}>
                    {sgn0(val(c))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.75rem] text-(--sl-color-gray-3)">
        Greek estimate = Δ·ΔS + ½Γ·ΔS² + vega·Δσ + θ·days using snapshot Greeks. Full reprice runs Black-Scholes at the new price, IV and date. Parallel IV
        shifts only: in a real crash, downside put IVs rise more than the at-the-money level.
      </p>
    </div>
  );
}
