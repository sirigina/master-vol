import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { FAMILIES, edge, worst2sd, greeks, netOf, IMPLIED } from './G7_families';
import { money, usd } from './G6_helpers';

const TARGET = 200;

/** Candidate spreads scaled to the same theoretical edge, compared on risk. */
export default function EdgeTable() {
  const t = useTokens();
  const [forecast, setForecast] = useState(11);
  const fc = forecast / 100;
  const rows = FAMILIES.filter((f) => !f.calendar)
    .map((f) => {
      const e = edge(f, fc) * 100;
      if (e <= 1) return null;
      const n = TARGET / e;
      const g = greeks(f);
      const w = worst2sd(f) * 100 * n;
      return { f, n, prem: netOf(f) * 100 * n, worst: w, ratio: TARGET / Math.abs(w), vega: g.vega * 100 * n, gamma: g.gamma * 100 * n, theta: g.theta * 100 * n, limited: f.limited };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.ratio - a.ratio);
  const best = rows.length ? rows[0].ratio : 0;
  const near = Math.abs(forecast - IMPLIED * 100) < 0.3;

  return (
    <div className="viz-card not-content">
      <CardHead
        title={`Same edge, different risk: candidates scaled to ${usd(TARGET)} of theoretical edge`}
        sub="Each row is sized so that, at your forecast, its theoretical value exceeds its cost by the same amount. Then compare what you carry to earn it."
      />
      <Slider
        className="mb-3 sm:w-80"
        label="Your forecast vs implied"
        value={forecast}
        min={8}
        max={22}
        step={0.5}
        onChange={setForecast}
        format={(v) => `${v.toFixed(1)}% vs ${(IMPLIED * 100).toFixed(1)}%`}
      />
      {near || rows.length === 0 ? (
        <p className="text-[0.85rem] text-(--sl-color-gray-2)">Forecast is too close to implied: no spread has meaningful theoretical edge, so there is nothing to size.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] whitespace-nowrap text-[0.78rem] tabular-nums">
            <thead>
              <tr className="text-left text-(--sl-color-gray-3)">
                <th className="py-1 pr-1.5 font-medium">Spread</th>
                <th className="py-1 pr-1.5 text-right font-medium">Qty</th>
                <th className="py-1 pr-1.5 text-right font-medium">Premium</th>
                <th className="py-1 pr-1.5 text-right font-medium">Worst</th>
                <th className="py-1 pr-1.5 text-right font-medium">Edge/risk</th>
                <th className="py-1 pr-1.5 text-right font-medium">Vega</th>
                <th className="py-1 pr-1.5 text-right font-medium">Gamma</th>
                <th className="py-1 text-right font-medium">Theta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.f.id} className="border-t border-(--sl-color-hairline)">
                  <td className="py-1.5 pr-1.5 font-medium text-(--sl-color-white)">
                    {r.f.name}
                    {!r.limited && <div className="text-[0.72rem] font-normal" style={{ color: t.loss }}>open-ended risk</div>}
                  </td>
                  <td className="py-1.5 pr-1.5 text-right">{r.n.toFixed(1)}</td>
                  <td className="py-1.5 pr-1.5 text-right">{r.prem >= 0 ? `pay ${usd(r.prem)}` : `collect ${usd(-r.prem)}`}</td>
                  <td className="py-1.5 pr-1.5 text-right" style={{ color: t.loss }}>{money(r.worst)}</td>
                  <td className="py-1.5 pr-1.5 text-right">
                    <span className="inline-block min-w-[3.2rem] rounded px-1" style={{ background: r.ratio === best ? t['band-1'] : 'transparent' }}>
                      {r.ratio.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-1.5 text-right">{money(r.vega)}</td>
                  <td className="py-1.5 pr-1.5 text-right">{(r.gamma).toFixed(1)}</td>
                  <td className="py-1.5 text-right">{money(r.theta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        Qty: contracts. Worst: lowest P/L on Nov 27 with SPY within two standard deviations at implied vol, IVs unchanged; open-ended spreads can lose more beyond that range. Gamma in shares per $1, theta per day.
        Edge keeps each strike's skew and shifts all IVs by forecast − implied. Calendars are left out: their edge depends on a term-structure view, not one forecast.
      </p>
    </div>
  );
}
