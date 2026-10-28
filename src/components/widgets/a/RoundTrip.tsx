import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { quote, callStrikes, putStrikes, money0, money2, selectCls } from './common';

type Fill = 'mid' | 'third' | 'natural';
const FILLS: Record<Fill, { label: string; frac: number; note: string }> = {
  mid: { label: 'Mid', frac: 0, note: 'filled at the mark both ways (best case)' },
  third: { label: 'Mid ± ⅓', frac: 1 / 3, note: 'pay a third of the half-spread beyond the mark each way' },
  natural: { label: 'Natural', frac: 1, note: 'buy at the ask, sell at the bid' },
};

/** What it costs to get in and out, at different fill assumptions. */
export default function RoundTrip() {
  const [right, setRight] = useState<'call' | 'put'>('call');
  const [k, setK] = useState(770);
  const [n, setN] = useState(10);
  const [fill, setFill] = useState<Fill>('natural');
  const [fee, setFee] = useState(0.65);
  const strikes = right === 'call' ? callStrikes : putStrikes;
  const K = strikes.includes(k) ? k : 770;
  const q = quote(right, K)!;
  const half = (q.ask - q.bid) / 2;
  const slip = half * FILLS[fill].frac; // per share, per side, vs mark
  const buyPx = q.mark + slip;
  const sellPx = q.mark - slip;
  const spreadCost = 2 * slip * 100 * n;
  const fees = 2 * fee * n;
  const total = spreadCost + fees;
  const premium = q.mark * 100 * n;
  const moveNeeded = total / (100 * n * Math.abs(q.delta));

  return (
    <div className="viz-card not-content">
      <CardHead title="Round-trip cost calculator" sub="Buy now, sell later at the same mark: what does the trip cost? Real Nov 27 quotes." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
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
          <div>
            <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Fill assumption</div>
            <Segmented label="Fill assumption" value={fill} onChange={setFill} options={Object.entries(FILLS).map(([v, o]) => ({ value: v as Fill, label: o.label }))} />
            <div className="mt-1 text-[0.76rem] text-(--sl-color-gray-3)">{FILLS[fill].note}</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Slider label="Contracts" value={n} min={1} max={50} step={1} onChange={setN} format={(v) => `${v}`} />
          <Slider label="Commission + fees per contract, per side" value={fee} min={0} max={1.5} step={0.05} onChange={setFee} format={(v) => money2(v)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.78rem] tabular-nums text-(--sl-color-gray-2)">
        <span>bid {q.bid.toFixed(2)}</span>
        <span>mark {q.mark.toFixed(2)}</span>
        <span>ask {q.ask.toFixed(2)}</span>
        <span>
          → you buy at <b className="text-(--sl-color-white)">{buyPx.toFixed(3)}</b>, sell at <b className="text-(--sl-color-white)">{sellPx.toFixed(3)}</b>
        </span>
      </div>

      <StatGrid
        items={[
          ['Premium at the mark', money0(premium, false), `${n} × 100 × ${money2(q.mark)}`],
          ['Spread cost, round trip', money0(spreadCost, false), `${money2(2 * slip)} per share`],
          ['Fees, round trip', money0(fees, false), `${money2(fee)} × ${n} × 2`],
          ['Total cost', money0(total, false), `${((total / premium) * 100).toFixed(2)}% of the premium`, 'var(--viz-loss)'],
        ]}
      />
      <p className="mt-3 text-[0.82rem] text-(--sl-color-gray-2)">
        To break even on costs alone, SPY must move about <b className="text-(--sl-color-white)">${moveNeeded.toFixed(2)}</b> in your favor (total cost ÷ position
        delta of {Math.round(100 * n * Math.abs(q.delta)).toLocaleString()} shares). Fees are illustrative; check your broker.
      </p>
    </div>
  );
}
