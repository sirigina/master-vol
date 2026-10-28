import { useMemo, useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import LinesChart from './LinesChart';
import { pairs, putEep, S0, R, T1, money, pct } from './fdata';

const PS = pairs('nov');
const KS = PS.map((p) => p.K);

/** Box spread on the Nov 27 chain: price at mid and natural, implied rate, and the American-put adjustment. */
export default function BoxCalc() {
  const [k1, setK1] = useState('750');
  const [k2, setK2] = useState('790');
  const K1 = Math.min(+k1, +k2);
  const K2 = Math.max(+k1, +k2);
  const same = K1 === K2;
  const A = PS.find((p) => p.K === K1)!;
  const B = PS.find((p) => p.K === K2)!;
  const width = K2 - K1;
  const mid = A.call.mark - B.call.mark + B.put.mark - A.put.mark;
  const buy = A.call.ask - B.call.bid + B.put.ask - A.put.bid;
  const sell = A.call.bid - B.call.ask + B.put.bid - A.put.ask;
  const eep = useMemo(() => (same ? 0 : putEep(K2, T1, B.put.iv) - putEep(K1, T1, A.put.iv)), [K1, K2]);
  const rate = (px: number) => -Math.log(px / width) / T1;
  const fair = width * Math.exp(-R * T1);
  const leg = (x: number) =>
    Math.max(x - K1, 0) - A.call.mark - (Math.max(x - K2, 0) - B.call.mark) + (Math.max(K2 - x, 0) - B.put.mark) - (Math.max(K1 - x, 0) - A.put.mark);

  const pick = (label: string, v: string, set: (s: string) => void) => (
    <div>
      <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">{label}</div>
      <Segmented label={label} value={v} onChange={set} options={KS.map((s) => ({ value: String(s), label: String(s) }))} />
    </div>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="Box spread calculator" sub="Buy the K1/K2 call spread and the K2/K1 put spread, Nov 27 expiry, real quotes" />
      <div className="grid gap-3">
        {pick('Lower strike K1', k1, setK1)}
        {pick('Upper strike K2', k2, setK2)}
      </div>
      {same ? (
        <p className="mt-3 text-[0.85rem]">Pick two different strikes.</p>
      ) : (
        <>
          <div className="mt-3">
            <LinesChart
              ariaLabel="Box spread payoff at expiry"
              lo={700}
              hi={840}
              height={240}
              yLabel="Value per share"
              yInclude={[0, width + 2]}
              marks={[
                { x: K1, label: `K1 ${K1}` },
                { x: K2, label: `K2 ${K2}` },
              ]}
              series={[
                { label: `Box value at expiry (always $${width})`, color: 'ink', fn: () => width, width: 3 },
                { label: 'Box P/L at expiry if bought at mid', color: 'aqua', fn: leg, dash: true },
              ]}
            />
          </div>
          <StatGrid
            items={[
              ['Pays at expiry', money(width), `${K2} − ${K1}, at any price`],
              ['Price at mid', money(mid), `rate ${pct(rate(mid))}`, 'var(--viz-call)'],
              ['Buy / sell at natural', `${money(buy)} / ${money(sell)}`, 'what you pay / receive'],
              ['Fair at ' + (R * 100).toFixed(1) + '%', money(fair, 3), `PV of $${width}`],
            ]}
          />
          <StatGrid
            cols={3}
            items={[
              ['American-put premium', money(eep, 3), `put ${K2} minus put ${K1}, binomial`],
              ['Mid, European-equivalent', money(mid - eep), `rate ${pct(rate(mid - eep))}`, 'var(--viz-aqua)'],
              ['One cent on the price moves the rate by', `${((0.01 / fair / T1) * 100).toFixed(2)} pts`, `a $${width}-wide box over 31 days`],
            ]}
          />
          <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
            SPY options are American: the in-the-money put can be exercised early, which makes it worth more than the European version and pushes the box
            above its present value. Removing that premium (computed at each put's own IV) recovers a sensible rate. Spot {S0.toFixed(2)} for the
            model inputs.
          </p>
        </>
      )}
    </div>
  );
}
