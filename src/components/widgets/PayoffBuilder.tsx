import { useMemo, useState } from 'react';
import PayoffChart, { type PricedLeg } from './PayoffChart';
import { Segmented } from '../ui/Segmented';
import { snapshot, callAt, putAt, T_EXPIRY, fmt } from '../../lib/snapshot';
import { positionPnlAtExpiry, breakevens } from '../../lib/pricing';

type Side = 'buy' | 'sell';
type Kind = 'call' | 'put' | 'stock';
interface Row {
  side: Side;
  kind: Kind;
  strike: number;
  qty: number;
}

const STRIKES = snapshot.chain.calls.map((c) => c.strike).filter((k) => putAt(k));
const S0 = snapshot.spot;

const PRESETS: Record<string, { label: string; rows: Row[]; note: string }> = {
  longCall: { label: 'Long call', note: 'Pay a premium for unlimited upside; the most you can lose is what you paid.', rows: [{ side: 'buy', kind: 'call', strike: 770, qty: 1 }] },
  longPut: { label: 'Long put', note: 'Insurance against a fall: gains as SPY drops below the strike minus the premium.', rows: [{ side: 'buy', kind: 'put', strike: 770, qty: 1 }] },
  shortPut: { label: 'Short put', note: 'Collect a premium; you are on the hook if SPY falls. Same shape as a covered call.', rows: [{ side: 'sell', kind: 'put', strike: 750, qty: 1 }] },
  coveredCall: { label: 'Covered call', note: 'Own 100 shares, sell a call: income now, upside capped above the strike.', rows: [{ side: 'buy', kind: 'stock', strike: 0, qty: 1 }, { side: 'sell', kind: 'call', strike: 790, qty: 1 }] },
  protectivePut: { label: 'Protective put', note: 'Own 100 shares, buy a put: a floor under your loss, at the cost of the premium.', rows: [{ side: 'buy', kind: 'stock', strike: 0, qty: 1 }, { side: 'buy', kind: 'put', strike: 750, qty: 1 }] },
  bullCall: { label: 'Bull call spread', note: 'Buy a call, sell a higher call: cheaper upside with a ceiling.', rows: [{ side: 'buy', kind: 'call', strike: 770, qty: 1 }, { side: 'sell', kind: 'call', strike: 790, qty: 1 }] },
  straddle: { label: 'Long straddle', note: 'Buy the call and the put at the same strike: you need a big move either way.', rows: [{ side: 'buy', kind: 'call', strike: 770, qty: 1 }, { side: 'buy', kind: 'put', strike: 770, qty: 1 }] },
};

function toLegs(rows: Row[]): PricedLeg[] {
  return rows.map((r) => {
    const sign = r.side === 'buy' ? 1 : -1;
    if (r.kind === 'stock') return { leg: { kind: 'stock', qty: sign * r.qty, entry: S0 } };
    const q = r.kind === 'call' ? callAt(r.strike)! : putAt(r.strike)!;
    return { leg: { kind: 'option', right: r.kind, K: r.strike, qty: sign * r.qty, premium: q.mark }, iv: q.iv };
  });
}

const LO = 690;
const HI = 850;

export default function PayoffBuilder({ initial = 'longCall' }: { initial?: keyof typeof PRESETS }) {
  const [preset, setPreset] = useState<string>(initial);
  const [rows, setRows] = useState<Row[]>(PRESETS[initial].rows);
  const [showToday, setShowToday] = useState(false);

  const legs = useMemo(() => toLegs(rows), [rows]);
  const raw = legs.map((l) => l.leg);

  const stats = useMemo(() => {
    const premium = legs.reduce((a, { leg }) => (leg.kind === 'option' ? a + leg.qty * leg.premium : a), 0) * 100;
    const grid = Array.from({ length: 2001 }, (_, i) => (i * 2000) / 2000);
    const vals = grid.map((s) => positionPnlAtExpiry(raw, s) * 100);
    const slopeUp = positionPnlAtExpiry(raw, 5001) - positionPnlAtExpiry(raw, 5000);
    const maxP = slopeUp > 1e-9 ? Infinity : Math.max(...vals);
    const minP = slopeUp < -1e-9 ? -Infinity : Math.min(...vals);
    return { premium, maxP, minP, be: breakevens(raw, 1, 2000, 20000) };
  }, [legs]);

  function loadPreset(k: string) {
    setPreset(k);
    setRows(PRESETS[k].rows);
  }
  function update(i: number, patch: Partial<Row>) {
    setPreset('custom');
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addLeg() {
    setPreset('custom');
    setRows((rs) => (rs.length >= 4 ? rs : [...rs, { side: 'buy', kind: 'call', strike: 780, qty: 1 }]));
  }
  function removeLeg(i: number) {
    setPreset('custom');
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((_, j) => j !== i)));
  }

  const money = (v: number) =>
    v === Infinity ? 'Unlimited' : v === -Infinity ? 'Unlimited' : `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`;

  const sel =
    'rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-2 py-1 text-[0.82rem] text-(--sl-color-white)';

  return (
    <div className="viz-card not-content">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Strategy preset"
          value={preset}
          onChange={loadPreset}
          options={Object.entries(PRESETS).map(([k, v]) => ({ value: k, label: v.label }))}
        />
      </div>
      <p className="mb-3 text-[0.85rem] text-(--sl-color-gray-2)">
        {preset === 'custom' ? 'Custom position. Edit any leg below.' : PRESETS[preset].note}
      </p>

      <PayoffChart
        legs={legs}
        lo={LO}
        hi={HI}
        spot={S0}
        today={showToday ? { T: T_EXPIRY, r: snapshot.rate } : null}
        ariaLabel="Payoff diagram for the selected SPY options position"
      />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Net premium', stats.premium >= 0 ? `Pay ${money(stats.premium)}` : `Collect ${money(-stats.premium)}`],
          ['Max profit', money(stats.maxP)],
          ['Max loss', money(stats.minP)],
          ['Breakeven', stats.be.length ? stats.be.map((b) => b.toFixed(2)).join(' / ') : 'None'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
            <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">{k}</div>
            <div className="text-[0.95rem] font-semibold tabular-nums text-(--sl-color-white)">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-[0.82rem]">
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              <th className="py-1 pr-2 font-medium">Side</th>
              <th className="py-1 pr-2 font-medium">Type</th>
              <th className="py-1 pr-2 font-medium">Strike</th>
              <th className="py-1 pr-2 font-medium">Qty</th>
              <th className="py-1 pr-2 text-right font-medium">Price (mark)</th>
              <th className="py-1 pr-2 text-right font-medium">IV</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const q = r.kind === 'call' ? callAt(r.strike) : r.kind === 'put' ? putAt(r.strike) : undefined;
              return (
                <tr key={i} className="border-t border-(--sl-color-hairline)">
                  <td className="py-1.5 pr-2">
                    <select className={sel} value={r.side} onChange={(e) => update(i, { side: e.target.value as Side })} aria-label="Buy or sell">
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      className={sel}
                      value={r.kind}
                      onChange={(e) => update(i, { kind: e.target.value as Kind, strike: r.strike || 770 })}
                      aria-label="Instrument"
                    >
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                      <option value="stock">100 shares</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.kind === 'stock' ? (
                      <span className="text-(--sl-color-gray-3)">—</span>
                    ) : (
                      <select className={sel} value={r.strike} onChange={(e) => update(i, { strike: +e.target.value })} aria-label="Strike">
                        {STRIKES.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <select className={sel} value={r.qty} onChange={(e) => update(i, { qty: +e.target.value })} aria-label="Quantity">
                      {[1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{q ? fmt.usd(q.mark) : fmt.usd(S0)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{q ? fmt.pct(q.iv) : '—'}</td>
                  <td className="py-1.5 text-right">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLeg(i)}
                        className="cursor-pointer rounded border-0 bg-transparent px-1.5 text-(--sl-color-gray-3) hover:text-(--sl-color-white)"
                        aria-label={`Remove leg ${i + 1}`}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={addLeg}
          disabled={rows.length >= 4}
          className="cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-transparent px-3 py-1 text-[0.82rem] font-medium text-(--sl-color-white) hover:bg-(--sl-color-gray-6) disabled:opacity-40"
        >
          + Add leg
        </button>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[0.82rem] text-(--sl-color-gray-2)">
          <input type="checkbox" checked={showToday} onChange={(e) => setShowToday(e.target.checked)} />
          Also show value today, {snapshot.chain.dte} days before expiry (preview of B4)
        </label>
      </div>
    </div>
  );
}
