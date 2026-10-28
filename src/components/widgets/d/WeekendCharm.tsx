import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { S0, IV0, VOL0, g, usd0 } from './common';

const STRIKES = [
  { K: 740, tag: 'ITM' },
  { K: 770, tag: 'ATM' },
  { K: 800, tag: 'OTM' },
];

/** Delta drift over a weekend (charm) for ITM/ATM/OTM calls, SPY and IV unchanged. */
export default function WeekendCharm() {
  const [dte, setDte] = useState(10);
  const [n, setN] = useState(10);
  const [vol, setVol] = useState(VOL0);
  const [days, setDays] = useState<'3' | '1'>('3');
  const gap = +days;
  const sigma = vol / 100;

  const rows = STRIKES.map((s) => {
    const a = g('call', S0, s.K, dte, sigma);
    const b = g('call', S0, s.K, dte - gap, sigma);
    return { ...s, a, b, dDelta: b.delta - a.delta, shares: (b.delta - a.delta) * 100 * n, pnl: (b.price - a.price) * 100 * n };
  });

  return (
    <div className="viz-card not-content">
      <CardHead title="What happens to your hedge over a weekend" sub={`Long calls, SPY stays at ${S0}, volatility unchanged; only the calendar moves. Model illustration.`} />
      <div className="mb-3">
        <Segmented
          label="Time passing"
          value={days}
          onChange={setDays}
          options={[
            { value: '3', label: 'Fri → Mon (3 days)' },
            { value: '1', label: 'One weekday' },
          ]}
        />
      </div>
      <div className="mb-3 grid gap-4 sm:grid-cols-3 sm:items-end">
        <Slider label="Days left on Friday" value={dte} min={4} max={60} step={1} onChange={setDte} format={(v) => `${v}`} />
        <Slider label="Contracts" value={n} min={1} max={50} step={1} onChange={setN} format={(v) => `${v}`} />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <table className="w-full border-collapse text-[0.85rem] tabular-nums">
        <thead>
          <tr className="text-left text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">
            <th className="py-1.5 pr-2 font-medium">Call</th>
            <th className="py-1.5 pr-2 font-medium">Delta {days === '3' ? 'Fri → Mon' : 'day 1 → 2'}</th>
            <th className="py-1.5 pr-2 font-medium">Delta change</th>
            <th className="py-1.5 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.K} className="border-t border-(--sl-color-hairline)">
              <td className="whitespace-nowrap py-2 pr-2 font-semibold">
                {r.K} <span className="font-normal text-(--sl-color-gray-3)">{r.tag}</span>
              </td>
              <td className="py-2 pr-2">
                {r.a.delta.toFixed(3)} → {r.b.delta.toFixed(3)}
              </td>
              <td className="whitespace-nowrap py-2 pr-2" style={{ color: Math.abs(r.shares) < 0.5 ? undefined : r.shares > 0 ? 'var(--viz-call)' : 'var(--viz-put)' }}>
                {Math.abs(r.shares) < 0.5 ? '0' : `${r.shares > 0 ? '+' : '−'}${Math.abs(Math.round(r.shares))}`} sh
              </td>
              <td className="whitespace-nowrap py-2">{usd0(r.pnl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[0.8rem] text-(--sl-color-gray-3)">
        Delta change = change in position delta × 100 × contracts, in shares (sh). Value = change in the position's value. A hedge set on Friday is off by that many shares on Monday morning, even though SPY did not move (+21 means you need 21 more shares short).
        In-the-money deltas drift toward 1, out-of-the-money deltas toward 0.
      </p>
    </div>
  );
}
