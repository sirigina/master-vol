import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';

const SPY = snapshot.spot;
const SPX = snapshot.index.SPX;

const PRODUCTS = [
  { key: 'spy', name: 'SPY options', mult: 100, level: SPY, unit: '100 ETF shares' },
  { key: 'spx', name: 'SPX options', mult: 100, level: SPX, unit: '$100 × index' },
  { key: 'es', name: 'E-mini (ES)', mult: 50, level: SPX, unit: '$50 × index' },
  { key: 'mes', name: 'Micro E-mini (MES)', mult: 5, level: SPX, unit: '$5 × index' },
] as const;

const ROWS: [string, string, string, string][] = [
  ['Underlying', 'SPDR S&P 500 ETF shares', 'S&P 500 index (not tradable)', 'S&P 500 futures contract'],
  ['Exercise style', 'American (any day)', 'European (expiry only)', 'Quarterlies American; most weeklies European'],
  ['Settlement', 'Physical: 100 SPY shares', 'Cash: intrinsic × $100', 'Into the futures position'],
  ['Settlement price', 'SPY close (PM)', 'AM: opening print (SOQ); PM: close for weeklies/SPXW', 'Into futures; quarterly futures cash-settle on the AM SOQ'],
  ['Dividends', 'ETF pays them; option holders do not get them', 'Index is price-only; no dividend paid', 'Priced into the futures level'],
  ['Early assignment risk', 'Yes, esp. calls before ex-dividend and deep ITM puts', 'None', 'Yes on American options'],
];

/** J1: side-by-side comparison and a notional / contract-count calculator. */
export default function IndexProducts() {
  const [exposure, setExposure] = useState(1_000_000);

  return (
    <div className="viz-card not-content">
      <CardHead title="SPY vs SPX vs E-mini: the same market, three wrappers" sub={`Levels at the snapshot: SPY ${SPY.toFixed(2)}, SPX ${SPX.toFixed(1)} (ratio ${(SPX / SPY).toFixed(2)})`} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] table-fixed text-[0.8rem]">
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              <th className="w-[22%] py-1 pr-2 font-medium" />
              <th className="py-1 pr-2 font-medium">SPY options</th>
              <th className="py-1 pr-2 font-medium">SPX options</th>
              <th className="py-1 pr-2 font-medium">Options on E-mini futures</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([k, ...v]) => (
              <tr key={k} className="border-t border-(--sl-color-hairline) align-top">
                <td className="py-1.5 pr-2 font-medium text-(--sl-color-gray-2)">{k}</td>
                {v.map((c, i) => (
                  <td key={i} className="py-1.5 pr-2">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 border-t border-(--sl-color-hairline) pt-4">
        <div className="mb-2 text-[0.9rem] font-semibold">How many contracts for a given exposure?</div>
        <Slider
          label="Dollar exposure to the S&P 500"
          value={exposure}
          min={50_000}
          max={10_000_000}
          step={50_000}
          onChange={setExposure}
          format={(v) => `$${v.toLocaleString('en-US')}`}
        />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRODUCTS.map((p) => {
            const notional = p.mult * p.level;
            const n = exposure / notional;
            const rounded = Math.round(n);
            const err = rounded === 0 ? -1 : rounded / n - 1;
            return (
              <div key={p.key} className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
                <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">{p.name}</div>
                <div className="text-[1.05rem] font-semibold tabular-nums">{n.toFixed(2)}</div>
                <div className="text-[0.75rem] text-(--sl-color-gray-3) tabular-nums">
                  ${Math.round(notional).toLocaleString('en-US')} per contract
                </div>
                <div className="text-[0.75rem] tabular-nums" style={{ color: Math.abs(err) > 0.1 ? 'var(--viz-loss)' : 'var(--sl-color-gray-3)' }}>
                  {rounded} → {err >= 0 ? '+' : '−'}
                  {Math.abs(err * 100).toFixed(0)}% vs target
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
          Notional per contract = multiplier × level. The red figure flags rounding errors above 10%: big contracts cannot size small exposures precisely.
        </p>
      </div>
    </div>
  );
}
