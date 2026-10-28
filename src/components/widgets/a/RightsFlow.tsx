import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { S0, quote, money0 } from './common';

type Right = 'call' | 'put';
type Stage = 'open' | 'itm' | 'otm';

const K = 770;

/**
 * Who holds what: buyer, clearinghouse, seller. Shows the flows at the trade
 * and at expiration for a 770 call or put.
 */
export default function RightsFlow() {
  const [right, setRight] = useState<Right>('call');
  const [stage, setStage] = useState<Stage>('open');
  const q = quote(right, K)!;
  const prem = q.mark * 100;
  const endPx = stage === 'itm' ? (right === 'call' ? 790 : 750) : right === 'call' ? 750 : 790;
  const cash = K * 100;

  type Flow = { from: 'buyer' | 'seller'; what: string; note?: string; color: string };
  let flows: Flow[] = [];
  let buyerHolds = '';
  let sellerHolds = '';
  if (stage === 'open') {
    flows = [{ from: 'buyer', what: `${money0(prem, false)} premium`, note: `${q.mark.toFixed(2)} × 100`, color: 'var(--viz-aqua)' }];
    buyerHolds = `Right to ${right === 'call' ? 'buy' : 'sell'} 100 SPY at ${K}`;
    sellerHolds = `Obligation to ${right === 'call' ? 'sell' : 'buy'} 100 SPY at ${K}, plus the ${money0(prem, false)}`;
  } else if (stage === 'itm') {
    if (right === 'call') {
      flows = [
        { from: 'buyer', what: `${money0(cash, false)} cash`, note: '770 × 100', color: 'var(--viz-aqua)' },
        { from: 'seller', what: '100 SPY shares', note: `worth ${money0(endPx * 100, false)} at ${endPx}`, color: 'var(--viz-stock)' },
      ];
      buyerHolds = `100 shares bought at ${K}, worth ${endPx}: +${money0((endPx - K) * 100, false)} value, ${money0((endPx - K) * 100 - prem)} after premium`;
      sellerHolds = `Delivered shares at ${K} that trade at ${endPx}: ${money0(-(endPx - K) * 100 + prem)} after premium`;
    } else {
      flows = [
        { from: 'buyer', what: '100 SPY shares', note: `worth ${money0(endPx * 100, false)} at ${endPx}`, color: 'var(--viz-stock)' },
        { from: 'seller', what: `${money0(cash, false)} cash`, note: '770 × 100', color: 'var(--viz-aqua)' },
      ];
      buyerHolds = `Sold shares at ${K} that trade at ${endPx}: +${money0((K - endPx) * 100, false)} value, ${money0((K - endPx) * 100 - prem)} after premium`;
      sellerHolds = `Owns 100 shares bought at ${K}, worth ${endPx}: ${money0(-(K - endPx) * 100 + prem)} after premium`;
    }
  } else {
    flows = [];
    buyerHolds = `Nothing. The option expires worthless: ${money0(-prem)}`;
    sellerHolds = `No obligation left. Keeps the premium: ${money0(prem)}`;
  }

  const party = (title: string, role: string, holds: string, accent: string) => (
    <div className="rounded-lg border-2 px-3 py-2" style={{ borderColor: accent }}>
      <div className="text-[0.88rem] font-semibold text-(--sl-color-white)">{title}</div>
      <div className="text-[0.74rem] text-(--sl-color-gray-3)">{role}</div>
      <div className="mt-1.5 text-[0.8rem] text-(--sl-color-gray-2)">{holds}</div>
    </div>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="Who holds what" sub="The 770 contract from the trade to expiration. The clearinghouse stands between the two sides." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Segmented
          label="Option type"
          value={right}
          onChange={(v) => setRight(v)}
          options={[
            { value: 'call', label: '770 call' },
            { value: 'put', label: '770 put' },
          ]}
        />
        <Segmented
          label="Stage"
          value={stage}
          onChange={setStage}
          options={[
            { value: 'open', label: 'At the trade' },
            { value: 'itm', label: `Expiry: SPY ${right === 'call' ? 790 : 750}` },
            { value: 'otm', label: `Expiry: SPY ${right === 'call' ? 750 : 790}` },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_1.1fr_1fr]">
        {party('Buyer (long)', 'pays premium, holds the right', buyerHolds, 'var(--viz-call)')}

        <div className="flex flex-col justify-center gap-2 rounded-lg border border-dashed border-(--sl-color-hairline-shade) px-3 py-2">
          <div className="text-center text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Clearinghouse (OCC)</div>
          {flows.length === 0 && <div className="text-center text-[0.82rem] text-(--sl-color-gray-3)">No exercise, nothing moves</div>}
          {flows.map((f) => (
            <div key={f.what} className="rounded-md px-2 py-1.5 text-center text-[0.82rem]" style={{ background: 'var(--sl-color-gray-6)' }}>
              <div className="font-semibold tabular-nums" style={{ color: f.color }}>
                <span className="hidden sm:inline">{f.from === 'buyer' ? '' : '← '}</span>
                <span className="sm:hidden">{f.from === 'buyer' ? '↓ ' : '↑ '}</span>
                {f.what}
                <span className="hidden sm:inline">{f.from === 'buyer' ? ' →' : ''}</span>
              </div>
              <div className="text-[0.72rem] text-(--sl-color-gray-3)">
                {f.from === 'buyer' ? 'buyer to seller' : 'seller to buyer'}
                {f.note ? ` · ${f.note}` : ''}
              </div>
            </div>
          ))}
        </div>

        {party('Seller (short, writer)', 'collects premium, carries the obligation', sellerHolds, 'var(--viz-put)')}
      </div>
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        SPY was {S0} at the trade. Premium at the mark, {q.mark.toFixed(2)} per share. In practice both sides face the clearinghouse, not each other, so
        neither needs to trust the other.
      </p>
    </div>
  );
}
