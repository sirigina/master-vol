import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot, T_EXPIRY } from '../../../lib/snapshot';
import MultiPayoff from './MultiPayoff';
import { S0, bothStrikes, money0, money2 } from './common';
import { call, put, stock, stats, moneyInf } from './strategies';

const STRIKES = bothStrikes.filter((k) => k >= 750 && k <= 800);

/** Covered call vs cash-secured put at the same strike, real marks. */
export default function CoveredVsCsp() {
  const t = useTokens();
  const [k, setK] = useState('780');
  const [interest, setInterest] = useState<'off' | 'on'>('off');
  const K = +k;
  const cc = [stock(), call(K, -1)];
  const csp = [put(K, -1)];
  const r = snapshot.rate;
  const int = interest === 'on' ? K * (Math.exp(r * T_EXPIRY) - 1) : 0;
  const scc = stats(cc);
  const scsp = stats(csp);
  // gap = CC − CSP per share at any expiry price (constant)
  const cl = call(K, 1);
  const pl = put(K, 1);
  const gap = K - S0 + (cl.kind === 'option' ? cl.premium : 0) - (pl.kind === 'option' ? pl.premium : 0); // per share
  const carry = K * (Math.exp(r * T_EXPIRY) - 1);

  return (
    <div className="viz-card not-content">
      <CardHead title="Covered call vs cash-secured put, same strike" sub="Real Nov 27 marks. Same shape; the difference is a flat amount equal to interest on the strike." />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented label="Strike" value={k} onChange={setK} options={STRIKES.map((s) => ({ value: String(s), label: String(s) }))} />
        <Segmented
          label="Interest on put collateral"
          value={interest}
          onChange={setInterest}
          options={[
            { value: 'off', label: 'Cash earns 0%' },
            { value: 'on', label: `Cash earns ${(r * 100).toFixed(1)}%` },
          ]}
        />
      </div>
      <MultiPayoff
        tokens={t}
        lo={720}
        hi={820}
        spot={S0}
        series={[
          { label: `Covered call: own SPY, sell ${K} call`, color: t.call, legs: cc },
          { label: `Cash-secured put: sell ${K} put${interest === 'on' ? ' + interest' : ''}`, color: t.put, legs: csp, dash: true, extra: int },
        ]}
        ariaLabel="Covered call and cash-secured put payoffs at expiration"
      />
      <StatGrid
        items={[
          ['Covered call premium', money0(-scc.premium, false), `max profit ${moneyInf(scc.maxP)}`, 'var(--viz-call)'],
          ['Put premium', money0(-scsp.premium, false), `max profit ${moneyInf(scsp.maxP + int * 100)}`, 'var(--viz-put)'],
          ['Gap at every price', money2(Math.abs(gap - int)), gap - int >= 0 ? 'covered call ahead' : 'put ahead'],
          ['Interest on the cash', money2(carry), `${money0(K * 100, false)}, 31 days at 4.6%`],
        ]}
      />
      <p className="mt-2 text-[0.8rem] text-(--sl-color-gray-3)">
        Per share. Toggle the interest: once the put seller's {money0(K * 100, false)} of collateral earns the same rate, the two lines nearly coincide.
      </p>
    </div>
  );
}
