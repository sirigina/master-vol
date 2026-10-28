import { useState } from 'react';
import LineChart from './LineChart';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { S0 } from './hedge';

type View = 'strike' | 'expiry';
type Basis = 'raw' | 'ann';

const novPuts = snapshot.chain.puts.filter((p) => p.strike <= 780);
const decPuts = snapshot.chain2.puts.filter((p) => p.strike <= 790);
const pct = (k: number) => (k / S0 - 1) * 100;

/** I1: cost of protection by strike distance (two expiries) and by expiry (770 put). */
export default function ProtectionCost() {
  const t = useTokens();
  const [view, setView] = useState<View>('strike');
  const [basis, setBasis] = useState<Basis>('ann');

  const cost = (mark: number, dte: number) => (mark / S0) * 100 * (basis === 'ann' ? 365 / dte : 1);
  const nov = novPuts.map((p) => ({ x: pct(p.strike), y: cost(p.mark, snapshot.chain.dte) }));
  const dec = decPuts.map((p) => ({ x: pct(p.strike), y: cost(p.mark, snapshot.chain2.dte) }));
  const term = snapshot.termStructure.map((p) => ({ x: p.dte, y: cost(p.putMark, p.dte) }));

  const p750n = snapshot.chain.puts.find((p) => p.strike === 750)!;
  const p750d = snapshot.chain2.puts.find((p) => p.strike === 750)!;
  const p650 = snapshot.chain.puts.find((p) => p.strike === 650)!;
  const p770 = snapshot.chain.puts.find((p) => p.strike === 770)!;
  const ts10 = snapshot.termStructure[0];
  const tsLast = snapshot.termStructure[snapshot.termStructure.length - 1];

  return (
    <div className="viz-card not-content">
      <CardHead
        title="What does protection cost?"
        sub={basis === 'ann' ? 'Put premium as % of SPY, scaled to a year (× 365 / days)' : 'Put premium as % of SPY, for the life of the option'}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'strike', label: 'By strike distance' },
            { value: 'expiry', label: 'By expiry (770 put)' },
          ]}
        />
        <Segmented
          label="Basis"
          value={basis}
          onChange={setBasis}
          options={[
            { value: 'ann', label: 'Annualized' },
            { value: 'raw', label: 'Per option' },
          ]}
        />
      </div>
      {view === 'strike' ? (
        <>
          <LineChart
            ariaLabel="Put cost as percent of SPY versus strike distance for two expiries"
            height={290}
            series={[
              { key: 'nov', label: 'Nov 27 (31d)', color: t.put, points: nov, dots: true },
              { key: 'dec', label: 'Dec 18 (52d)', color: t.call, points: dec, dots: true },
            ]}
            xDomain={[-16.5, 2]}
            xLabel="Put strike vs spot (% below SPY 769.66)"
            yLabel={basis === 'ann' ? 'Cost, % per year' : 'Cost, % of SPY'}
            xFmt={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(0)}%`}
            yFmt={(v) => `${v.toFixed(basis === 'ann' ? 0 : 1)}%`}
            tipFmt={(v) => `${v.toFixed(2)}%`}
            tipTitle={(v) => `Strike ${(S0 * (1 + v / 100)).toFixed(0)} (${v.toFixed(1)}%)`}
          />
          <Legend
            items={[
              { label: 'Nov 27 puts (31 days)', color: t.put },
              { label: 'Dec 18 puts (52 days)', color: t.call },
            ]}
          />
        </>
      ) : (
        <>
          <LineChart
            ariaLabel="Cost of the 770 put across expiries"
            height={290}
            series={[{ key: 'ts', label: '770 put', color: t.put, points: term, dots: true }]}
            xDomain={[0, 420]}
            xLabel="Days to expiry"
            yLabel={basis === 'ann' ? 'Cost, % per year' : 'Cost, % of SPY'}
            yFmt={(v) => `${v.toFixed(0)}%`}
            tipFmt={(v) => `${v.toFixed(2)}%`}
            tipTitle={(v) => `${v.toFixed(0)} days`}
          />
          <Legend items={[{ label: '770 put (at the money), each listed expiry', color: t.put }]} />
        </>
      )}
      <StatGrid
        items={
          view === 'strike'
            ? [
                ['750 put, Nov 27', `${((p750n.mark / S0) * 100).toFixed(2)}%`, `${((p750n.mark / S0) * 36500 / 31).toFixed(1)}% a year`],
                ['750 put, Dec 18', `${((p750d.mark / S0) * 100).toFixed(2)}%`, `${((p750d.mark / S0) * 36500 / 52).toFixed(1)}% a year`],
                ['650 put, Nov 27', `${((p650.mark / S0) * 100).toFixed(2)}%`, `${(-pct(650)).toFixed(1)}% below spot`],
                ['650 put IV', `${(p650.iv * 100).toFixed(1)}%`, `vs ${(p770.iv * 100).toFixed(1)}% for the 770 put`],
              ]
            : [
                [`770 put, ${ts10.dte} days`, `${((ts10.putMark / S0) * 100).toFixed(2)}%`, `${((ts10.putMark / S0) * 36500 / ts10.dte).toFixed(1)}% a year`],
                [`770 put, ${tsLast.dte} days`, `${((tsLast.putMark / S0) * 100).toFixed(2)}%`, `${((tsLast.putMark / S0) * 36500 / tsLast.dte).toFixed(1)}% a year`],
                ['Ratio of cost', `${(tsLast.putMark / ts10.putMark).toFixed(1)}×`, `for ${(tsLast.dte / ts10.dte).toFixed(0)}× the time`],
                ['√time predicts', `${Math.sqrt(tsLast.dte / ts10.dte).toFixed(1)}×`, 'at constant volatility'],
              ]
        }
      />
    </div>
  );
}
