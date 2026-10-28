import PayoffChart from './PayoffChart';
import { callAt, putAt, snapshot, fmt } from '../../lib/snapshot';

const K = 770;
const c = callAt(K)!;
const p = putAt(K)!;

const CARDS = [
  { title: 'Long call', sub: `Buy the ${K} call for ${fmt.usd(c.mark)}`, legs: [{ leg: { kind: 'option' as const, right: 'call' as const, K, qty: 1, premium: c.mark } }], view: 'Bullish: wants SPY up' },
  { title: 'Long put', sub: `Buy the ${K} put for ${fmt.usd(p.mark)}`, legs: [{ leg: { kind: 'option' as const, right: 'put' as const, K, qty: 1, premium: p.mark } }], view: 'Bearish: wants SPY down' },
  { title: 'Short call', sub: `Sell the ${K} call for ${fmt.usd(c.mark)}`, legs: [{ leg: { kind: 'option' as const, right: 'call' as const, K, qty: -1, premium: c.mark } }], view: 'Wants SPY to stay below the strike' },
  { title: 'Short put', sub: `Sell the ${K} put for ${fmt.usd(p.mark)}`, legs: [{ leg: { kind: 'option' as const, right: 'put' as const, K, qty: -1, premium: p.mark } }], view: 'Wants SPY to stay above the strike' },
];

export default function PayoffGallery() {
  return (
    <div className="not-content grid grid-cols-1 gap-3 sm:grid-cols-2">
      {CARDS.map((card) => (
        <figure key={card.title} className="viz-card m-0">
          <figcaption className="mb-1">
            <div className="text-[0.95rem] font-semibold text-(--sl-color-white)">{card.title}</div>
            <div className="text-[0.78rem] text-(--sl-color-gray-3)">
              {card.sub} · {card.view}
            </div>
          </figcaption>
          <PayoffChart legs={card.legs} lo={720} hi={820} height={190} spot={snapshot.spot} compact ariaLabel={`${card.title} payoff at expiration`} />
        </figure>
      ))}
    </div>
  );
}
