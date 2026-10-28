import { useMemo, useState } from 'react';
import GChart from './G1_Chart';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { bs } from '../../../lib/pricing';
import type { OptLeg } from '../../../lib/position';
import { leg, net, expiryStats, greeksAt, contractGreeks, pnlAt, costLabel, S0, R, T_EXPIRY, atmIv, money } from './G1_kit';
import { useTokens } from '../../../lib/useViz';

const CASES = {
  p770: { label: '770/750 put 1×2', right: 'put' as const, near: 770, far: 750 },
  p760: { label: '760/740 put 1×2', right: 'put' as const, near: 760, far: 740 },
  c770: { label: '770/790 call 1×2', right: 'call' as const, near: 770, far: 790 },
  c780: { label: '780/800 call 1×2', right: 'call' as const, near: 780, far: 800 },
};
type Key = keyof typeof CASES;

function flatLeg(l: OptLeg): OptLeg {
  const p = bs(l.right, { S: S0, K: l.K, T: T_EXPIRY, r: R, sigma: atmIv }).price;
  return { ...l, premium: p, iv: atmIv };
}

/** G5: price the same ratio with the real skew vs a flat ATM IV. */
export default function G5SkewEffect() {
  const [key, setKey] = useState<Key>('p770');
  const t = useTokens();
  const c = CASES[key];
  const real = useMemo(() => [leg(c.right, c.near, 1), leg(c.right, c.far, -2)], [key]);
  const flat = useMemo(() => real.map(flatLeg), [real]);
  const sr = expiryStats(real);
  const sf = expiryStats(flat);
  const gr = contractGreeks(greeksAt(real));
  const gf = contractGreeks(greeksAt(flat));
  const lo = c.right === 'put' ? 690 : 740;
  const hi = c.right === 'put' ? 800 : 850;

  const row = (label: string, a: string, b: string, note?: string) => (
    <tr className="border-t border-(--sl-color-hairline)">
      <td className="py-1.5 pr-3">{label}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">{a}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{b}</td>
      <td className="hidden py-1.5 text-[0.78rem] text-(--sl-color-gray-3) sm:table-cell">{note}</td>
    </tr>
  );
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Same ratio, two volatility assumptions"
        sub={`Real skew: each strike at its own IV. Flat: every strike at the ${(atmIv * 100).toFixed(1)}% ATM IV.`}
        right={<Segmented label="Spread" value={key} onChange={setKey} options={(Object.keys(CASES) as Key[]).map((k) => ({ value: k, label: CASES[k].label }))} />}
      />
      <GChart
        series={[
          { key: 'real', label: 'Real skew prices', color: (tk) => (c.right === 'put' ? tk.put : tk.call), width: 2.5, f: (x) => pnlAt(real, x) },
          { key: 'flat', label: 'Flat-IV prices', color: (tk) => tk.muted, dash: '6 4', f: (x) => pnlAt(flat, x) },
        ]}
        lo={lo}
        hi={hi}
        spot={S0}
        height={280}
        yDomain={[-2500, 2500]}
        ariaLabel="Expiry P/L of the ratio spread priced with real skew and with flat IV"
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[0.82rem]">
          <thead>
            <tr className="text-(--sl-color-gray-3)">
              <th className="py-1.5 pr-3 text-left font-medium">Per 1×2</th>
              <th className="py-1.5 pr-3 text-right font-medium">Real skew</th>
              <th className="py-1.5 pr-3 text-right font-medium">Flat IV</th>
              <th className="hidden py-1.5 text-left font-medium sm:table-cell" />
            </tr>
          </thead>
          <tbody>
            {row(`IV, ${c.near} (buy 1)`, pct(real[0].iv), pct(atmIv))}
            {row(`IV, ${c.far} (sell 2)`, pct(real[1].iv), pct(atmIv), c.right === 'put' ? 'OTM puts are bid up' : 'OTM calls are cheap')}
            {row('Net premium', costLabel(sr.cost), costLabel(sf.cost))}
            {row('Max gain at expiry', money(sr.maxGain), money(sf.maxGain), `SPY exactly at ${c.far}`)}
            {row('Breakevens', sr.be.map((b) => b.toFixed(2)).join(' / ') || 'none', sf.be.map((b) => b.toFixed(2)).join(' / ') || 'none')}
            {row('Vega', `${money(gr.vega / 100, 100, true)}`, `${money(gf.vega / 100, 100, true)}`, 'per vol point')}
            {row('Theta', `${money(gr.theta / 100, 100, true)}`, `${money(gf.theta / 100, 100, true)}`, 'per day')}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)" style={{ color: t.muted }}>
        Difference in net premium: {money(Math.abs(sr.cost - sf.cost))} per spread {sr.cost < sf.cost ? 'in the ratio writer\'s favor' : 'against the ratio writer'} with real skew.
      </p>
    </div>
  );
}
