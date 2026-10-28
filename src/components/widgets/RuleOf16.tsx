import { useState } from 'react';
import { Slider } from '../ui/Slider';
import { snapshot, atmIv, fmt } from '../../lib/snapshot';

const HORIZONS = [
  { label: 'One day', days: 1, rule: '÷ 16' },
  { label: 'One week', days: 5, rule: '÷ 7' },
  { label: 'One month', days: 21, rule: '÷ 3.5' },
  { label: 'Three months', days: 63, rule: '÷ 2' },
  { label: 'One year', days: 252, rule: '× 1' },
];

export default function RuleOf16() {
  const [vol, setVol] = useState(Math.round(atmIv * 1000) / 10);
  const [price, setPrice] = useState(Math.round(snapshot.spot));
  const max = vol;
  return (
    <div className="viz-card not-content">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="Annualized volatility" value={vol} min={5} max={80} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="Stock price" value={price} min={20} max={1000} step={1} onChange={setPrice} format={(v) => fmt.usd(v, 0)} />
      </div>
      <div className="mt-4 space-y-2">
        {HORIZONS.map((h) => {
          const pct = vol * Math.sqrt(h.days / 252);
          return (
            <div key={h.label} className="grid grid-cols-[7.6rem_1fr_auto] items-center gap-3 text-[0.85rem]">
              <span className="text-(--sl-color-gray-2)">
                {h.label} <span className="text-[0.72rem] text-(--sl-color-gray-3)">{h.rule}</span>
              </span>
              <div className="h-3 rounded-sm bg-(--sl-color-gray-6)">
                <div className="h-3 rounded-sm" style={{ width: `${Math.max((pct / max) * 100, 1.5)}%`, background: 'var(--viz-call)' }} />
              </div>
              <span className="min-w-[8.5rem] text-right font-semibold tabular-nums">
                ±{pct.toFixed(2)}% <span className="font-normal text-(--sl-color-gray-3)">({fmt.usd((price * pct) / 100)})</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        One standard deviation. Roughly two days in three land inside it; one in three lands outside.
      </p>
    </div>
  );
}
