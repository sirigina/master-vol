import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { snapshot, fmt } from '../../../lib/snapshot';

const S0 = snapshot.spot;

/** +X% then −X% leaves you below where you started; log returns add up cleanly. */
export default function UpDownCalc() {
  const [x, setX] = useState(20);
  const f = x / 100;
  const up = S0 * (1 + f);
  const back = up * (1 - f);
  const needed = 1 / (1 - f) - 1;
  const lu = Math.log(1 + f);
  const ld = Math.log(1 - f);

  const max = S0 * (1 + 0.9);
  const bar = (label: string, v: number, color: string, note: string) => (
    <div className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3 text-[0.84rem] max-sm:grid-cols-[5rem_1fr_4.8rem]">
      <span className="text-(--sl-color-gray-2)">{label}</span>
      <div className="relative h-4 rounded-sm bg-(--sl-color-gray-6)">
        <div className="h-4 rounded-sm" style={{ width: `${(v / max) * 100}%`, background: color }} />
        <div className="absolute top-[-3px] h-[22px] w-[2px]" style={{ left: `${(S0 / max) * 100}%`, background: 'var(--viz-ink)' }} title="start" />
      </div>
      <span className="text-right font-semibold tabular-nums">
        {fmt.usd(v, 0)}
        <span className="block text-[0.7rem] font-normal text-(--sl-color-gray-3)">{note}</span>
      </span>
    </div>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="Up X%, then down X%" sub="SPY at 769.66 rises by X%, then falls by the same X%. The vertical tick marks the starting price." />
      <Slider label="Move size X" value={x} min={1} max={90} step={1} onChange={setX} format={(v) => `${v}%`} />
      <div className="mt-4 space-y-2.5">
        {bar('Start', S0, 'var(--viz-muted)', '')}
        {bar(`After +${x}%`, up, 'var(--viz-profit)', `+${fmt.usd(up - S0, 0)}`)}
        {bar(`Then −${x}%`, back, 'var(--viz-loss)', `−${fmt.usd(S0 - back, 0)}`)}
      </div>
      <StatGrid
        items={[
          ['Net result', `−${(f * f * 100).toFixed(2)}%`, '(1 + X)(1 − X) − 1 = −X²', 'var(--viz-loss)'],
          [`Rise needed to undo −${x}%`, `+${(needed * 100).toFixed(1)}%`, 'losses need bigger gains to recover'],
          ['Log return of the rise', `+${(lu * 100).toFixed(2)}%`, `ln(1 + ${f.toFixed(2)})`],
          ['Log return of the fall', `−${Math.abs(ld * 100).toFixed(2)}%`, `sum: −${Math.abs((lu + ld) * 100).toFixed(2)}%, exact`],
        ]}
      />
    </div>
  );
}
