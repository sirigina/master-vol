import { useState } from 'react';
import PayoffChart from '../PayoffChart';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import type { Leg } from '../../../lib/pricing';
import { S0 } from './common';
import { call, put, stock, stats, moneyInf } from './strategies';

type View = 'bull' | 'bear' | 'neutral' | 'volatile' | 'hedge';
type Cost = 'pay' | 'low' | 'collect';

interface Strat {
  name: string;
  how: string;
  why: string;
  legs: Leg[];
}

const S: Record<string, Strat> = {
  longCall: { name: 'Long call', how: 'Buy the 770 call', why: 'Full upside above the breakeven; the premium is the most you can lose.', legs: [call(770, 1)] },
  bullCall: { name: 'Bull call spread', how: 'Buy 770 call, sell 790 call', why: 'Cheaper than the call alone; gains stop at 790.', legs: [call(770, 1), call(790, -1)] },
  csp: { name: 'Cash-secured put', how: 'Sell the 750 put, hold $75,000 cash', why: 'Paid to wait; if SPY drops below 750 you buy it there.', legs: [put(750, -1)] },
  longPut: { name: 'Long put', how: 'Buy the 770 put', why: 'Gains as SPY falls below the breakeven; loss limited to the premium.', legs: [put(770, 1)] },
  bearPut: { name: 'Bear put spread', how: 'Buy 770 put, sell 750 put', why: 'Cheaper downside bet; gains stop at 750.', legs: [put(770, 1), put(750, -1)] },
  bearCall: { name: 'Bear call spread', how: 'Sell 780 call, buy 800 call', why: 'Collect premium; keep it all if SPY stays below 780. Loss capped by the 800.', legs: [call(780, -1), call(800, 1)] },
  ccNeutral: { name: 'Covered call', how: 'Own 100 SPY, sell the 780 call', why: 'Extra income on shares; upside capped at 780.', legs: [stock(), call(780, -1)] },
  cspNeutral: { name: 'Cash-secured put', how: 'Sell the 760 put, hold $76,000 cash', why: 'Collect premium if SPY holds; buy at 760 if it does not.', legs: [put(760, -1)] },
  straddle: { name: 'Long straddle', how: 'Buy 770 call and 770 put', why: 'Profits from a big move either way; needs more than the premium to pay.', legs: [call(770, 1), put(770, 1)] },
  strangle: { name: 'Long strangle', how: 'Buy 750 put and 790 call', why: 'Cheaper than the straddle; needs a bigger move.', legs: [put(750, 1), call(790, 1)] },
  protPut: { name: 'Protective put', how: 'Own 100 SPY, buy the 750 put', why: 'A floor under the shares; upside fully kept, minus the premium.', legs: [stock(), put(750, 1)] },
  collar: { name: 'Collar', how: 'Own 100 SPY, buy 750 put, sell 790 call', why: 'The call pays for most of the put; range of outcomes bounded both ways.', legs: [stock(), put(750, 1), call(790, -1)] },
  ccHedge: { name: 'Covered call', how: 'Own 100 SPY, sell the 790 call', why: 'Only a cushion, not a floor: the premium offsets the first few dollars of a fall.', legs: [stock(), call(790, -1)] },
};

const MAP: Record<View, Record<Cost, string[] | string>> = {
  bull: { pay: ['longCall'], low: ['bullCall'], collect: ['csp'] },
  bear: { pay: ['longPut'], low: ['bearPut'], collect: ['bearCall'] },
  neutral: {
    pay: 'Buying options needs movement to pay off. A neutral view is usually expressed by collecting premium; switch to "Collect premium".',
    low: 'Low-cost neutral structures (butterflies, condors) come in lesson G4. Among the elementary strategies, a neutral view means collecting premium.',
    collect: ['ccNeutral', 'cspNeutral'],
  },
  volatile: {
    pay: ['straddle'],
    low: ['strangle'],
    collect: 'Collecting premium is a bet that SPY stays calm, the opposite of this view. Switch to "Pay premium" or "Keep cost low".',
  },
  hedge: { pay: ['protPut'], low: ['collar'], collect: ['ccHedge'] },
};

const VIEWS: { value: View; label: string }[] = [
  { value: 'bull', label: 'Bullish' },
  { value: 'bear', label: 'Bearish' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'volatile', label: 'Big move' },
  { value: 'hedge', label: 'Own SPY, protect it' },
];
const COSTS: { value: Cost; label: string }[] = [
  { value: 'pay', label: 'Pay premium' },
  { value: 'low', label: 'Keep cost low' },
  { value: 'collect', label: 'Collect premium' },
];

export default function StrategyMatcher() {
  const [view, setView] = useState<View>('bull');
  const [cost, setCost] = useState<Cost>('pay');
  const hit = MAP[view][cost];

  return (
    <div className="viz-card not-content">
      <CardHead title="Match the view to a strategy" sub="Pick what you expect and how you want to pay. Real Nov 27 marks; P/L per contract at expiration." />
      <div className="flex flex-col gap-2">
        <Segmented label="Market view" value={view} onChange={setView} options={VIEWS} />
        <Segmented label="Cost preference" value={cost} onChange={setCost} options={COSTS} />
      </div>
      {typeof hit === 'string' ? (
        <p className="mt-4 rounded-lg border border-dashed border-(--sl-color-hairline-shade) px-3 py-3 text-[0.86rem] text-(--sl-color-gray-2)">{hit}</p>
      ) : (
        <div className={`mt-4 grid grid-cols-1 gap-4 ${hit.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {hit.map((key) => {
            const st = S[key];
            const s = stats(st.legs);
            return (
              <div key={key} className="rounded-lg border border-(--sl-color-hairline) p-3">
                <div className="text-[0.92rem] font-semibold text-(--sl-color-white)">{st.name}</div>
                <div className="text-[0.8rem] text-(--sl-color-gray-3)">
                  {st.how}. {st.why}
                </div>
                <PayoffChart legs={st.legs.map((leg) => ({ leg }))} lo={710} hi={830} height={hit.length > 1 ? 200 : 230} spot={S0} compact ariaLabel={`${st.name} payoff`} />
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8rem] tabular-nums sm:grid-cols-4">
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-wide text-(--sl-color-gray-3)">Premium</div>
                    {s.premium >= 0 ? `Pay ${moneyInf(s.premium)}` : `Collect ${moneyInf(-s.premium)}`}
                  </div>
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-wide text-(--sl-color-gray-3)">Max profit</div>
                    {moneyInf(s.maxP)}
                  </div>
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-wide text-(--sl-color-gray-3)">Max loss</div>
                    {moneyInf(s.maxL)}
                  </div>
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-wide text-(--sl-color-gray-3)">Breakeven</div>
                    {s.be.map((b) => b.toFixed(2)).join(' / ')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
