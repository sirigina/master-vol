import { useState } from 'react';
import { Slider } from '../ui/Slider';
import { Segmented } from '../ui/Segmented';
import { snapshot, callAt, fmt, T_EXPIRY } from '../../lib/snapshot';
import { bs } from '../../lib/pricing';

const STRIKES = [740, 760, 770, 780, 800];

/**
 * Delta as a hedge ratio and as a P/L predictor. Compares the delta estimate
 * with a full reprice, which exposes gamma (D2).
 */
export default function DeltaHedge() {
  const [k, setK] = useState('770');
  const [n, setN] = useState(10);
  const [move, setMove] = useState(5);

  const K = +k;
  const q = callAt(K)!;
  const base = { K, T: T_EXPIRY, r: snapshot.rate, sigma: q.iv };
  const g0 = bs('call', { ...base, S: snapshot.spot });
  const g1 = bs('call', { ...base, S: snapshot.spot + move });
  const posDelta = n * 100 * g0.delta;
  const predicted = posDelta * move;
  const actual = n * 100 * (g1.price - g0.price);
  const hedged = actual - posDelta * move;

  const card = (label: string, value: string, sub?: string, accent?: string) => (
    <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2" style={accent ? { borderColor: accent } : undefined}>
      <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">{label}</div>
      <div className="text-[1rem] font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[0.75rem] text-(--sl-color-gray-3)">{sub}</div>}
    </div>
  );
  const usd0 = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`;

  return (
    <div className="viz-card not-content">
      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Long calls, Nov 27 expiry</div>
          <Segmented label="Strike" value={k} onChange={setK} options={STRIKES.map((s) => ({ value: String(s), label: String(s) }))} />
        </div>
        <Slider label="Contracts" value={n} min={1} max={50} step={1} onChange={setN} format={(v) => `${v}`} />
        <Slider label="SPY moves by" value={move} min={-30} max={30} step={1} onChange={setMove} format={(v) => `${fmt.signed(v, 0)} dollars`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {card('Delta per contract', g0.delta.toFixed(2), `vendor ${q.delta.toFixed(2)}`)}
        {card('Position delta', `${Math.round(posDelta).toLocaleString()} sh`, 'share-equivalent exposure')}
        {card('Hedge', `Sell ${Math.round(posDelta).toLocaleString()} SPY`, 'to be delta-neutral')}
        {card('Premium paid', usd0(n * 100 * q.mark).replace('+', ''), `${n} × 100 × ${fmt.usd(q.mark)}`)}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {card('Delta predicts', usd0(predicted), 'position delta × move', 'var(--viz-call)')}
        {card('Full reprice says', usd0(actual), 'Black-Scholes at the new price', 'var(--viz-stock)')}
        {card('Hedged P/L', usd0(hedged), 'the gap is gamma (lesson D2)', 'var(--viz-aqua)')}
      </div>
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        Volatility and time held fixed at the snapshot ({fmt.pct(q.iv)} IV, {snapshot.chain.dte} days) so only the price moves. Notice the
        hedged P/L is positive whichever way SPY moves.
      </p>
    </div>
  );
}
