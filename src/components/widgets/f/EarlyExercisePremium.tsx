import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';
import { putEep, euroPut, S0, money } from './fdata';

const RATES = [0, 0.02, 0.046, 0.07];
const RATE_TOKENS = ['muted', 'call', 'put', 'stock'] as const;

/** American minus European put value by strike, for several rates (binomial, each put at its own Nov 27 IV). */
export default function EarlyExercisePremium() {
  const [days, setDays] = useState('31');
  const T = +days / 365;
  const rows = useMemo(
    () =>
      snapshot.chain.puts.flatMap((p) =>
        RATES.map((r) => ({ K: p.strike, r, eep: putEep(p.strike, T, p.iv, r, S0, 200), euro: euroPut(p.strike, T, p.iv, r) })),
      ),
    [days],
  );
  const at = (K: number, r: number) => rows.find((x) => x.K === K && x.r === r)!;
  const a770 = at(770, 0.046);
  const a800 = at(800, 0.046);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="What the right to exercise early is worth: puts"
        sub="American minus European value, binomial tree (200 steps), each strike at its Nov 27 put IV, SPY 769.66, no dividend"
        right={
          <Segmented
            label="Time to expiry"
            value={days}
            onChange={setDays}
            options={[
              { value: '31', label: '31 days' },
              { value: '180', label: '6 months' },
              { value: '365', label: '1 year' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[days]}
        minHeight={280}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 280,
            marginLeft: 48,
            marginBottom: 38,
            style: plotStyle(t),
            x: { label: 'Put strike', domain: [650, 800] },
            y: { label: 'Early-exercise premium ($/share)', grid: true },
            marks: [
              Plot.ruleX([S0], { stroke: t.muted, strokeDasharray: '3 3' }),
              ...RATES.map((r, i) =>
                Plot.line(
                  rows.filter((x) => x.r === r),
                  { x: 'K', y: 'eep', stroke: t[RATE_TOKENS[i]], strokeWidth: r === 0.046 ? 3 : 2, marker: 'dot' },
                ),
              ),
              Plot.tip(
                rows,
                Plot.pointer({
                  x: 'K',
                  y: 'eep',
                  title: (d) => `Strike ${d.K}, rate ${(d.r * 100).toFixed(1)}%\nEuropean put ${d.euro.toFixed(2)}\nEarly-exercise premium ${d.eep.toFixed(3)}`,
                }),
              ),
              Plot.ruleY([0], { stroke: t.axis }),
            ],
          })
        }
      />
      <Legend items={RATES.map((r, i) => ({ label: `Rate ${(r * 100).toFixed(1)}%`, color: `var(--viz-${RATE_TOKENS[i]})` }))} />
      <StatGrid
        cols={3}
        items={[
          ['770 put, 4.6%', money(a770.eep, 3), `${((a770.eep / a770.euro) * 100).toFixed(1)}% of European ${money(a770.euro)}`],
          ['800 put, 4.6%', money(a800.eep, 3), `${((a800.eep / a800.euro) * 100).toFixed(1)}% of European ${money(a800.euro)}`],
          ['Any put at 0% rate', money(Math.max(...rows.filter((x) => x.r === 0).map((x) => x.eep)), 3), 'no interest, no reason to exercise'],
        ]}
      />
    </div>
  );
}
