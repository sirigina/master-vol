import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import Thumb from './G7_Thumb';
import { rank, edge, IMPLIED, netOf, type Dir } from './G7_families';
import { money, usd } from './G6_helpers';

/** Interactive decision framework: inputs → ranked spread families with real-price payoffs. */
export default function SpreadSelector() {
  const t = useTokens();
  const [forecast, setForecast] = useState(11);
  const [move, setMove] = useState<'smooth' | 'jumpy'>('smooth');
  const [dir, setDir] = useState<Dir>('neutral');
  const [risk, setRisk] = useState<'limited' | 'any'>('limited');
  const [skew, setSkew] = useState<'rich' | 'fair' | 'cheap'>('fair');
  const [term, setTerm] = useState<'none' | 'front' | 'back'>('none');
  const ranked = rank({ forecast: forecast / 100, jumpy: move === 'jumpy', dir, limitedOnly: risk === 'limited', skew, term });
  const shown = ranked.filter((r) => !r.excluded).slice(0, 4);
  const hidden = ranked.filter((r) => r.excluded).length;
  const gap = forecast - IMPLIED * 100;

  const control = (label: string, el: React.ReactNode) => (
    <div className="min-w-0">
      <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">{label}</div>
      {el}
    </div>
  );

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Which volatility spread fits the view?"
        sub={`Implied ATM vol to Nov 27 is ${(IMPLIED * 100).toFixed(1)}%. Set your forecast and constraints; families are ranked by fit, using real Nov 27 / Dec 18 prices.`}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Slider
          label="Vol forecast to Nov 27"
          value={forecast}
          min={8}
          max={22}
          step={0.5}
          onChange={setForecast}
          format={(v) => `${v.toFixed(1)}% (${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)})`}
        />
        {control('Expected moves', <Segmented label="Move size" value={move} onChange={setMove} options={[{ value: 'smooth', label: 'Steady' }, { value: 'jumpy', label: 'Jump risk' }]} />)}
        {control('Directional bias', <Segmented label="Direction" value={dir} onChange={setDir} options={[{ value: 'down', label: 'Down' }, { value: 'neutral', label: 'None' }, { value: 'up', label: 'Up' }]} />)}
        {control('Risk tolerance', <Segmented label="Risk" value={risk} onChange={setRisk} options={[{ value: 'limited', label: 'Limited only' }, { value: 'any', label: 'Can carry open-ended' }]} />)}
        {control('Downside put skew looks', <Segmented label="Skew view" value={skew} onChange={setSkew} options={[{ value: 'cheap', label: 'Cheap' }, { value: 'fair', label: 'Fair' }, { value: 'rich', label: 'Rich' }]} />)}
        {control('Term structure: which month is rich?', <Segmented label="Term view" value={term} onChange={setTerm} options={[{ value: 'none', label: 'No view' }, { value: 'front', label: 'Nov' }, { value: 'back', label: 'Dec' }]} />)}
      </div>
      <ol className="m-0 grid list-none gap-2 p-0">
        {shown.map((r, i) => {
          const e = edge(r.f, forecast / 100);
          const n = netOf(r.f);
          return (
            <li key={r.f.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-(--sl-color-hairline) px-3 py-2" style={i === 0 ? { borderColor: t.call } : undefined}>
              <span className="w-5 text-[0.85rem] font-semibold tabular-nums text-(--sl-color-gray-3)">{i + 1}</span>
              <Thumb f={r.f} />
              <div className="min-w-[12rem] flex-1">
                <div className="text-[0.9rem] font-semibold text-(--sl-color-white)">{r.f.name}</div>
                <div className="text-[0.76rem] text-(--sl-color-gray-3)">
                  {r.f.build} · {n >= 0 ? 'debit' : 'credit'} {usd(Math.abs(n) * 100)}
                  {r.f.calendar ? '' : ` · edge at your forecast ${money(e * 100)}`}
                </div>
                <div className="text-[0.8rem] text-(--sl-color-gray-2)">{r.why.charAt(0).toUpperCase() + r.why.slice(1)}.</div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        Thumbnails: P/L on Nov 27 for SPY within ±2 standard deviations (about ±$63), dashed line at today's price. Edge = value of the legs at their own IVs shifted by your
        forecast minus implied, minus market cost, per contract. {hidden > 0 && risk === 'limited' ? `${hidden} open-ended families hidden by your risk setting. ` : ''}A ranking
        of fit to stated views, not a recommendation.
      </p>
    </div>
  );
}
