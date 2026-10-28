import { Fragment, useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { snapshot, type ChainRow } from '../../../lib/snapshot';
import { S0, allStrikes, quote } from './common';

type Cols = 'quote' | 'mark' | 'greek';
const COLS: Record<Cols, { label: string; fields: [string, (r: ChainRow) => string][] }> = {
  quote: { label: 'Bid / Ask', fields: [['Bid', (r) => r.bid.toFixed(2)], ['Ask', (r) => r.ask.toFixed(2)]] },
  mark: { label: 'Mark / IV', fields: [['Mark', (r) => r.mark.toFixed(2)], ['IV', (r) => `${(r.iv * 100).toFixed(1)}%`]] },
  greek: { label: 'Delta / Theta', fields: [['Delta', (r) => r.delta.toFixed(2)], ['Theta', (r) => r.theta.toFixed(2)]] },
};

/** The real Nov 27 chain laid out the way trading screens show it. */
export default function ChainViewer() {
  const [cols, setCols] = useState<Cols>('quote');
  const [sel, setSel] = useState<number | null>(770);
  const f = COLS[cols].fields;
  const spotAfter = allStrikes.filter((k) => k < S0).pop()!;

  const cell = (r: ChainRow | undefined, i: number, itm: boolean, side: 'call' | 'put') => (
    <td
      key={`${side}${i}`}
      className="px-1.5 py-1 text-right tabular-nums sm:px-2"
      style={{ background: r && itm ? (side === 'call' ? 'var(--viz-band-2)' : 'color-mix(in srgb, var(--viz-put) 12%, transparent)') : undefined }}
    >
      {r ? f[i][1](r) : <span className="text-(--sl-color-gray-4)">—</span>}
    </td>
  );

  const selC = sel !== null ? quote('call', sel) : undefined;
  const selP = sel !== null ? quote('put', sel) : undefined;

  return (
    <div className="viz-card not-content">
      <CardHead
        title={`SPY option chain, Nov 27, 2026 (${snapshot.chain.dte} days)`}
        sub="Calls left, puts right, strike in the middle. Shaded cells are in the money with SPY at 769.66. Tap a row."
      />
      <div className="mb-3">
        <Segmented label="Columns" value={cols} onChange={setCols} options={Object.entries(COLS).map(([k, v]) => ({ value: k as Cols, label: v.label }))} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[0.8rem]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th colSpan={2} className="pb-1 text-center text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--viz-call)' }}>
                Calls
              </th>
              <th />
              <th colSpan={2} className="pb-1 text-center text-[0.72rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--viz-put)' }}>
                Puts
              </th>
            </tr>
            <tr className="text-(--sl-color-gray-3)">
              {f.map(([h]) => (
                <th key={`c${h}`} className="px-1.5 py-1 text-right font-medium sm:px-2">
                  {h}
                </th>
              ))}
              <th className="px-1.5 py-1 text-center font-medium sm:px-2">Strike</th>
              {f.map(([h]) => (
                <th key={`p${h}`} className="px-1.5 py-1 text-right font-medium sm:px-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allStrikes.map((k) => {
              const c = quote('call', k);
              const p = quote('put', k);
              const isSel = sel === k;
              return (
                <Fragment key={k}>
                  <tr
                    onClick={() => setSel(k)}
                    className="cursor-pointer border-t border-(--sl-color-hairline)"
                    style={{ outline: isSel ? '2px solid var(--sl-color-accent)' : undefined, outlineOffset: -2 }}
                  >
                    {cell(c, 0, k < S0, 'call')}
                    {cell(c, 1, k < S0, 'call')}
                    <td className="px-2 py-1 text-center font-semibold tabular-nums text-(--sl-color-white)" style={{ background: 'var(--sl-color-gray-6)' }}>
                      {k}
                    </td>
                    {cell(p, 0, k > S0, 'put')}
                    {cell(p, 1, k > S0, 'put')}
                  </tr>
                  {k === spotAfter && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="flex items-center gap-2 py-0.5 text-[0.7rem] font-semibold" style={{ color: 'var(--viz-stock)' }}>
                          <span className="h-px flex-1" style={{ background: 'var(--viz-stock)' }} />
                          SPY {S0}
                          <span className="h-px flex-1" style={{ background: 'var(--viz-stock)' }} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {sel !== null && (
        <div className="mt-3 grid grid-cols-1 gap-2 text-[0.8rem] sm:grid-cols-2">
          {[
            ['call', selC] as const,
            ['put', selP] as const,
          ].map(([side, r]) => (
            <div key={side} className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
              <div className="font-semibold" style={{ color: side === 'call' ? 'var(--viz-call)' : 'var(--viz-put)' }}>
                {sel} {side}
              </div>
              {r ? (
                <div className="text-(--sl-color-gray-2)">
                  {(side === 'call' ? sel < S0 : sel > S0) ? 'In the money' : 'Out of the money'}. Buy at {r.ask.toFixed(2)} or sell at {r.bid.toFixed(2)};
                  one contract costs about ${(r.mark * 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} at the mark. Delta {r.delta.toFixed(2)}.
                </div>
              ) : (
                <div className="text-(--sl-color-gray-3)">Not in this snapshot (the vendor pull skipped this strike).</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
