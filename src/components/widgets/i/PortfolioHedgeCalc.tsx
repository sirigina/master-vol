import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';
import { money0 } from './LineChart';
import { S0, DTE, EXP_LABEL, quote, SPX_RATIO, type Expiry } from './hedge';

const SPX = snapshot.index.SPX;
const STRIKES: Record<Expiry, number[]> = { nov: [700, 720, 740, 750, 760, 770], dec: [730, 750, 770] };

/** I3: beta-weighted index put hedge for a stock portfolio, in SPY and SPX. */
export default function PortfolioHedgeCalc() {
  const [value, setValue] = useState(1_000_000);
  const [beta, setBeta] = useState(1.2);
  const [exp, setExp] = useState<Expiry>('nov');
  const [k, setK] = useState(740);

  const K = STRIKES[exp].includes(k) ? k : STRIKES[exp][STRIKES[exp].length - 2];
  const q = quote(exp, 'put', K)!;
  const dte = DTE[exp];
  const betaDollars = value * beta;

  const spyExact = betaDollars / (100 * S0);
  const spyN = Math.max(1, Math.round(spyExact));
  const spyCost = spyN * 100 * q.mark;

  const spxExact = betaDollars / (100 * SPX);
  const spxN = Math.max(1, Math.round(spxExact));
  const spxMark = q.mark * SPX_RATIO; // scaled from SPY; SPX options are not in the snapshot
  const spxCost = spxN * 100 * spxMark;

  const deltaN = betaDollars / (100 * S0 * Math.abs(q.delta));
  const otm = 1 - K / S0;
  const portDeductible = beta * otm; // portfolio fall before the puts start paying (beta model)

  const row = (label: string, a: string, b: string, sub?: string) => (
    <tr className="border-t border-(--sl-color-hairline)">
      <td className="py-1.5 pr-2 text-(--sl-color-gray-3)">
        {label}
        {sub && <div className="text-[0.72rem]">{sub}</div>}
      </td>
      <td className="py-1.5 pr-2 text-right font-semibold">{a}</td>
      <td className="py-1.5 text-right font-semibold">{b}</td>
    </tr>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="Portfolio hedge calculator" sub="Beta-weighted index puts. SPX premiums are scaled from the SPY marks (× 10.03), an approximation." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="Portfolio value" value={value} min={250_000} max={5_000_000} step={50_000} onChange={setValue} format={(v) => money0(v)} />
        <Slider label="Portfolio beta to SPY" value={beta} min={0.5} max={2} step={0.05} onChange={setBeta} format={(v) => v.toFixed(2)} />
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Expiry</div>
          <Segmented
            label="Expiry"
            value={exp}
            onChange={setExp}
            options={[
              { value: 'nov', label: `Nov 27 (${DTE.nov}d)` },
              { value: 'dec', label: `Dec 18 (${DTE.dec}d)` },
            ]}
          />
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">SPY put strike (protection level)</div>
          <Segmented label="Put strike" value={String(K)} onChange={(v) => setK(+v)} options={STRIKES[exp].map((s) => ({ value: String(s), label: String(s) }))} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Beta-weighted exposure</div>
          <div className="text-[1rem] font-semibold tabular-nums">{money0(betaDollars)}</div>
          <div className="text-[0.75rem] text-(--sl-color-gray-3)">
            {money0(value)} × {beta.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Strike below spot</div>
          <div className="text-[1rem] font-semibold tabular-nums">{(otm * 100).toFixed(1)}%</div>
          <div className="text-[0.75rem] text-(--sl-color-gray-3)">≈ {(portDeductible * 100).toFixed(1)}% portfolio drop before payout</div>
        </div>
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Delta-neutral count (SPY)</div>
          <div className="text-[1rem] font-semibold tabular-nums">{deltaN.toFixed(0)} puts</div>
          <div className="text-[0.75rem] text-(--sl-color-gray-3)">
            at delta {q.delta.toFixed(3)}: {(deltaN / spyExact).toFixed(1)}× the notional count
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[18rem] text-[0.84rem] tabular-nums">
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              <th className="py-1 pr-2 font-medium">Notional hedge</th>
              <th className="py-1 pr-2 text-right font-medium">SPY puts</th>
              <th className="py-1 text-right font-medium">SPX puts</th>
            </tr>
          </thead>
          <tbody>
            {row('Strike', K.toFixed(0), (K * SPX_RATIO).toFixed(0), 'SPX strike ≈ SPY strike × 10.03')}
            {row('Underlying per contract', money0(100 * S0), money0(100 * SPX))}
            {row('Contracts (exact)', spyExact.toFixed(2), spxExact.toFixed(2))}
            {row('Contracts (rounded)', String(spyN), String(spxN))}
            {row('Coverage', `${((spyN / spyExact) * 100).toFixed(0)}%`, `${((spxN / spxExact) * 100).toFixed(0)}%`)}
            {row('Premium per contract', money0(100 * q.mark), money0(100 * spxMark), `${EXP_LABEL[exp]} mark ${q.mark.toFixed(2)}`)}
            {row('Total cost', money0(spyCost), money0(spxCost))}
            {row('Cost, % of portfolio', `${((spyCost / value) * 100).toFixed(2)}%`, `${((spxCost / value) * 100).toFixed(2)}%`)}
            {row('Annualized if rolled', `${((spyCost / value) * (365 / dte) * 100).toFixed(1)}% / yr`, `${((spxCost / value) * (365 / dte) * 100).toFixed(1)}% / yr`, `× 365 / ${dte}`)}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        SPX contracts are ten times larger, so rounding matters on smaller portfolios: SPY lets you size within about one SPY contract (
        {money0(100 * S0)}), SPX within about {money0(100 * SPX)}.
      </p>
    </div>
  );
}
