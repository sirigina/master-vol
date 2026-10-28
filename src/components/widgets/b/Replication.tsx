import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot, T_EXPIRY, fmt } from '../../../lib/snapshot';
import { Tile } from './kit';

const S0 = snapshot.spot;
const r = snapshot.rate;

/**
 * One-step replication: SPY goes to Su or Sd at expiry. Find shares and borrowing
 * that copy the call's payoff in both states; their cost is the call's price.
 */
export default function Replication() {
  const t = useTokens();
  const [up, setUp] = useState(800);
  const [down, setDown] = useState(740);
  const [K, setK] = useState(770);
  const T = T_EXPIRY;
  const Su = Math.max(up, S0 + 1);
  const Sd = Math.min(down, S0 - 1);
  const Cu = Math.max(Su - K, 0);
  const Cd = Math.max(Sd - K, 0);
  const shares = (Cu - Cd) / (Su - Sd);
  const borrowFv = shares * Sd - Cd; // amount owed at expiry
  const borrowPv = borrowFv * Math.exp(-r * T);
  const price = shares * S0 - borrowPv;
  const g = Math.exp(r * T);
  const q = (S0 * g - Sd) / (Su - Sd);
  const rnPrice = (q * Cu + (1 - q) * Cd) / g;

  const row = (label: string, a: string, b: string, strong?: boolean) => (
    <tr className={strong ? 'font-semibold text-(--sl-color-white)' : ''}>
      <td className="py-1 pr-3 text-left text-(--sl-color-gray-3)">{label}</td>
      <td className="whitespace-nowrap py-1 pr-3 text-right tabular-nums">{a}</td>
      <td className="whitespace-nowrap py-1 text-right tabular-nums">{b}</td>
    </tr>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="Copy the call with stock and a loan" sub="Illustration: one step to November 27, SPY ends at one of two prices. 4.6% rate" />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Slider label="Up price" value={up} min={775} max={860} step={1} onChange={setUp} format={(v) => `${v}`} />
        <Slider label="Down price" value={down} min={680} max={765} step={1} onChange={setDown} format={(v) => `${v}`} />
        <Slider label="Call strike" value={K} min={700} max={840} step={5} onChange={setK} format={(v) => `${v}`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 overflow-x-auto rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <table className="w-full border-collapse text-[0.82rem]" style={{ margin: 0 }}>
            <thead>
              <tr className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">
                <th className="py-1 pr-3 text-left font-medium">At expiry</th>
                <th className="py-1 pr-3 text-right font-medium" style={{ color: t.profit }}>
                  SPY {Su}
                </th>
                <th className="py-1 text-right font-medium" style={{ color: t.loss }}>
                  SPY {Sd}
                </th>
              </tr>
            </thead>
            <tbody>
              {row('Call pays', fmt.usd(Cu), fmt.usd(Cd))}
              {row(`${shares.toFixed(3)} sh. worth`, fmt.usd(shares * Su), fmt.usd(shares * Sd))}
              {row('Repay loan', `−${fmt.usd(borrowFv)}`, `−${fmt.usd(borrowFv)}`)}
              {row('Copy is worth', fmt.usd(shares * Su - borrowFv), fmt.usd(shares * Sd - borrowFv), true)}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Shares to hold" value={shares.toFixed(4)} sub="(Cu − Cd) ÷ (Su − Sd): the delta" accent={t.call} />
          <Tile label="Borrow today" value={fmt.usd(borrowPv)} sub={`repay ${fmt.usd(borrowFv)}`} />
          <Tile label="Cost of the copy" value={fmt.usd(price)} sub={`${shares.toFixed(4)} × ${S0} − ${borrowPv.toFixed(2)}`} accent={t.aqua} />
          <Tile label="Risk-neutral check" value={fmt.usd(rnPrice)} sub={`up-probability q = ${(q * 100).toFixed(1)}%`} />
        </div>
      </div>
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        The copy pays exactly what the call pays in both outcomes, so the call must cost {fmt.usd(price)}. Nothing in the calculation used the real-world chance of
        an up move.
      </p>
    </div>
  );
}
