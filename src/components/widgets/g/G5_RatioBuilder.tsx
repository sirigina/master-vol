import { useMemo, useState } from 'react';
import GChart from './G1_Chart';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { leg, pnlAt, greeksAt, contractGreeks, expiryStats, money, costLabel, CALL_STRIKES, PUT_STRIKES, S0, DTE, selCls } from './G1_kit';

type Ratio = '1x2' | '1x3' | '2x1' | '3x2';
const RATIOS: Record<Ratio, { near: number; far: number; label: string }> = {
  '1x2': { near: 1, far: -2, label: 'Ratio 1×2' },
  '1x3': { near: 1, far: -3, label: 'Ratio 1×3' },
  '2x1': { near: -1, far: 2, label: 'Backspread 2×1' },
  '3x2': { near: -2, far: 3, label: 'Backspread 3×2' },
};

/** G5: ratio spreads and backspreads on real strikes. near = closer to the money, far = further OTM. */
export default function G5RatioBuilder() {
  const [right, setRight] = useState<'call' | 'put'>('put');
  const [ratio, setRatio] = useState<Ratio>('1x2');
  const [near, setNear] = useState(770);
  const [far, setFar] = useState(750);
  const [days, setDays] = useState(0);

  const strikes = right === 'call' ? CALL_STRIKES.filter((k) => k >= 760 && k <= 840) : PUT_STRIKES.filter((k) => k >= 680 && k <= 780);
  const nearOpts = right === 'call' ? strikes.filter((k) => k <= 800) : strikes.filter((k) => k >= 720);
  const nK = nearOpts.includes(near) ? near : right === 'call' ? 770 : 770;
  const farOpts = strikes.filter((k) => (right === 'call' ? k > nK : k < nK));
  const fK = farOpts.includes(far) ? far : right === 'call' ? farOpts[Math.min(1, farOpts.length - 1)] : farOpts[Math.max(farOpts.length - 2, 0)];

  const r = RATIOS[ratio];
  const legs = useMemo(() => [leg(right, nK, r.near), leg(right, fK, r.far)], [right, nK, fK, ratio]);
  const st = useMemo(() => expiryStats(legs), [legs]);
  const g = contractGreeks(greeksAt(legs, S0, days));
  const isRatio = r.near > 0;
  const nearN = Math.abs(r.near);
  const farN = Math.abs(r.far);
  const name = `${isRatio ? `Buy ${nearN} ${nK}, sell ${farN} ${fK}` : `Sell ${nearN} ${nK}, buy ${farN} ${fK}`} ${right}s`;

  function switchRight(v: 'call' | 'put') {
    setRight(v);
    setNear(770);
    setFar(v === 'call' ? 790 : 750);
  }

  const lo = right === 'put' ? 660 : 730;
  const hi = right === 'put' ? 800 : 870;
  // wider y range for the naked side
  const yd: [number, number] = isRatio ? [-4500, 3500] : [-3500, 4500];

  return (
    <div className="viz-card not-content">
      <CardHead title={name} sub="Real Nov 27 marks. A ratio sells more options than it buys; a backspread buys more than it sells." />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Calls or puts" value={right} onChange={switchRight} options={[{ value: 'put', label: 'Puts' }, { value: 'call', label: 'Calls' }]} />
        <Segmented label="Ratio" value={ratio} onChange={setRatio} options={(Object.keys(RATIOS) as Ratio[]).map((k) => ({ value: k, label: RATIOS[k].label }))} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[auto_minmax(15rem,1fr)] sm:items-end">
        <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-(--sl-color-gray-3)">
          <label className="inline-flex items-center gap-1.5">
            Near strike ({isRatio ? `buy ${nearN}` : `sell ${nearN}`})
            <select className={selCls} value={nK} onChange={(e) => setNear(+e.target.value)} aria-label="Near strike">
              {nearOpts.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            Far strike ({isRatio ? `sell ${farN}` : `buy ${farN}`})
            <select className={selCls} value={fK} onChange={(e) => setFar(+e.target.value)} aria-label="Far strike">
              {farOpts.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Slider className="sm:max-w-72 sm:justify-self-end sm:w-full" label="Today + N days" value={days} min={0} max={DTE - 1} step={1} onChange={setDays} format={(v) => `${v} days (${DTE - v} left)`} />
      </div>

      <GChart
        series={[
          { key: 'exp', label: 'At expiry', color: (t) => t.ink, f: (x) => pnlAt(legs, x) },
          { key: 'now', label: days === 0 ? 'Today (model)' : `In ${days} days (model)`, color: (t) => t.stock, dash: '5 4', f: (x) => pnlAt(legs, x, days) },
        ]}
        washKey="exp"
        lo={lo}
        hi={hi}
        spot={S0}
        dots={st.be.filter((b) => b > lo && b < hi)}
        yDomain={yd}
        markers={[
          { x: nK, label: `${nK}`, color: (t) => (right === 'call' ? t.call : t.put) },
          { x: fK, label: `${fK}`, color: (t) => (right === 'call' ? t.call : t.put) },
        ]}
        ariaLabel={`Payoff of ${name}`}
      />
      <StatGrid
        items={[
          ['Net premium', costLabel(st.cost)],
          ['Max gain', money(st.maxGain), isRatio ? `at ${fK} at expiry` : right === 'call' ? 'keeps growing' : 'if SPY goes to zero'],
          ['Max loss', money(st.maxLoss), isRatio ? (right === 'call' ? `${farN - nearN} naked call${farN - nearN > 1 ? 's' : ''} above ${fK}` : 'if SPY goes to zero') : `at ${fK} at expiry`],
          ['Breakevens', st.be.length ? st.be.map((b) => b.toFixed(2)).join(' / ') : 'none'],
          ['Delta', `${g.delta >= 0 ? '+' : '−'}${Math.abs(g.delta).toFixed(1)} sh`],
          ['Gamma', `${g.gamma >= 0 ? '+' : '−'}${Math.abs(g.gamma).toFixed(2)} sh per $1`],
          ['Theta', `${money(g.theta / 100, 100, true)} / day`],
          ['Vega', `${money(g.vega / 100, 100, true)} / vol pt`],
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Per 1-lot of the ratio (e.g. 1×2 = one long, two short), 100 shares per contract. Greeks at SPY {S0} after the chosen days, each strike at its own IV.
      </p>
    </div>
  );
}
