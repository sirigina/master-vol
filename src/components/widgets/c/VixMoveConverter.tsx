import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { snapshot, fmt } from '../../../lib/snapshot';

const H = [
  { k: 'day', label: 'One day', days: 1, rule: 'VIX ÷ 16' },
  { k: 'week', label: 'One week', days: 5, rule: 'VIX ÷ 7.1' },
  { k: 'month', label: 'One month', days: 21, rule: 'VIX ÷ 3.46 (√12)' },
] as const;

/** Turn a VIX level into a one-standard-deviation expected move for SPX and SPY. */
export default function VixMoveConverter() {
  const [vix, setVix] = useState(snapshot.index.VIX);
  const [band, setBand] = useState<'1' | '2'>('1');
  const k = +band;
  const spx = snapshot.index.SPX;
  const spy = snapshot.spot;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="From VIX to an expected move"
        sub={`SPX ${fmt.num(spx, 1)} and SPY ${spy} at the snapshot. ${band === '1' ? 'One SD covers about 68% of outcomes.' : 'Two SD covers about 95%.'}`}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Slider
          label="VIX level"
          value={vix}
          min={9}
          max={80}
          step={0.01}
          onChange={setVix}
          format={(v) => `${v.toFixed(2)}${Math.abs(v - snapshot.index.VIX) < 0.005 ? ' (snapshot)' : ''}`}
        />
        <Segmented
          label="Band"
          value={band}
          onChange={setBand}
          options={[
            { value: '1', label: '±1 SD' },
            { value: '2', label: '±2 SD' },
          ]}
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-[0.85rem] tabular-nums">
          <thead>
            <tr className="text-left text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">
              <th className="py-1.5 pr-2 font-medium">Horizon</th>
              <th className="py-1.5 pr-2 text-right font-medium">Move %</th>
              <th className="py-1.5 pr-2 text-right font-medium">SPX pts</th>
              <th className="py-1.5 text-right font-medium">SPY $</th>
            </tr>
          </thead>
          <tbody>
            {H.map((h) => {
              const pct = (k * vix * Math.sqrt(h.days / 252)) / 100;
              return (
                <tr key={h.k} className="border-t border-(--sl-color-hairline)">
                  <td className="py-2 pr-2">
                    <div className="font-semibold text-(--sl-color-white)">{h.label}</div>
                    <div className="text-[0.72rem] text-(--sl-color-gray-3)">{h.rule}</div>
                  </td>
                  <td className="py-2 pr-2 text-right font-semibold text-(--sl-color-white)">±{(pct * 100).toFixed(2)}%</td>
                  <td className="py-2 pr-2 text-right">
                    ±{fmt.num(spx * pct, 0)}
                    <div className="whitespace-nowrap text-[0.7rem] text-(--sl-color-gray-3)">
                      {(spx * (1 - pct)).toFixed(0)}–{(spx * (1 + pct)).toFixed(0)}
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    ±{fmt.usd(spy * pct)}
                    <div className="text-[0.72rem] text-(--sl-color-gray-3)">
                      {(spy * (1 - pct)).toFixed(0)}–{(spy * (1 + pct)).toFixed(0)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        Uses 252 trading days a year (1, 5 and 21 sessions). VIX is quoted on 30 calendar days, so the month row is the closest match; the day and week rows assume
        volatility is spread evenly.
      </p>
    </div>
  );
}
