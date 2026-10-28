import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import LinesChart from './LinesChart';
import { pairAt, S0 } from './fdata';

/** Each leg of a 770 conversion/reversal at expiry, and their flat sum. */
export default function ConversionPayoff() {
  const [side, setSide] = useState<'conv' | 'rev'>('conv');
  const K = 770;
  const { call, put } = pairAt('nov', K);
  const sg = side === 'conv' ? 1 : -1;
  const stock = (x: number) => sg * (x - S0);
  const c = (x: number) => -sg * (Math.max(x - K, 0) - call.mark);
  const p = (x: number) => sg * (Math.max(K - x, 0) - put.mark);
  const total = (x: number) => stock(x) + c(x) + p(x);
  return (
    <div className="viz-card not-content">
      <CardHead
        title="Three sloping legs, one flat line"
        sub="770 strike, Nov 27, mid prices, P/L per share at expiry before interest"
        right={
          <Segmented
            label="Trade"
            value={side}
            onChange={setSide}
            options={[
              { value: 'conv', label: 'Conversion' },
              { value: 'rev', label: 'Reversal' },
            ]}
          />
        }
      />
      <LinesChart
        ariaLabel="Payoff of each leg and the flat total"
        lo={700}
        hi={840}
        height={320}
        marks={[{ x: K, label: 'K 770' }]}
        series={[
          { label: side === 'conv' ? 'Long SPY' : 'Short SPY', color: 'stock', fn: stock, width: 1.75 },
          { label: side === 'conv' ? 'Short 770 call' : 'Long 770 call', color: 'call', fn: c, width: 1.75 },
          { label: side === 'conv' ? 'Long 770 put' : 'Short 770 put', color: 'put', fn: p, width: 1.75 },
          { label: 'Total', color: 'ink', fn: total, width: 3.5 },
        ]}
      />
      <p className="mt-2 text-[0.8rem] text-(--sl-color-gray-3)">
        The total is {side === 'conv' ? '+' : '−'}${Math.abs(total(770)).toFixed(2)} per share at every price: exactly the strike minus the net cost of the
        package. Interest on the cash tied up for 31 days then takes it to zero.
      </p>
    </div>
  );
}
