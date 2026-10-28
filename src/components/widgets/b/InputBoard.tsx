import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot, callAt, putAt, fmt } from '../../../lib/snapshot';
import { bs } from '../../../lib/pricing';
import { Tile, Btn, fmtSigned } from './kit';

const IV0 = Math.round(((callAt(770)!.iv + putAt(770)!.iv) / 2) * 1000) / 10; // 14.1
const DEF = { S: snapshot.spot, K: 770, days: snapshot.chain.dte, r: snapshot.rate * 100, q: 0, vol: IV0 };

/** Six sliders, one per model input, pricing the call and put live. */
export default function InputBoard() {
  const t = useTokens();
  const [v, setV] = useState(DEF);
  const set = (k: keyof typeof DEF) => (x: number) => setV((o) => ({ ...o, [k]: x }));
  const inp = { S: v.S, K: v.K, T: v.days / 365, r: v.r / 100, q: v.q / 100, sigma: v.vol / 100 };
  const base = { S: DEF.S, K: DEF.K, T: DEF.days / 365, r: DEF.r / 100, q: 0, sigma: DEF.vol / 100 };
  const c = bs('call', inp);
  const p = bs('put', inp);
  const c0 = bs('call', base).price;
  const p0 = bs('put', base).price;

  const tag = (s: string, observed: boolean) => (
    <span
      className="ml-1.5 rounded px-1.5 py-px text-[0.66rem] font-semibold uppercase tracking-wide"
      style={{ background: observed ? t['band-2'] : t['loss-wash'], color: observed ? t.call : t.put }}
    >
      {s}
    </span>
  );

  return (
    <div className="viz-card not-content">
      <CardHead
        title="The input board"
        sub="Every input to the pricing model, starting at the snapshot values for the November 27 770 options"
        right={<Btn onClick={() => setV(DEF)}>Reset to snapshot</Btn>}
      />
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[0.72rem] text-(--sl-color-gray-3)">Underlying price S{tag('observed', true)}</div>
          <Slider label="SPY" value={v.S} min={700} max={840} step={0.5} onChange={set('S')} format={(x) => fmt.usd(x)} />
        </div>
        <div>
          <div className="mb-1 text-[0.72rem] text-(--sl-color-gray-3)">Strike K{tag('contract term', true)}</div>
          <Slider label="Strike" value={v.K} min={700} max={840} step={5} onChange={set('K')} format={(x) => `${x}`} />
        </div>
        <div>
          <div className="mb-1 text-[0.72rem] text-(--sl-color-gray-3)">Time to expiry T{tag('contract term', true)}</div>
          <Slider label="Days left" value={v.days} min={1} max={365} step={1} onChange={set('days')} format={(x) => `${x} days`} />
        </div>
        <div>
          <div className="mb-1 text-[0.72rem] text-(--sl-color-gray-3)">Interest rate r{tag('observed', true)}</div>
          <Slider label="Rate" value={v.r} min={0} max={8} step={0.1} onChange={set('r')} format={(x) => `${x.toFixed(1)}%`} />
        </div>
        <div>
          <div className="mb-1 text-[0.72rem] text-(--sl-color-gray-3)">Dividend yield q{tag('forecast, usually reliable', true)}</div>
          <Slider label="Dividend yield" value={v.q} min={0} max={4} step={0.1} onChange={set('q')} format={(x) => `${x.toFixed(1)}%`} />
        </div>
        <div>
          <div className="mb-1 text-[0.72rem] text-(--sl-color-gray-3)">Volatility σ{tag('must be estimated', false)}</div>
          <Slider label="Volatility" value={v.vol} min={5} max={50} step={0.1} onChange={set('vol')} format={(x) => `${x.toFixed(1)}%`} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={`${v.K} call`} value={fmt.usd(c.price)} sub={`${fmtSigned(c.price - c0)} vs start`} accent={t.call} />
        <Tile label={`${v.K} put`} value={fmt.usd(p.price)} sub={`${fmtSigned(p.price - p0)} vs start`} accent={t.put} />
        <Tile label="Call − put" value={fmtSigned(c.price - p.price)} sub="lesson B3" />
        <Tile label="Call delta / vega" value={`${c.delta.toFixed(2)} / ${c.vega.toFixed(2)}`} sub="per $1 / per vol point" />
      </div>
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        Starts at SPY {fmt.usd(DEF.S)}, {DEF.days} days, {DEF.r.toFixed(1)}% rate, no dividend and {DEF.vol.toFixed(1)}% volatility (the average of the
        770 call and put IVs). The market prices were {fmt.usd(callAt(770)!.mark)} and {fmt.usd(putAt(770)!.mark)}.
      </p>
    </div>
  );
}
