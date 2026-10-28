import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import PnlChart from './G6_PnlChart';
import { adjust, pnlAt, greeksAt, CREDIT, STRANGLE, shifted, type Adj } from './G9_adjust';
import { money, num, S0, usd } from './G6_helpers';

const XS = Array.from({ length: 141 }, (_, i) => 700 + i);
const ADJ: { value: Adj; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'roll', label: 'Roll tested side' },
  { value: 'out', label: 'Roll out to Dec' },
  { value: 'wings', label: 'Buy wings (iron condor)' },
  { value: 'hedge', label: 'Delta hedge' },
];
const T_END = 31 / 365;

export default function AdjustSim() {
  const t = useTokens();
  const [S, setS] = useState(792);
  const [day, setDay] = useState(12);
  const [iv, setIv] = useState(0);
  const [adj, setAdj] = useState<Adj>('roll');
  const el = day / 365;
  const shift = iv / 100;
  const base = shifted(STRANGLE, shift);
  const a = adjust(adj, S, day, shift);
  const g0 = greeksAt(base, S, el);
  const g1 = greeksAt(a.legs, S, el);
  const pnlNow = pnlAt(base, S, el);

  const before = XS.map((s) => pnlAt(base, s, T_END) * 100);
  const afterEnd = XS.map((s) => pnlAt(a.legs, s, T_END) * 100);
  const afterNow = XS.map((s) => pnlAt(a.legs, s, el) * 100);
  /** worst Nov 27 P/L for SPY between 720 and 820 */
  const worst = (v: number[]) => Math.min(...v.filter((_, i) => XS[i] >= 720 && XS[i] <= 820));
  const changed = a.legs.length > 2;

  const series = [
    { label: changed ? 'Adjusted, on Nov 27' : 'Strangle, on Nov 27', color: t.ink, values: afterEnd, wash: true },
    ...(changed ? [{ label: 'Original strangle, on Nov 27', color: t.muted, values: before, dash: true }] : []),
    { label: `${changed ? 'Adjusted' : 'Strangle'}, day ${day} (model)`, color: t.stock, values: afterNow, dash: true, width: 1.5 },
  ];
  const g = (x: number, d = 2) => num(x * 100, d);

  return (
    <div className="viz-card not-content">
      <CardHead title="Short 750/790 strangle: move the market, then adjust" sub={`Sold for ${num(CREDIT)} (${usd(CREDIT * 100)} per contract) on October 27, Nov 27 expiry. Legs added later are priced on the snapshot smile plus your IV change.`} />
      <div className="mb-3 grid gap-4 sm:grid-cols-3">
        <Slider label="SPY price" value={S} min={720} max={820} step={1} onChange={setS} format={(v) => v.toFixed(0)} />
        <Slider label="Days since entry" value={day} min={0} max={30} step={1} onChange={setDay} format={(v) => `${v} (${31 - v} left)`} />
        <Slider label="IV change" value={iv} min={-4} max={10} step={1} onChange={setIv} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} pts`} />
      </div>
      <div className="mb-3">
        <Segmented label="Adjustment" value={adj} onChange={setAdj} options={ADJ} />
      </div>
      <PnlChart
        xs={XS}
        series={series}
        markers={[{ x: S, label: `SPY ${S}` }]}
        dots={[{ x: S, y: pnlNow * 100, color: t.stock }]}
        xLabel="SPY price"
        ariaLabel="Short strangle profit and loss before and after an adjustment"
        height={290}
      />
      <div className="mt-3 rounded-lg border border-(--sl-color-hairline) px-3 py-2 text-[0.82rem]">
        <span className="text-(--sl-color-gray-3)">Trades: </span>
        {a.trades.join(' · ')}
        {a.cash !== 0 && (
          <span className="text-(--sl-color-gray-3)">
            {' '}
            · net {a.cash > 0 ? 'pay' : 'collect'} {usd(Math.abs(a.cash) * 100)}
          </span>
        )}
        {a.slippage > 0 && <span className="text-(--sl-color-gray-3)"> · est. bid/ask cost {money(-a.slippage * 100)}</span>}
      </div>
      <StatGrid
        items={[
          ['P/L now', money(pnlNow * 100), `day ${day}, SPY ${S}`, pnlNow >= 0 ? t.profit : t.loss],
          ['Worst Nov 27, SPY 720–820', money(worst(afterEnd)), `was ${money(worst(before))}`],
          ['Delta (shares)', g(g1.delta, 0), `was ${g(g0.delta, 0)}`],
          ['Gamma (per $1)', g(g1.gamma), `was ${g(g0.gamma)}`],
        ]}
      />
      <StatGrid
        cols={2}
        items={[
          ['Theta per day', money(g1.theta * 100, 2), `was ${money(g0.theta * 100, 2)}`],
          ['Vega per vol point', money(g1.vega * 100, 2), `was ${money(g0.vega * 100, 2)}`],
        ]}
      />
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        Per contract. Adjustments trade at model value, so P/L now is unchanged by them apart from the bid/ask cost; what changes is the shape of the future. "Roll out to Dec"
        replaces both legs with the same strikes on Dec 18, so its Nov 27 curve still contains December time value. The delta hedge is a one-time hedge, not rebalanced.
      </p>
    </div>
  );
}
