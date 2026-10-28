import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { S0, MULT, quote, bothStrikes, money0, money2, selectCls } from './common';

type Pos = 'lc' | 'sc' | 'lp' | 'sp';
type Settle = 'physical' | 'cash';

const POS: Record<Pos, { label: string; right: 'call' | 'put'; sign: 1 | -1 }> = {
  lc: { label: 'Long call', right: 'call', sign: 1 },
  sc: { label: 'Short call', right: 'call', sign: -1 },
  lp: { label: 'Long put', right: 'put', sign: 1 },
  sp: { label: 'Short put', right: 'put', sign: -1 },
};

/**
 * What actually happens at expiration for a position, given the closing price:
 * auto-exercise or expire, shares and cash moved, and what you hold on Monday.
 */
export default function ExpirationSimulator() {
  const [pos, setPos] = useState<Pos>('lc');
  const [k, setK] = useState(770);
  const [n, setN] = useState(1);
  const [px, setPx] = useState(775);
  const [settle, setSettle] = useState<Settle>('physical');

  const { right, sign } = POS[pos];
  const q = quote(right, k)!;
  const itmBy = right === 'call' ? px - k : k - px;
  const itm = itmBy >= 0.01 - 1e-9;
  const intrinsicVal = Math.max(itmBy, 0);
  const premium = sign * q.mark * MULT * n; // + paid, − received
  const optionPnl = sign * intrinsicVal * MULT * n - premium;
  const shares = n * MULT;
  // share direction for the account: long call / short put end up long shares
  const shareDir = (right === 'call' ? 1 : -1) * sign; // +1 = receive shares
  const cashForShares = -shareDir * k * shares; // receive shares => pay cash

  let event: string;
  let detail: string;
  let holding: string;
  if (!itm) {
    event = 'Expires worthless';
    detail =
      itmBy > -0.5
        ? `Out of the money by ${money2(-itmBy)}. Nothing is exercised by default, but a holder can still choose to exercise until 5:30 p.m. ET.`
        : `Out of the money by ${money2(-itmBy)}. Nothing moves.`;
    holding = sign > 0 ? `No position. Premium of ${money0(premium, false)} lost.` : `No position. Premium of ${money0(-premium, false)} kept.`;
  } else if (settle === 'cash') {
    event = sign > 0 ? 'Auto-exercised for cash' : 'Assigned, settled in cash';
    detail = `In the money by ${money2(itmBy)}. ${sign > 0 ? 'You receive' : 'You pay'} ${money0(intrinsicVal * MULT * n, false)} (${money2(itmBy)} × 100 × ${n}). No shares change hands.`;
    holding = 'No position. Flat over the weekend.';
  } else {
    event = sign > 0 ? 'Auto-exercised' : 'Assigned';
    const verb = shareDir > 0 ? 'buy' : 'sell';
    detail = `In the money by ${money2(itmBy)} (≥ $0.01), so the OCC exercises it unless the holder says otherwise. You ${verb} ${shares.toLocaleString()} shares at ${k}.`;
    holding =
      shareDir > 0
        ? `Long ${shares.toLocaleString()} SPY at a ${k} cost basis, worth ${money0(px * shares, false)} at the close.`
        : `Short ${shares.toLocaleString()} SPY at ${k} (or ${shares.toLocaleString()} fewer shares if you owned them), worth ${money0(px * shares, false)} at the close.`;
  }

  const gap = 5;
  const weekendRisk = itm && settle === 'physical' ? shareDir * shares * gap : 0;

  return (
    <div className="viz-card not-content">
      <CardHead title="Expiration day: what happens to my position?" sub="Nov 27 contracts at their real marks. Drag the final SPY price." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Segmented label="Position" value={pos} onChange={setPos} options={Object.entries(POS).map(([v, o]) => ({ value: v as Pos, label: o.label }))} />
          <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-(--sl-color-gray-3)">
            <label className="inline-flex items-center gap-2">
              Strike
              <select className={selectCls} value={k} onChange={(e) => setK(+e.target.value)} aria-label="Strike">
                {bothStrikes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2">
              Contracts
              <select className={selectCls} value={n} onChange={(e) => setN(+e.target.value)} aria-label="Contracts">
                {[1, 2, 5, 10].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Segmented
            label="Settlement"
            value={settle}
            onChange={setSettle}
            options={[
              { value: 'physical', label: 'SPY: shares' },
              { value: 'cash', label: 'SPX-style: cash' },
            ]}
          />
        </div>
        <div className="flex flex-col justify-end gap-3">
          <Slider label="SPY closing price, Nov 27" value={px} min={740} max={800} step={0.01} onChange={setPx} format={(v) => v.toFixed(2)} />
          <div className="flex flex-wrap gap-1.5">
            {[-0.01, 0, 0.01].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPx(+(k + d).toFixed(2))}
                className="cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-gray-6) px-2 py-0.5 text-[0.76rem] tabular-nums text-(--sl-color-gray-2) hover:text-(--sl-color-white)"
              >
                {(k + d).toFixed(2)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPx(S0)}
              className="cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-gray-6) px-2 py-0.5 text-[0.76rem] tabular-nums text-(--sl-color-gray-2) hover:text-(--sl-color-white)"
            >
              unchanged {S0}
            </button>
          </div>
        </div>
      </div>

      <div
        className="mt-4 rounded-lg border-2 px-3 py-2"
        style={{ borderColor: !itm ? 'var(--sl-color-hairline-shade)' : sign > 0 ? 'var(--viz-call)' : 'var(--viz-put)' }}
      >
        <div className="text-[1rem] font-semibold text-(--sl-color-white)">{event}</div>
        <div className="text-[0.84rem] text-(--sl-color-gray-2)">{detail}</div>
      </div>

      <StatGrid
        items={[
          [
            'Shares moved',
            !itm || settle === 'cash' ? 'None' : `${shareDir > 0 ? '+' : '−'}${shares.toLocaleString()} SPY`,
            !itm || settle === 'cash' ? '' : `at the ${k} strike`,
          ],
          [
            'Cash moved',
            !itm ? '$0' : settle === 'cash' ? money0(sign * intrinsicVal * MULT * n) : money0(cashForShares),
            !itm ? '' : settle === 'cash' ? 'intrinsic value only' : shareDir > 0 ? 'you pay the strike' : 'you receive the strike',
          ],
          ['Premium at the trade', money0(-premium), `${money2(q.mark)} × 100 × ${n}`],
          ['Total P/L at the close', money0(optionPnl), 'premium + value at expiry', optionPnl >= 0 ? 'var(--viz-profit)' : 'var(--viz-loss)'],
        ]}
      />
      <div className="mt-3 text-[0.84rem] text-(--sl-color-gray-2)">
        <b className="text-(--sl-color-white)">Monday you hold:</b> {holding}
        {weekendRisk !== 0 && (
          <span className="text-(--sl-color-gray-3)">
            {' '}
            A ${gap} gap at Monday's open would move that by {money0(weekendRisk)} or {money0(-weekendRisk)}.
          </span>
        )}
      </div>
    </div>
  );
}
