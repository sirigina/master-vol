import { useMemo, useState } from 'react';
import GChart from './G1_Chart';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import { normCdf } from '../../../lib/pricing';
import type { OptLeg } from '../../../lib/position';
import { leg, has, pnlAt, greeksAt, contractGreeks, expiryStats, money, costLabel, S0, R, T_EXPIRY, atmIv } from './G1_kit';

type Kind = 'call' | 'put' | 'iron';
const CENTERS = [760, 765, 770, 775, 780];
const WINGS = [5, 10, 20, 30];
const BODIES = [10, 20];

/** Strikes [lowWing, lowBody, highBody, highWing] for a fly (body 0) or condor. */
function strikes(center: number, body: number, wing: number) {
  const lb = center - body / 2;
  const hb = center + body / 2;
  return [lb - wing, lb, hb, hb + wing];
}
function build(kind: Kind, k: number[]): OptLeg[] | null {
  const [a, b, c, d] = k;
  const need: ['call' | 'put', number][] =
    kind === 'iron' ? [['put', a], ['put', b], ['call', c], ['call', d]] : [[kind, a], [kind, b], [kind, c], [kind, d]];
  if (!need.every(([r, K]) => has(r, K))) return null;
  if (kind === 'iron') return [leg('put', a, 1), leg('put', b, -1), leg('call', c, -1), leg('call', d, 1)];
  if (b === c) return [leg(kind, a, 1), leg(kind, b, -2), leg(kind, d, 1)];
  return [leg(kind, a, 1), leg(kind, b, -1), leg(kind, c, -1), leg(kind, d, 1)];
}
function pBetween(lo: number, hi: number) {
  const d2 = (K: number) => (Math.log(S0 / K) + (R - 0.5 * atmIv * atmIv) * T_EXPIRY) / (atmIv * Math.sqrt(T_EXPIRY));
  return normCdf(d2(lo)) - normCdf(d2(hi));
}

/** G4: butterfly / condor builder from real strikes. */
export default function G4FlyBuilder() {
  const [kind, setKind] = useState<Kind>('call');
  const [shape, setShape] = useState<'fly' | 'condor'>('fly');
  const [center, setCenter] = useState(770);
  const [wing, setWing] = useState(10);
  const [body, setBody] = useState(10);
  const b = shape === 'fly' ? 0 : body;

  const ok = (c: number, w: number, bd: number) => build(kind, strikes(c, bd, w)) !== null;
  const wings = WINGS.filter((w) => ok(center, w, b));
  const w = wings.includes(wing) ? wing : wings[0] ?? 10;
  const centers = CENTERS.filter((c) => WINGS.some((x) => ok(c, x, b)));
  const k = strikes(center, b, w);
  const legs = useMemo(() => build(kind, k), [kind, center, w, b]);

  const st = legs ? expiryStats(legs) : null;
  const g = legs ? contractGreeks(greeksAt(legs)) : null;
  const iron = kind === 'iron';
  const pop = st && st.be.length === 2 ? pBetween(st.be[0], st.be[1]) : 0;
  const name = `${k[0]}/${b ? `${k[1]}/${k[2]}` : k[1]}/${k[3]} ${iron ? 'iron ' : `${kind} `}${shape === 'fly' ? 'butterfly' : 'condor'}`;

  return (
    <div className="viz-card not-content">
      <CardHead title={`Long ${name}`} sub="Built from real Nov 27 marks. Only strikes that are listed in the chain can be chosen." />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Type" value={kind} onChange={setKind} options={[{ value: 'call', label: 'Calls' }, { value: 'put', label: 'Puts' }, { value: 'iron', label: 'Iron' }]} />
        <Segmented label="Shape" value={shape} onChange={setShape} options={[{ value: 'fly', label: 'Butterfly' }, { value: 'condor', label: 'Condor' }]} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[auto_auto_auto] sm:justify-start sm:gap-5">
        <div>
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Center</div>
          <Segmented label="Center" value={String(center)} onChange={(v) => setCenter(+v)} options={centers.map((c) => ({ value: String(c), label: String(c) }))} />
        </div>
        <div>
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Wing width</div>
          <Segmented label="Wing width" value={String(w)} onChange={(v) => setWing(+v)} options={wings.map((x) => ({ value: String(x), label: `$${x}` }))} />
        </div>
        {shape === 'condor' && (
          <div>
            <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Body width</div>
            <Segmented label="Body width" value={String(body)} onChange={(v) => setBody(+v)} options={BODIES.map((x) => ({ value: String(x), label: `$${x}` }))} />
          </div>
        )}
      </div>

      {legs && st && g ? (
        <>
          <GChart
            series={[
              { key: 'exp', label: 'At expiry', color: (t) => t.ink, f: (x) => pnlAt(legs, x) },
              { key: 'now', label: 'Today (model)', color: (t) => t.stock, dash: '5 4', f: (x) => pnlAt(legs, x, 0) },
            ]}
            washKey="exp"
            lo={725}
            hi={815}
            spot={S0}
            dots={st.be}
            height={300}
            ariaLabel={`Payoff of the ${name}`}
          />
          <StatGrid
            items={[
              [iron ? 'Credit' : 'Cost', costLabel(st.cost), iron ? `wing $${w} − credit = max loss` : `of $${(w * 100).toLocaleString("en-US")} max value`],
              ['Max gain', money(st.maxGain), `${(st.maxGain / -st.maxLoss).toFixed(1)} : 1 reward to risk`],
              ['Max loss', money(st.maxLoss)],
              ['Breakevens', st.be.map((x) => x.toFixed(2)).join(' / ')],
              ['Ends between BEs', `${(pop * 100).toFixed(0)}%`, 'model odds, ATM IV'],
              ['Theta', `${money(g.theta / 100, 100, true)} / day`],
              ['Vega', `${money(g.vega / 100, 100, true)} / vol pt`],
              ['Gamma', `${g.gamma >= 0 ? '+' : '−'}${Math.abs(g.gamma).toFixed(2)} sh per $1`],
            ]}
          />
        </>
      ) : (
        <p className="mt-4 text-[0.85rem] text-(--sl-color-gray-3)">Those strikes are not all listed for Nov 27. Pick another center or width.</p>
      )}
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Per spread (100 shares). "Ends between BEs" is the lognormal probability at the {(atmIv * 100).toFixed(1)}% ATM IV that SPY finishes inside the breakevens; it ignores skew.
      </p>
    </div>
  );
}
