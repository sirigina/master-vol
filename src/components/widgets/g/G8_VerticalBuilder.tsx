import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import type { Right } from '../../../lib/pricing';
import PnlChart from './G6_PnlChart';
import { vertical, verticalPnl, FLAT_IV, type Dir } from './G8_vertical';
import { strikesOf, S0, money, num, usd } from './G6_helpers';

const XS = Array.from({ length: 151 }, (_, i) => 700 + i);

export default function VerticalBuilder() {
  const t = useTokens();
  const [dir, setDir] = useState<Dir>('bull');
  const [right, setRight] = useState<Right>('call');
  const [lo, setLo] = useState(770);
  const [hi, setHi] = useState(790);
  const strikes = strikesOf(right).filter((k) => k >= 700 && k <= 820);
  const loOk = strikes.includes(lo) ? lo : 770;
  const hiOk = strikes.includes(hi) && hi > loOk ? hi : strikes.find((k) => k > loOk)!;
  const v = vertical(dir, right, loOk, hiOk)!;
  const pnl = XS.map((s) => verticalPnl(v, s) * 100);
  const isDebit = v.net > 0;
  const longK = v.legs.find((l) => l.qty > 0)!;
  const shortK = v.legs.find((l) => l.qty < 0)!;
  const sel =
    'rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-2 py-1 text-[0.85rem] text-(--sl-color-white)';
  const name = `${dir === 'bull' ? 'Bull' : 'Bear'} ${right} spread ${loOk}/${hiOk}`;

  return (
    <div className="viz-card not-content">
      <CardHead title={name} sub={`${isDebit ? 'Debit' : 'Credit'} spread, Nov 27 expiry, mid prices. Buy ${longK.K} ${right} at ${num(longK.premium)}, sell ${shortK.K} ${right} at ${num(shortK.premium)}`} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Segmented label="Direction" value={dir} onChange={(d) => setDir(d)} options={[{ value: 'bull', label: 'Bull' }, { value: 'bear', label: 'Bear' }]} />
        <Segmented label="Option type" value={right} onChange={(r) => setRight(r)} options={[{ value: 'call', label: 'Calls' }, { value: 'put', label: 'Puts' }]} />
        <label className="text-[0.8rem] text-(--sl-color-gray-3)">
          Lower strike{' '}
          <select className={sel} value={loOk} onChange={(e) => setLo(+e.target.value)}>
            {strikes.slice(0, -1).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[0.8rem] text-(--sl-color-gray-3)">
          Upper strike{' '}
          <select className={sel} value={hiOk} onChange={(e) => setHi(+e.target.value)}>
            {strikes
              .filter((k) => k > loOk)
              .map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        </label>
      </div>
      <PnlChart
        xs={XS}
        series={[{ label: 'P/L at expiry', color: t.ink, values: pnl, wash: true }]}
        markers={[{ x: S0, label: `today ${S0.toFixed(0)}` }]}
        dots={[{ x: v.breakeven, y: 0, color: t.ink }]}
        xLabel="SPY price on November 27"
        ariaLabel="Vertical spread profit and loss at expiration"
        height={280}
      />
      <StatGrid
        items={[
          [isDebit ? 'Debit paid' : 'Credit received', usd(v.net * 100), `${num(Math.abs(v.net))} per share`],
          ['Max gain', money(v.maxGain * 100), isDebit ? 'width − debit' : 'the credit', t.profit],
          ['Max loss', money(-v.maxLoss * 100), isDebit ? 'the debit' : 'width − credit', t.loss],
          ['Breakeven', v.breakeven.toFixed(2), `model P(profit) ≈ ${(v.pProfit * 100).toFixed(0)}%`],
        ]}
      />
      <p className="mt-3 text-[0.8rem] text-(--sl-color-gray-3)">
        Skew check: with both legs at a flat {(FLAT_IV * 100).toFixed(1)}% IV this spread would {v.flatNet >= 0 ? 'cost' : 'collect'} {num(Math.abs(v.flatNet))}; the market
        {v.net >= 0 ? ' charges ' : ' pays '}
        {num(Math.abs(v.net))}. Probability uses the snapshot smile at the breakeven (risk-neutral, not a forecast). Per contract, before commissions and financing.
      </p>
    </div>
  );
}
