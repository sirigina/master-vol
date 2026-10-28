import { useMemo, useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { BOOKS, S0, bookCost, bookGreeks, bookPnlFromMarks, usd0, sgn0 } from './hlib';

const VIX0 = snapshot.index.VIX;

/** Expiry max loss (scan), dollars per unit. */
function expiryWorst(key: string) {
  const legs = BOOKS[key].legs;
  let m = Infinity;
  for (let s = 400; s <= 1200; s += 1) m = Math.min(m, bookPnlFromMarks(legs, { S: s, days: 31 }));
  return m;
}

/** H4: size a short strangle and an iron condor from a stress scenario, not from margin. */
export default function SizingCalc() {
  const t = useTokens();
  const [acct, setAcct] = useState(250);
  const [pct, setPct] = useState(10);
  const [move, setMove] = useState(-10);
  const [vix, setVix] = useState(35);

  const budget = acct * 1000 * (pct / 100);
  const rows = useMemo(
    () =>
      (['shortStrangle', 'ironCondor'] as const).map((k) => {
        const legs = BOOKS[k].legs;
        const loss = -bookPnlFromMarks(legs, { S: S0 * (1 + move / 100), volMult: vix / VIX0 });
        const credit = -bookCost(legs);
        const g = bookGreeks(legs);
        const n = loss > 0 ? Math.floor(budget / loss) : Infinity;
        const capped = k === 'ironCondor' ? -expiryWorst(k) : Infinity;
        const nCap = Number.isFinite(capped) ? Math.floor(budget / capped) : 0;
        return { k, loss, credit, g, n, capped, nCap };
      }),
    [acct, pct, move, vix],
  );

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Size from the stress loss, not the margin"
        sub="Nov 27 SPY: short 750/790 strangle vs the same strangle with 720/820 wings. IVs scaled by VIX ÷ 17.52, then repriced instantly."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="Account size" value={acct} min={25} max={2000} step={25} onChange={setAcct} format={(v) => `$${v.toLocaleString()}k`} />
        <Slider label="Loss you can accept in the stress" value={pct} min={1} max={30} step={1} onChange={setPct} format={(v) => `${v}% (${usd0(acct * 10 * v)})`} />
        <Slider label="Stress: SPY move" value={move} min={-25} max={0} step={1} onChange={setMove} format={(v) => `${v < 0 ? '−' : ''}${Math.abs(v)}% → ${(S0 * (1 + v / 100)).toFixed(0)}`} />
        <Slider label="Stress: VIX goes to" value={vix} min={15} max={80} step={1} onChange={setVix} format={(v) => `${v} (IVs × ${(v / VIX0).toFixed(2)})`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.k} className="rounded-lg border border-(--sl-color-hairline) px-3 py-3" style={{ borderColor: r.k === 'shortStrangle' ? t.put : t.call }}>
            <div className="text-[0.85rem] font-semibold text-(--sl-color-white)">{BOOKS[r.k].label}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[2rem] font-bold leading-none tabular-nums text-(--sl-color-white)">{Number.isFinite(r.n) ? r.n.toLocaleString() : '∞'}</span>
              <span className="text-[0.8rem] text-(--sl-color-gray-3)">max units</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8rem] tabular-nums">
              <dt className="text-(--sl-color-gray-3)">Stress loss / unit</dt>
              <dd className="m-0 text-right font-semibold">{r.loss > 0 ? usd0(-r.loss) : `gain ${usd0(-r.loss)}`}</dd>
              <dt className="text-(--sl-color-gray-3)">Credit / unit</dt>
              <dd className="m-0 text-right">{usd0(r.credit)}</dd>
              <dt className="text-(--sl-color-gray-3)">Loss ÷ credit</dt>
              <dd className="m-0 text-right">{(r.loss / r.credit).toFixed(1)}×</dd>
              <dt className="text-(--sl-color-gray-3)">Worst case at expiry</dt>
              <dd className="m-0 text-right">{Number.isFinite(r.capped) ? usd0(-r.capped) : 'unlimited'}</dd>
              <dt className="text-(--sl-color-gray-3)">Units if sized on worst case</dt>
              <dd className="m-0 text-right">{Number.isFinite(r.capped) ? r.nCap.toLocaleString() : 'n/a (no cap)'}</dd>
              {Number.isFinite(r.n) && r.n > 0 && (
                <>
                  <dt className="text-(--sl-color-gray-3)">At max size: credit</dt>
                  <dd className="m-0 text-right">{usd0(r.n * r.credit)}</dd>
                  <dt className="text-(--sl-color-gray-3)">At max size: theta</dt>
                  <dd className="m-0 text-right">{sgn0(r.n * r.g.theta)}/day</dd>
                  <dt className="text-(--sl-color-gray-3)">At max size: vega</dt>
                  <dd className="m-0 text-right">{sgn0(r.n * r.g.vega)}/pt</dd>
                </>
              )}
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[0.75rem] text-(--sl-color-gray-3)">
        Instant shock, no time passes; each strike&apos;s IV is multiplied by the same factor, so the smile keeps its shape. A real crash usually steepens
        the put skew, making the strangle&apos;s loss worse than shown. Model repricing; not a margin calculation.
      </p>
    </div>
  );
}
