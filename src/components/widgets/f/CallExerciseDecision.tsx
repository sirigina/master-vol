import { useMemo, useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { bs } from '../../../lib/pricing';
import { divTree, R, S0, money } from './fdata';

/**
 * On the eve of an ex-dividend date: exercise the call (collect S − K, then the dividend)
 * or keep it (worth the ex-dividend call value)?
 */
export default function CallExerciseDecision() {
  const [D, setD] = useState(2.1);
  const [K, setK] = useState(740);
  const [toEx, setToEx] = useState(51);
  const [life, setLife] = useState(52);
  const [iv, setIv] = useState(15);
  const [rate, setRate] = useState(R * 100);
  const [S, setS] = useState(Math.round(S0));
  const exDays = Math.min(toEx, life);
  const rem = Math.max(life - exDays, 0) / 365;
  const r = rate / 100;
  const sigma = iv / 100;

  const exercise = Math.max(S - K, 0);
  const hold = bs('call', { S: S - D, K, T: rem, r, sigma }).price;
  const put = bs('put', { S: S - D, K, T: rem, r, sigma }).price;
  const interest = K * (1 - Math.exp(-r * rem));
  const timeValue = hold - Math.max(S - D - K, 0);
  const doEx = exercise > hold + 1e-9;

  const today = useMemo(() => {
    const p = { S: S0, K, T: life / 365, r, sigma, D, tD: exDays / 365, steps: 300 };
    return { amer: divTree('call', p), euro: divTree('call', { ...p, american: false }) };
  }, [D, K, exDays, life, r, sigma]);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Exercise before the dividend, or hold?"
        sub="The evening before the ex-date. Model prices; defaults: a Dec 18 SPY call, dividend assumed $2.10 going ex on expiration day."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Dividend" value={D} min={0} max={6} step={0.05} onChange={setD} format={(v) => `$${v.toFixed(2)}`} />
        <Slider label="Strike" value={K} min={680} max={800} step={5} onChange={setK} format={(v) => `${v}`} />
        <Slider label="SPY on the eve of the ex-date" value={S} min={700} max={840} step={1} onChange={setS} format={(v) => `$${v}`} />
        <Slider label="Implied volatility" value={iv} min={8} max={40} step={1} onChange={setIv} format={(v) => `${v}%`} />
        <Slider label="Days until ex-date" value={toEx} min={1} max={120} step={1} onChange={setToEx} format={(v) => `${v}`} />
        <Slider label="Days until expiry" value={life} min={1} max={180} step={1} onChange={setLife} format={(v) => `${v}`} />
        <Slider label="Interest rate" value={rate} min={0} max={8} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <div
        className="mt-4 rounded-lg border-2 px-4 py-3"
        style={{ borderColor: doEx ? 'var(--viz-put)' : 'var(--viz-call)' }}
      >
        <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">
          Decision {toEx > life ? '(ex-date falls after expiry: no dividend to capture)' : `with ${(rem * 365).toFixed(0)} day${Math.round(rem * 365) === 1 ? '' : 's'} left after the ex-date`}
        </div>
        <div className="text-[1.15rem] font-semibold">{doEx ? 'Exercise tonight' : 'Hold the call'}</div>
        <div className="text-[0.85rem] text-(--sl-color-gray-2)">
          Exercise and own the stock: worth {money(exercise)} (S − K). Hold: the call opens tomorrow on a stock {money(D)} lower, worth {money(hold)}.
        </div>
      </div>
      <StatGrid
        items={[
          ['Exercise value', money(exercise), 'S − K, you then collect the dividend', doEx ? 'var(--viz-put)' : undefined],
          ['Hold value', money(hold), 'call after the stock drops by D', doEx ? undefined : 'var(--viz-call)'],
          ['Time value you give up', money(Math.max(timeValue, 0)), S - D > K ? `= put ${money(put)} + interest ${money(interest)}` : 'the call is out of the money ex-dividend'],
          ['Rule of thumb', `D ${D > put + interest ? '>' : '≤'} put + interest`, `${money(D)} vs ${money(put + interest)}`],
        ]}
      />
      <StatGrid
        cols={3}
        items={[
          ['Value today, American', money(today.amer), 'binomial, exercise allowed'],
          ['Value today, European', money(today.euro), 'no early exercise'],
          ['Early-exercise premium', money(today.amer - today.euro), 'what the right is worth now'],
        ]}
      />
    </div>
  );
}
