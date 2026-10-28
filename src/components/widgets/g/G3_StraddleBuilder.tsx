import { useMemo, useState } from 'react';
import GChart from './G1_Chart';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { leg, pnlAt, greeksAt, contractGreeks, expiryStats, money, costLabel, CALL_STRIKES, PUT_STRIKES, S0, DTE, atmIv, selCls } from './G1_kit';
import { expectedMove } from '../../../lib/pricing';

const PUTS = PUT_STRIKES.filter((k) => k >= 720 && k <= 790);
const CALLS = CALL_STRIKES.filter((k) => k >= 750 && k <= 820);
const SD1 = expectedMove(S0, atmIv, 22);

/** G3: straddle / strangle builder with time and IV controls. */
export default function G3StraddleBuilder() {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [pk, setPk] = useState(770);
  const [ck, setCk] = useState(770);
  const [days, setDays] = useState(14);
  const [iv, setIv] = useState(0);
  const sg = side === 'long' ? 1 : -1;

  const legs = useMemo(() => [leg('put', pk, sg), leg('call', ck, sg)], [pk, ck, sg]);
  const st = useMemo(() => expiryStats(legs), [legs]);
  const g = contractGreeks(greeksAt(legs, S0, days, iv / 100));
  const valNow = pnlAt(legs, S0, days, iv / 100);
  const name = pk === ck ? `${pk} straddle` : `${pk}/${ck} strangle`;

  function setPreset(p: string) {
    const [a, b] = p.split('/').map(Number);
    setPk(a);
    setCk(b);
  }
  const preset = `${pk}/${ck}`;

  return (
    <div className="viz-card not-content">
      <CardHead title={`${side === 'long' ? 'Long' : 'Short'} ${name}`} sub="Nov 27 puts and calls at their real marks. Move time and IV to see the curve before expiry." />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Segmented label="Long or short" value={side} onChange={setSide} options={[{ value: 'long', label: 'Buy' }, { value: 'short', label: 'Sell' }]} />
          <Segmented
            label="Preset"
            value={['770/770', '760/780', '750/790', '740/800'].includes(preset) ? preset : ''}
            onChange={setPreset}
            options={[
              { value: '770/770', label: '770 straddle' },
              { value: '760/780', label: '760/780' },
              { value: '750/790', label: '750/790' },
              { value: '740/800', label: '740/800' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-(--sl-color-gray-3) sm:col-span-2">
          <label className="inline-flex items-center gap-1.5">
            Put strike
            <select className={selCls} value={pk} onChange={(e) => setPk(Math.min(+e.target.value, ck))} aria-label="Put strike">
              {PUTS.map((k) => (
                <option key={k} value={k} disabled={k > ck}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            Call strike
            <select className={selCls} value={ck} onChange={(e) => setCk(Math.max(+e.target.value, pk))} aria-label="Call strike">
              {CALLS.map((k) => (
                <option key={k} value={k} disabled={k < pk}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Slider label="Today + N days" value={days} min={0} max={DTE - 1} step={1} onChange={setDays} format={(v) => `${v} days (${DTE - v} left)`} />
        <Slider label="IV shift (all strikes)" value={iv} min={-5} max={5} step={0.5} onChange={setIv} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} vol pts`} />
      </div>

      <GChart
        series={[
          { key: 'exp', label: 'At expiry', color: (t) => t.ink, f: (x) => pnlAt(legs, x) },
          { key: 'now', label: 'Today (snapshot IVs)', color: (t) => t.muted, dash: '2 3', width: 1.5, f: (x) => pnlAt(legs, x, 0) },
          { key: 'n', label: `In ${days} days, IV ${iv >= 0 ? '+' : '−'}${Math.abs(iv)}`, color: (t) => t.stock, dash: '6 4', f: (x) => pnlAt(legs, x, days, iv / 100) },
        ]}
        washKey="exp"
        lo={710}
        hi={830}
        spot={S0}
        band={{ x0: S0 - SD1, x1: S0 + SD1, label: `±1 SD by expiry (±$${SD1.toFixed(0)})` }}
        dots={st.be}
        yDomain={side === 'long' ? [-3200, 4500] : [-4500, 3200]}
        ariaLabel={`Profit and loss of a ${side} ${name}`}
      />
      <StatGrid
        items={[
          [side === 'long' ? 'Cost' : 'Credit', costLabel(st.cost)],
          ['Breakevens', st.be.map((b) => b.toFixed(2)).join(' / '), `±${(Math.abs(st.cost)).toFixed(2)} beyond the strikes`],
          ['Max loss', money(st.maxLoss), side === 'long' ? (pk === ck ? 'if SPY ends at the strike' : 'if SPY ends between the strikes') : 'unlimited above, large below'],
          [`P/L after ${days} days`, money(valNow, 100, true), `SPY unchanged, IV ${iv >= 0 ? '+' : '−'}${Math.abs(iv)} pts`],
          ['Theta', `${money(g.theta / 100, 100, true)} / day`],
          ['Vega', `${money(g.vega / 100, 100, true)} / vol pt`],
          ['Gamma', `${g.gamma >= 0 ? '+' : '−'}${Math.abs(g.gamma).toFixed(2)} sh per $1`],
          ['Delta', `${g.delta >= 0 ? '+' : '−'}${Math.abs(g.delta).toFixed(1)} sh`],
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Greeks per spread at SPY {S0}, after the chosen days and IV shift. The shaded band is the ±1 standard deviation range at the {(atmIv * 100).toFixed(1)}% ATM IV over 22 trading days.
      </p>
    </div>
  );
}
