import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import type { Right } from '../../../lib/pricing';
import Heatmap from './G6_Heatmap';
import { vertical, type Dir } from './G8_vertical';
import { strikesOf, money, usd } from './G6_helpers';

type Kind = 'bullCall' | 'bearPut' | 'bullPut' | 'bearCall';
const KINDS: Record<Kind, { dir: Dir; right: Right; label: string }> = {
  bullCall: { dir: 'bull', right: 'call', label: 'Bull call' },
  bearPut: { dir: 'bear', right: 'put', label: 'Bear put' },
  bullPut: { dir: 'bull', right: 'put', label: 'Bull put' },
  bearCall: { dir: 'bear', right: 'call', label: 'Bear call' },
};

/** Reward-to-risk (or probability) of every vertical in the Nov 27 chain. */
export default function RiskRewardMap() {
  const [kind, setKind] = useState<Kind>('bullCall');
  const [metric, setMetric] = useState<'rr' | 'p'>('rr');
  const { dir, right } = KINDS[kind];
  const ks = strikesOf(right).filter((k) => k >= 700 && k <= 820);
  const lows = ks.slice(0, -1);
  const highs = ks.slice(1);
  const vs = lows.map((lo) => highs.map((hi) => (hi > lo ? vertical(dir, right, lo, hi) : null)));
  const values = vs.map((row) => row.map((v) => (v ? (metric === 'rr' ? Math.log(v.maxGain / v.maxLoss) : v.pProfit) : null)));
  const fmtCell = (x: number) => (metric === 'rr' ? (Math.exp(x) >= 10 ? Math.exp(x).toFixed(0) : Math.exp(x).toFixed(1)) : `${Math.round(x * 100)}`);

  return (
    <div className="viz-card not-content">
      <CardHead
        title={`${KINDS[kind].label} spreads: ${metric === 'rr' ? 'reward-to-risk' : 'probability of profit'} across strike pairs`}
        sub={metric === 'rr' ? 'Max gain ÷ max loss at expiry, Nov 27 mid prices. Darker = bigger payoff per dollar risked.' : 'Risk-neutral probability of finishing past the breakeven (%), from the snapshot smile. Darker = more likely.'}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Segmented label="Spread type" value={kind} onChange={setKind} options={(Object.keys(KINDS) as Kind[]).map((k) => ({ value: k, label: KINDS[k].label }))} />
        <Segmented label="Metric" value={metric} onChange={setMetric} options={[{ value: 'rr', label: 'Reward : risk' }, { value: 'p', label: 'P(profit)' }]} />
      </div>
      <Heatmap
        cols={highs.map(String)}
        rows={lows.map(String)}
        values={values}
        xLabel="Upper strike"
        yLabel="Lower strike"
        mode="sequential"
        fmtCell={fmtCell}
        cellH={28}
        ariaLabel="Heatmap of vertical spread reward to risk by strike pair"
        tip={(r, c) => {
          const v = vs[r][c]!;
          return (
            <>
              <div style={{ color: 'var(--sl-color-gray-3)' }}>
                {KINDS[kind].label} {v.lo}/{v.hi}
              </div>
              <div>
                {v.net > 0 ? 'Debit' : 'Credit'}: <b>{usd(v.net * 100)}</b>
              </div>
              <div>
                Gain / loss: <b>{money(v.maxGain * 100)}</b> / <b>{money(-v.maxLoss * 100)}</b>
              </div>
              <div>
                Ratio: <b>{(v.maxGain / v.maxLoss).toFixed(2)}</b>, P(profit) <b>{(v.pProfit * 100).toFixed(0)}%</b>
              </div>
            </>
          );
        }}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Grey cells are impossible pairs (upper ≤ lower). Per contract, mid prices, before commissions. Hover or tap a cell for details.
      </p>
    </div>
  );
}
