import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { intrinsic } from '../../../lib/pricing';
import { snapshot } from '../../../lib/snapshot';
import { S0, MULT, quote, callStrikes, putStrikes, money0, money2, selectCls, isItm } from './common';

type Right = 'call' | 'put';
const MOVES = [-0.05, -0.02, 0, 0.02, 0.05];

/** One contract, taken apart: rights, obligations, cost, and value at a few expiry prices. */
export default function ContractAnatomy() {
  const [right, setRight] = useState<Right>('call');
  const [k, setK] = useState(770);
  const strikes = right === 'call' ? callStrikes : putStrikes;
  const K = strikes.includes(k) ? k : 770;
  const q = quote(right, K)!;
  const cost = q.mark * MULT;
  const verb = right === 'call' ? 'buy' : 'sell';
  const prices = MOVES.map((m) => Math.round(S0 * (1 + m)));

  const field = (label: string, value: string, sub?: string) => (
    <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
      <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">{label}</div>
      <div className="text-[0.92rem] font-semibold tabular-nums text-(--sl-color-white)">{value}</div>
      {sub && <div className="text-[0.74rem] text-(--sl-color-gray-3)">{sub}</div>}
    </div>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="Anatomy of one SPY contract" sub="Real Nov 27, 2026 quotes. Pick a type and a strike." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Option type"
          value={right}
          onChange={setRight}
          options={[
            { value: 'call', label: 'Call' },
            { value: 'put', label: 'Put' },
          ]}
        />
        <label className="inline-flex items-center gap-2 text-[0.82rem] text-(--sl-color-gray-3)">
          Strike
          <select className={selectCls} value={K} onChange={(e) => setK(+e.target.value)} aria-label="Strike">
            {strikes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="mb-4 rounded-lg border px-3 py-2 font-mono text-[0.78rem] tabular-nums text-(--sl-color-white)"
        style={{ borderColor: right === 'call' ? 'var(--viz-call)' : 'var(--viz-put)' }}
      >
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="font-semibold">
            SPY 11/27/2026 {K} {right === 'call' ? 'C' : 'P'}
          </span>
          <span>bid {q.bid.toFixed(2)}</span>
          <span>ask {q.ask.toFixed(2)}</span>
          <span>mark {q.mark.toFixed(2)}</span>
          <span>IV {(q.iv * 100).toFixed(1)}%</span>
          <span>Δ {q.delta.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field('Underlying', 'SPY (100 shares)', `last ${S0}`)}
        {field('Strike', `$${K}`, isItm(right, K) ? 'in the money now' : 'out of the money now')}
        {field('Expiration', 'Nov 27, 2026', `${snapshot.chain.dte} days; American style`)}
        {field('Cost per contract', money0(cost, false), `${money2(q.mark)} × 100 at the mark`)}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2 text-[0.84rem]">
          <div className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--viz-profit)' }}>
            Buyer (holder) pays {money0(cost, false)}
          </div>
          Gets the <b>right</b> to {verb} 100 SPY at ${K} any time until expiration. No obligation: if it doesn't pay, they let it lapse.
        </div>
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2 text-[0.84rem]">
          <div className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--viz-loss)' }}>
            Seller (writer) receives {money0(cost, false)}
          </div>
          Takes the <b>obligation</b> to {right === 'call' ? 'sell' : 'buy'} 100 SPY at ${K} if assigned. Keeps the premium either way.
        </div>
      </div>

      <div className="mt-4">
        <table className="w-full text-[0.8rem] tabular-nums">
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              <th className="py-1 pr-2 font-medium">SPY at expiry</th>
              <th className="py-1 pr-2 text-right font-medium">Worth</th>
              <th className="py-1 pr-2 text-right font-medium">Buyer</th>
              <th className="py-1 text-right font-medium">Seller</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p, i) => {
              const worth = intrinsic(right, p, K) * MULT;
              const pl = worth - cost;
              return (
                <tr key={p} className="border-t border-(--sl-color-hairline)">
                  <td className="py-1.5 pr-2">
                    {p}{' '}
                    <span className="whitespace-nowrap text-(--sl-color-gray-3)">({MOVES[i] === 0 ? 'flat' : `${MOVES[i] > 0 ? '+' : '−'}${Math.abs(MOVES[i] * 100)}%`})</span>
                  </td>
                  <td className="py-1.5 pr-2 text-right">{money0(worth, false)}</td>
                  <td className="py-1.5 pr-2 text-right" style={{ color: pl >= 0 ? 'var(--viz-profit)' : 'var(--viz-loss)' }}>
                    {money0(pl)}
                  </td>
                  <td className="py-1.5 text-right" style={{ color: -pl >= 0 ? 'var(--viz-profit)' : 'var(--viz-loss)' }}>
                    {money0(-pl)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        P/L per contract at expiration. Worth = what the right is worth then: {right === 'call' ? 'SPY minus strike' : 'strike minus SPY'}, or zero. Every dollar the buyer makes, the
        seller loses.
      </p>
    </div>
  );
}
