import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { binomial } from '../../../lib/position';
import { bs } from '../../../lib/pricing';
import PnlChart from './G6_PnlChart';
import { rowAt, R, S0, T1, solvedIv, num } from './G6_helpers';

const XS = Array.from({ length: 101 }, (_, i) => 740 + i * 0.8);
const W = 20;
const c770 = rowAt('call', 770)!.mark;
const c790 = rowAt('call', 790)!.mark;
const p770 = rowAt('put', 770)!.mark;
const p790 = rowAt('put', 790)!.mark;
export const EQ = (() => {
  const debit = c770 - c790;
  const credit = p790 - p770;
  const grow = Math.exp(R * T1);
  const pvWidth = W / grow;
  const box = debit + credit;
  // early-exercise premium of the two puts at the call IVs (where parity holds for calls)
  const amEu = (K: number) => {
    const iv = solvedIv('call', K);
    return binomial('put', { S: S0, K, T: T1, r: R, sigma: iv, steps: 800, american: true }).price - bs('put', { S: S0, K, T: T1, r: R, sigma: iv }).price;
  };
  const eep = amEu(790) - amEu(770);
  return { debit, credit, grow, pvWidth, box, excess: box - pvWidth, eep, gapFinanced: (box - pvWidth) * grow };
})();

const payoff = (S: number) => Math.min(Math.max(S - 770, 0), W);

/** Bull call debit vs bull put credit at 770/790: same payoff shape, financed side by side. */
export default function Equivalence() {
  const t = useTokens();
  const [fin, setFin] = useState<'off' | 'on'>('on');
  const g = fin === 'on' ? EQ.grow : 1;
  const callPnl = XS.map((s) => (payoff(s) - EQ.debit * g) * 100);
  const putPnl = XS.map((s) => (payoff(s) - W + EQ.credit * g) * 100);
  const gap = (callPnl[0] - putPnl[0]) / 100;

  const row = (a: string, b: string, c: string, strong = false) => (
    <tr className="border-t border-(--sl-color-hairline)">
      <td className="py-1.5 pr-3">{a}</td>
      <td className={`whitespace-nowrap py-1.5 pr-3 text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>{b}</td>
      <td className={`whitespace-nowrap py-1.5 text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>{c}</td>
    </tr>
  );

  return (
    <div className="viz-card not-content">
      <CardHead
        title="770/790 bull call (debit) vs 770/790 bull put (credit)"
        sub="Same strikes, same expiry: both pay nothing below 770 and the full $20 width above 790"
        right={<Segmented label="Financing" value={fin} onChange={setFin} options={[{ value: 'off', label: 'Ignore financing' }, { value: 'on', label: 'Carry premium at 4.6%' }]} />}
      />
      <PnlChart
        xs={XS}
        series={[
          { label: 'Bull call spread (debit)', color: t.call, values: callPnl, width: 2.5 },
          { label: 'Bull put spread (credit)', color: t.put, values: putPnl, dash: true, width: 2.5 },
        ]}
        markers={[{ x: S0, label: `today ${S0.toFixed(0)}` }]}
        xLabel="SPY price on November 27"
        ariaLabel="Profit and loss of a bull call spread and a bull put spread at the same strikes"
        height={260}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-[0.82rem]">
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              <th className="py-1 pr-3 font-medium">Per share</th>
              <th className="py-1 pr-3 text-right font-medium">Bull call</th>
              <th className="py-1 text-right font-medium">Bull put</th>
            </tr>
          </thead>
          <tbody>
            {row('Premium at entry', `pay ${num(EQ.debit)}`, `collect ${num(EQ.credit)}`)}
            {row('Premium carried to Nov 27', fin === 'on' ? `pay ${num(EQ.debit * EQ.grow)}` : `pay ${num(EQ.debit)}`, fin === 'on' ? `collect ${num(EQ.credit * EQ.grow)}` : `collect ${num(EQ.credit)}`)}
            {row('P/L if SPY < 770', num(callPnl[0] / 100), num(putPnl[0] / 100))}
            {row('P/L if SPY > 790', num(callPnl[callPnl.length - 1] / 100), num(putPnl[putPnl.length - 1] / 100))}
            {row('Gap (put better by)', '', num(-gap), true)}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.8rem] text-(--sl-color-gray-3)">
        Debit + credit = {num(EQ.box)}: the price of the 770/790 box. A European box is worth the strike width discounted, {num(EQ.pvWidth)}. The {num(EQ.excess)} excess
        matches the extra value of early exercise in the two American puts ({num(EQ.eep)} on a binomial model), mostly from the in-the-money 790 put.
      </p>
    </div>
  );
}
