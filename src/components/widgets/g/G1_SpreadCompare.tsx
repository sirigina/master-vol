import { useMemo, useState } from 'react';
import GChart, { type Series } from './G1_Chart';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { leg, pnlAt, greeksAt, expiryStats, money, contractGreeks, S0, DTE } from './G1_kit';
import type { Tokens } from '../../../lib/useViz';

export const STRUCTS = [
  { key: 'call', label: 'Long 770 call', color: (t: Tokens) => t.call, legs: [leg('call', 770, 1)] },
  { key: 'vert', label: '770/790 bull call spread', color: (t: Tokens) => t.stock, legs: [leg('call', 770, 1), leg('call', 790, -1)] },
  { key: 'fly', label: '770/780/790 call butterfly', color: (t: Tokens) => t.put, legs: [leg('call', 770, 1), leg('call', 780, -2), leg('call', 790, 1)] },
];

/** G1: one directional view, three structures, side by side. */
export default function G1SpreadCompare() {
  const [when, setWhen] = useState<'exp' | '14' | '0'>('exp');
  const [focus, setFocus] = useState<'all' | 'call' | 'vert' | 'fly'>('all');
  const days = when === 'exp' ? DTE : when === '14' ? 14 : 0;

  const rows = useMemo(
    () => STRUCTS.map((s) => ({ ...s, st: expiryStats(s.legs), g: contractGreeks(greeksAt(s.legs)) })),
    [],
  );
  const shown = STRUCTS.filter((s) => focus === 'all' || s.key === focus);
  const series: Series[] = shown.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    width: 2.25,
    dash: when === 'exp' ? undefined : '6 4',
    f: (x: number) => pnlAt(s.legs, x, days),
  }));

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Same bullish view, three ways to express it"
        sub="Nov 27 calls at their real marks. Hover the chart to compare P/L at any price."
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Show"
          value={focus}
          onChange={setFocus}
          options={[
            { value: 'all', label: 'All three' },
            { value: 'call', label: 'Call' },
            { value: 'vert', label: 'Vertical' },
            { value: 'fly', label: 'Butterfly' },
          ]}
        />
        <Segmented
          label="Valuation date"
          value={when}
          onChange={setWhen}
          options={[
            { value: 'exp', label: 'At expiry' },
            { value: '14', label: 'In 14 days' },
            { value: '0', label: 'Today' },
          ]}
        />
      </div>
      <GChart
        series={series}
        lo={730}
        hi={820}
        spot={S0}
        washKey={focus === 'all' ? undefined : focus}
        yDomain={[-1600, 2000]}
        ariaLabel="Profit and loss of a long call, a bull call spread and a call butterfly"
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[0.82rem]">
          <thead>
            <tr className="text-(--sl-color-gray-3)">
              <th className="py-1.5 pr-2 text-left font-medium">Per contract</th>
              {rows.map((r) => (
                <th key={r.key} className="whitespace-nowrap py-1.5 pl-2 text-right font-medium">
                  <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: `var(--viz-${r.key === 'call' ? 'call' : r.key === 'vert' ? 'stock' : 'put'})` }} />
                  {r.key === 'call' ? 'Call' : r.key === 'vert' ? 'Vertical' : 'Butterfly'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['Cost', (r: (typeof rows)[0]) => money(r.st.cost)],
                ['Max loss', (r: (typeof rows)[0]) => money(r.st.maxLoss)],
                ['Max gain', (r: (typeof rows)[0]) => money(r.st.maxGain)],
                ['Breakeven', (r: (typeof rows)[0]) => r.st.be.map((b) => b.toFixed(2)).join(' / ')],
                ['Delta (shares)', (r: (typeof rows)[0]) => r.g.delta.toFixed(1)],
                ['Gamma (shares per $1)', (r: (typeof rows)[0]) => r.g.gamma.toFixed(2)],
                ['Theta per day', (r: (typeof rows)[0]) => money(r.g.theta / 100, 100, true)],
                ['Vega per vol point', (r: (typeof rows)[0]) => money(r.g.vega / 100, 100, true)],
              ] as [string, (r: (typeof rows)[0]) => string][]
            ).map(([label, f]) => (
              <tr key={label} className="border-t border-(--sl-color-hairline)">
                <td className="py-1.5 pr-2 text-(--sl-color-gray-2)">{label}</td>
                {rows.map((r) => (
                  <td key={r.key} className="py-1.5 pl-2 text-right tabular-nums">
                    {f(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Greeks from Black-Scholes at each
        strike's own IV with SPY at {S0}. Dashed curves value the position before expiry at unchanged IVs.
      </p>
    </div>
  );
}
