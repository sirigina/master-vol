import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import Heatmap from './G6_Heatmap';
import { calendarLegs, pnlAtFront } from './G6_CalendarBuilder';
import { money } from './G6_helpers';

const PRICES = Array.from({ length: 15 }, (_, i) => 735 + i * 5);
const SHIFTS = [4, 3, 2, 1, 0, -1, -2, -3, -4];

/** 770 calendar P/L on Nov 27 across SPY price and change in December IV. */
export default function CalendarHeatmap() {
  const [right, setRight] = useState<'call' | 'put'>('call');
  const legs = calendarLegs(right, 770, 770);
  const values = SHIFTS.map((sh) => PRICES.map((s) => pnlAtFront(legs, s, sh / 100) * 100));
  const fmtCell = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v))}`;
  return (
    <div className="viz-card not-content">
      <CardHead
        title={`770 ${right} calendar on November 27: price × volatility`}
        sub="Each cell is P/L per contract (dollars) when the November option expires. Rows move December IV up or down."
        right={<Segmented label="Option type" value={right} onChange={(v) => setRight(v)} options={[{ value: 'call', label: 'Calls' }, { value: 'put', label: 'Puts' }]} />}
      />
      <Heatmap
        cols={PRICES.map(String)}
        rows={SHIFTS.map((s) => `${s > 0 ? '+' : s < 0 ? '−' : ''}${Math.abs(s)} pt`)}
        values={values}
        xLabel="SPY price on November 27"
        yLabel="Change in Dec IV"
        mode="diverging"
        fmtCell={fmtCell}
        highlight={[4, 7]}
        ariaLabel="Heatmap of calendar spread profit and loss by SPY price and change in implied volatility"
        tip={(r, c, v) => (
          <>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              SPY {PRICES[c]}, Dec IV {SHIFTS[r] >= 0 ? '+' : '−'}
              {Math.abs(SHIFTS[r])} pt
            </div>
            <div>
              P/L: <b>{money(v)}</b>
            </div>
          </>
        )}
      />
      <div className="mt-2 flex flex-wrap gap-x-5 text-[0.78rem] text-(--sl-color-gray-3)">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--viz-profit)' }} /> profit
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--viz-loss)' }} /> loss
        </span>
        <span>Outlined cell: SPY 770, IV unchanged</span>
      </div>
    </div>
  );
}
