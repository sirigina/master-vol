import { useMemo, useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { positionPnl, positionGreeks, type OptLeg } from '../../../lib/position';
import type { Right } from '../../../lib/pricing';
import PnlChart from './G6_PnlChart';
import { leg, net, R, S0, T1, money, num, usd, solvedIv } from './G6_helpers';

/** Strikes listed in both the Nov 27 and Dec 18 chains, for calls and for puts. */
const STRIKES = [750, 770, 790];
const XS = Array.from({ length: 161 }, (_, i) => 700 + i);

export function calendarLegs(right: Right, kFront: number, kBack: number): OptLeg[] {
  return [leg(right, kFront, -1, 1), leg(right, kBack, 1, 2)];
}

/** P/L at front expiry with the back month's IV shifted by `shift` (vol decimal). */
export function pnlAtFront(legs: OptLeg[], S: number, shift: number): number {
  const shifted = legs.map((l) => (l.T > T1 + 1e-9 ? { ...l, iv: l.iv + shift } : l));
  return positionPnl(shifted, { S, elapsed: T1, r: R });
}

export default function CalendarBuilder() {
  const t = useTokens();
  const [right, setRight] = useState<Right>('call');
  const [kind, setKind] = useState<'cal' | 'diag'>('cal');
  const [kFront, setKFront] = useState(770);
  const [kBack, setKBack] = useState(770);
  const [shift, setShift] = useState(0);

  const front = kFront;
  const back = kind === 'cal' ? kFront : kBack;
  const legs = useMemo(() => calendarLegs(right, front, back), [right, front, back]);
  const debit = net(legs);
  const g = positionGreeks(legs, { S: S0, r: R });

  const base = XS.map((s) => pnlAtFront(legs, s, 0) * 100);
  const shifted = XS.map((s) => pnlAtFront(legs, s, shift / 100) * 100);
  const today = XS.map((s) => positionPnl(legs, { S: s, r: R }) * 100);

  const best = shifted.reduce((bi, v, i) => (v > shifted[bi] ? i : bi), 0);
  const bes: number[] = [];
  for (let i = 1; i < XS.length; i++) {
    const a = shifted[i - 1];
    const b = shifted[i];
    if (a * b < 0) bes.push(XS[i - 1] + Math.abs(a) / (Math.abs(a) + Math.abs(b)));
  }
  const worst = Math.min(...shifted);

  const series = [
    { label: `At Nov 27, back IV ${shift === 0 ? 'unchanged' : `${shift > 0 ? '+' : '−'}${Math.abs(shift)} pts`}`, color: t.ink, values: shifted, wash: true },
    ...(shift !== 0 ? [{ label: 'At Nov 27, back IV unchanged', color: t.muted, values: base, dash: true }] : []),
    { label: 'Today (model)', color: t.stock, values: today, dash: true, width: 1.5 },
  ];

  const fIv = solvedIv(right, front, 1);
  const bIv = solvedIv(right, back, 2);

  return (
    <div className="viz-card not-content">
      <CardHead
        title={kind === 'cal' ? `${front} ${right} calendar: sell Nov 27, buy Dec 18` : `Diagonal: sell Nov 27 ${front} ${right}, buy Dec 18 ${back} ${right}`}
        sub="P/L when the November option expires; the December option is valued with its 21 remaining days"
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-wrap gap-2">
          <Segmented label="Spread" value={kind} onChange={(v) => setKind(v)} options={[{ value: 'cal', label: 'Calendar' }, { value: 'diag', label: 'Diagonal' }]} />
          <Segmented label="Option type" value={right} onChange={(v) => setRight(v)} options={[{ value: 'call', label: 'Calls' }, { value: 'put', label: 'Puts' }]} />
        </div>
        <Slider label="Change in Dec 18 IV by Nov 27" value={shift} min={-4} max={4} step={0.5} onChange={setShift} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} vol pts`} />
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">{kind === 'cal' ? 'Strike (both legs)' : 'Sell Nov 27 strike'}</div>
          <Segmented label="Front strike" value={String(kFront)} onChange={(v) => setKFront(+v)} options={STRIKES.map((k) => ({ value: String(k), label: String(k) }))} />
        </div>
        {kind === 'diag' && (
          <div>
            <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Buy Dec 18 strike</div>
            <Segmented label="Back strike" value={String(kBack)} onChange={(v) => setKBack(+v)} options={STRIKES.map((k) => ({ value: String(k), label: String(k) }))} />
          </div>
        )}
      </div>

      <PnlChart
        xs={XS}
        series={series}
        xLabel="SPY price on November 27"
        markers={[{ x: S0, label: `today ${S0.toFixed(0)}` }]}
        ariaLabel="Calendar spread profit and loss at the November expiry"
      />

      <StatGrid
        items={[
          ['Net debit', usd(debit * 100), `${num(legs[1].premium)} − ${num(legs[0].premium)} per share`],
          ['Best case Nov 27', money(shifted[best]), `near SPY ${XS[best]}`, t.profit],
          ['Worst on chart', money(worst), 'SPY far from the strike', t.loss],
          ['Breakevens', bes.length ? bes.map((b) => b.toFixed(0)).join(' / ') : 'None', 'at the chosen IV change'],
        ]}
      />
      <StatGrid
        items={[
          ['Delta', num(g.delta * 100, 1), 'shares'],
          ['Gamma', num(g.gamma * 100, 2), 'per $1'],
          ['Theta', money(g.theta * 100, 2), 'per day'],
          ['Vega', money(g.vega * 100, 2), 'per vol point'],
        ]}
      />
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        Per contract (×100). Legs at mid prices; IVs solved from those mids: Nov {front} {right} {(fIv * 100).toFixed(1)}%, Dec {back} {right} {(bIv * 100).toFixed(1)}%. The
        December option keeps its own IV on November 27 unless you move the slider.
      </p>
    </div>
  );
}
