import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { closes, atmIv, snapshot, fmt } from '../../../lib/snapshot';
import { realizedVol, rollingVol } from '../../../lib/pricing';

const LONG = realizedVol(closes) * 100;
const RECENT = rollingVol(closes, 20).at(-1)! * 100;
const IMPLIED = atmIv * 100;
const S = snapshot.spot;
const STRADDLE = 25.14;

const INPUTS = [
  { k: 'long', label: 'Long-run (1-year realized)', v: LONG, color: 'var(--viz-stock)' },
  { k: 'recent', label: 'Recent (20-day realized)', v: RECENT, color: 'var(--viz-aqua)' },
  { k: 'implied', label: 'Implied (ATM, Nov 27)', v: IMPLIED, color: 'var(--viz-call)' },
] as const;

/** Blend long-run, recent and implied volatility with user weights into a forecast. */
export default function ForecastBlender() {
  const [w, setW] = useState({ long: 40, recent: 30, implied: 30 });
  const total = w.long + w.recent + w.implied;
  const forecast = total > 0 ? (w.long * LONG + w.recent * RECENT + w.implied * IMPLIED) / total : NaN;
  const diff = forecast - IMPLIED;
  // Rough straddle value at the forecast: straddle scales ~linearly with vol near the money.
  const fair = (STRADDLE * forecast) / IMPLIED;
  const scale = 16;

  return (
    <div className="viz-card not-content">
      <CardHead title="Build a volatility forecast" sub="Weight three inputs. The forecast is their weighted average, compared with the market's implied 14.06%." />
      <div className="grid gap-4 sm:grid-cols-3">
        {INPUTS.map((i) => (
          <div key={i.k}>
            <Slider
              label={i.label}
              value={w[i.k]}
              min={0}
              max={100}
              step={5}
              onChange={(v) => setW((o) => ({ ...o, [i.k]: v }))}
              format={(v) => `${total ? Math.round((100 * v) / total) : 0}%`}
            />
            <div className="mt-1 text-[0.78rem] text-(--sl-color-gray-3)">
              value <b className="tabular-nums text-(--sl-color-white)">{i.v.toFixed(2)}%</b>
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-5 h-14">
        <div className="absolute inset-x-0 top-6 h-[2px] bg-(--sl-color-gray-5)" />
        {[8, 10, 12, 14, 16].map((v) => (
          <div key={v} className={`absolute top-9 text-[0.72rem] text-(--sl-color-gray-3) ${v === 8 ? '' : v === 16 ? '-translate-x-full' : '-translate-x-1/2'}`} style={{ left: `${((v - 8) / (scale - 8)) * 100}%` }}>
            {v}%
          </div>
        ))}
        {INPUTS.map((i) => (
          <div key={i.k} className="absolute top-[18px] h-[18px] w-[3px] -translate-x-1/2 rounded" style={{ left: `${((i.v - 8) / (scale - 8)) * 100}%`, background: i.color }} title={i.label} />
        ))}
        {Number.isFinite(forecast) && (
          <div className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${((forecast - 8) / (scale - 8)) * 100}%` }}>
            <div className="whitespace-nowrap text-[0.75rem] font-semibold text-(--sl-color-white)">forecast</div>
            <div className="mx-auto mt-0.5 h-3 w-3 rotate-45 bg-(--sl-color-white)" />
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-(--sl-color-gray-3)">
        {INPUTS.map((i) => (
          <span key={i.k} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-[3px] rounded" style={{ background: i.color }} />
            {i.label.split(' (')[0]}
          </span>
        ))}
      </div>

      <StatGrid
        items={[
          ['Your forecast', Number.isFinite(forecast) ? `${forecast.toFixed(2)}%` : '–', 'weighted average'],
          ['vs implied', Number.isFinite(diff) ? `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(2)} pts` : '–', diff < 0 ? 'options look rich to you' : 'options look cheap to you', diff < 0 ? 'var(--viz-loss)' : 'var(--viz-profit)'],
          ['770 straddle at your vol', Number.isFinite(fair) ? fmt.usd(fair) : '–', `market ${fmt.usd(STRADDLE)}`],
          ['Your 1-SD move to Nov 27', Number.isFinite(forecast) ? `±${fmt.usd(((S * forecast) / 100) * Math.sqrt(22 / 252))}` : '–', '22 trading days'],
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Straddle value scaled in proportion to volatility, a good approximation near the money. A forecast below implied does not make selling free: the gap must cover the
        risk premium and the chance of a jump.
      </p>
    </div>
  );
}
