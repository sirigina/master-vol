import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { quote } from './common';

const K = 780;
const q = quote('put', K)!;
const TICK = 0.01;

/** Invented depth around the real top of book. Sizes in contracts. */
const BIDS = [
  { px: q.bid, size: 40 },
  { px: +(q.bid - 0.1).toFixed(2), size: 85 },
  { px: +(q.bid - 0.25).toFixed(2), size: 150 },
];
const ASKS = [
  { px: q.ask, size: 35 },
  { px: +(q.ask + 0.1).toFixed(2), size: 90 },
  { px: +(q.ask + 0.25).toFixed(2), size: 160 },
];

/**
 * Where a limit order sits in the book. The top of book is the real 780 put
 * quote; deeper levels and all sizes are invented for illustration.
 */
export default function OrderBook() {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [px, setPx] = useState(+(q.mark).toFixed(2));
  const [n, setN] = useState(10);

  const lo = +(q.bid - 0.35).toFixed(2);
  const hi = +(q.ask + 0.35).toFixed(2);

  // Classify the order.
  let status: string;
  let detail: string;
  let tone: string;
  const myLevel = Math.round(px * 100) / 100;
  if (side === 'buy') {
    if (myLevel >= q.ask) {
      let left = n;
      let cost = 0;
      for (const a of ASKS) {
        if (a.px > myLevel || left === 0) break;
        const take = Math.min(left, a.size);
        cost += take * a.px;
        left -= take;
      }
      const filled = n - left;
      status = 'Marketable: fills now';
      detail = `Buys ${filled} at an average ${(cost / Math.max(filled, 1)).toFixed(2)}${left ? `; the other ${left} rest at ${myLevel.toFixed(2)} as the new best bid` : ''}. You paid the spread.`;
      tone = 'var(--viz-loss)';
    } else if (myLevel > q.bid) {
      status = 'New best bid';
      detail = `Your ${n} sit alone at ${myLevel.toFixed(2)}, first in line. The quote becomes ${myLevel.toFixed(2)} / ${q.ask.toFixed(2)}. You fill only if a seller comes down to you.`;
      tone = 'var(--viz-aqua)';
    } else if (Math.abs(myLevel - q.bid) < 1e-9) {
      status = 'Joins the best bid';
      detail = `You queue behind ${BIDS[0].size} contracts already bidding ${q.bid.toFixed(2)}. Sellers hit them first.`;
      tone = 'var(--viz-call)';
    } else {
      status = 'Rests below the market';
      detail = `Your bid is ${(q.bid - myLevel).toFixed(2)} under the best bid. It fills only if the price falls to you.`;
      tone = 'var(--sl-color-gray-3)';
    }
  } else {
    if (myLevel <= q.bid) {
      let left = n;
      let got = 0;
      for (const b of BIDS) {
        if (b.px < myLevel || left === 0) break;
        const take = Math.min(left, b.size);
        got += take * b.px;
        left -= take;
      }
      const filled = n - left;
      status = 'Marketable: fills now';
      detail = `Sells ${filled} at an average ${(got / Math.max(filled, 1)).toFixed(2)}${left ? `; the other ${left} rest at ${myLevel.toFixed(2)} as the new best offer` : ''}. You gave up the spread.`;
      tone = 'var(--viz-loss)';
    } else if (myLevel < q.ask) {
      status = 'New best offer';
      detail = `Your ${n} sit alone at ${myLevel.toFixed(2)}, first in line. The quote becomes ${q.bid.toFixed(2)} / ${myLevel.toFixed(2)}.`;
      tone = 'var(--viz-aqua)';
    } else if (Math.abs(myLevel - q.ask) < 1e-9) {
      status = 'Joins the best offer';
      detail = `You queue behind ${ASKS[0].size} contracts already offered at ${q.ask.toFixed(2)}.`;
      tone = 'var(--viz-put)';
    } else {
      status = 'Rests above the market';
      detail = `Your offer is ${(myLevel - q.ask).toFixed(2)} over the best ask. It fills only if the price rises to you.`;
      tone = 'var(--sl-color-gray-3)';
    }
  }

  const maxSize = 160;
  const levels = [
    ...ASKS.slice().reverse().map((a) => ({ ...a, kind: 'ask' as const })),
    ...BIDS.map((b) => ({ ...b, kind: 'bid' as const })),
  ];
  // Where my order goes visually
  const isResting = !status.startsWith('Marketable');
  const insertAt = (() => {
    if (!isResting) return -1;
    // index in levels where price is just below myLevel (levels are descending)
    const idx = levels.findIndex((l) => l.px <= myLevel + 1e-9);
    return idx === -1 ? levels.length : idx;
  })();
  const sameLevel = insertAt >= 0 && insertAt < levels.length && Math.abs(levels[insertAt].px - myLevel) < 1e-9;

  const row = (l: { px: number; size: number; kind: 'bid' | 'ask' }, i: number) => {
    const col = l.kind === 'bid' ? 'var(--viz-call)' : 'var(--viz-put)';
    const mine = sameLevel && insertAt === i;
    return (
      <div key={`${l.kind}${l.px}`} className="grid grid-cols-[4.2rem_1fr] items-center gap-2 py-0.5 sm:grid-cols-[5rem_1fr]">
        <div className="text-right font-semibold tabular-nums" style={{ color: col }}>
          {l.px.toFixed(2)}
        </div>
        <div className="flex h-5 items-center gap-0.5">
          <div className="h-full rounded-sm" style={{ width: `${(l.size / maxSize) * 70}%`, background: `color-mix(in srgb, ${col} 35%, transparent)` }} />
          {mine && <div className="h-full rounded-sm" style={{ width: `${(n / maxSize) * 70}%`, background: 'var(--viz-aqua)' }} />}
          <span className="ml-1 text-[0.74rem] tabular-nums text-(--sl-color-gray-3)">
            {l.size}
            {mine ? ` + your ${n}` : ''}
          </span>
        </div>
      </div>
    );
  };
  const myRow = (
    <div key="mine" className="grid grid-cols-[4.2rem_1fr] items-center gap-2 py-0.5 sm:grid-cols-[5rem_1fr]">
      <div className="text-right font-semibold tabular-nums" style={{ color: 'var(--viz-aqua)' }}>
        {myLevel.toFixed(2)}
      </div>
      <div className="flex h-5 items-center">
        <div className="h-full rounded-sm" style={{ width: `${(n / maxSize) * 70}%`, background: 'var(--viz-aqua)' }} />
        <span className="ml-1 text-[0.74rem] text-(--sl-color-gray-3)">your {n}</span>
      </div>
    </div>
  );

  const body: React.ReactNode[] = [];
  levels.forEach((l, i) => {
    if (isResting && !sameLevel && insertAt === i) body.push(myRow);
    if (i === ASKS.length) {
      body.push(
        <div key="mid" className="my-1 flex items-center gap-2 text-[0.72rem] text-(--sl-color-gray-3)">
          <span className="h-px flex-1" style={{ background: 'var(--sl-color-hairline-shade)' }} />
          spread {(q.ask - q.bid).toFixed(2)} · mark {q.mark.toFixed(2)}
          <span className="h-px flex-1" style={{ background: 'var(--sl-color-hairline-shade)' }} />
        </div>,
      );
    }
    body.push(row(l, i));
  });
  if (isResting && !sameLevel && insertAt === levels.length) body.push(myRow);

  return (
    <div className="viz-card not-content">
      <CardHead
        title={`Order book for the ${K} put`}
        sub="Illustration: best bid and ask are the real quote; deeper levels and all sizes are invented."
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-3">
          <Segmented
            label="Order side"
            value={side}
            onChange={(v) => {
              setSide(v);
            }}
            options={[
              { value: 'buy', label: 'Buy limit' },
              { value: 'sell', label: 'Sell limit' },
            ]}
          />
          <Slider label="Limit price" value={px} min={lo} max={hi} step={TICK} onChange={(v) => setPx(+v.toFixed(2))} format={(v) => v.toFixed(2)} />
          <Slider label="Contracts" value={n} min={1} max={60} step={1} onChange={setN} format={(v) => `${v}`} />
          <div className="rounded-lg border-2 px-3 py-2" style={{ borderColor: tone }}>
            <div className="text-[0.92rem] font-semibold text-(--sl-color-white)">{status}</div>
            <div className="text-[0.82rem] text-(--sl-color-gray-2)">{detail}</div>
          </div>
        </div>
        <div className="text-[0.82rem]">
          <div className="mb-1 grid grid-cols-[4.2rem_1fr] gap-2 text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3) sm:grid-cols-[5rem_1fr]">
            <span className="text-right">Price</span>
            <span>Size (contracts)</span>
          </div>
          {body}
          <div className="mt-2 flex flex-wrap gap-x-4 text-[0.74rem] text-(--sl-color-gray-3)">
            <span style={{ color: 'var(--viz-put)' }}>■ offers (sellers)</span>
            <span style={{ color: 'var(--viz-call)' }}>■ bids (buyers)</span>
            <span style={{ color: 'var(--viz-aqua)' }}>■ your order</span>
          </div>
        </div>
      </div>
    </div>
  );
}
