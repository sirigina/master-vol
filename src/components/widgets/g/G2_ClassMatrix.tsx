import { useMemo, useState } from 'react';
import GChart from './G1_Chart';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { SPREADS, FAMILY_LABEL, type Family, type SpreadDef } from './G2_spreads';
import { pnlAt, greeksAt, contractGreeks, costLabel, money, S0, DTE } from './G1_kit';

const FAMS: Family[] = ['long', 'short', 'mixed'];

function Chip({ s, on, onClick }: { s: SpreadDef; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="cursor-pointer rounded-md border px-2 py-1 text-[0.8rem] font-medium"
      style={{
        borderColor: on ? 'var(--sl-color-accent)' : 'var(--sl-color-hairline-shade)',
        background: on ? 'var(--sl-color-accent-low)' : 'transparent',
        color: 'var(--sl-color-white)',
      }}
    >
      {s.label}
    </button>
  );
}

/** G2: pick a spread, see its payoff and the signs of gamma, theta and vega. */
export default function G2ClassMatrix() {
  const [key, setKey] = useState('lstrad');
  const [mode, setMode] = useState<'show' | 'guess'>('show');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const sp = SPREADS.find((s) => s.key === key)!;
  const g = useMemo(() => contractGreeks(greeksAt(sp.legs)), [key]);
  const hidden = mode === 'guess' && !revealed.has(key);

  const sign = (v: number) => (v > 0 ? '+' : '−');
  const chips: [string, number, string, string][] = [
    ['Gamma', g.gamma, `${sign(g.gamma)}${Math.abs(g.gamma).toFixed(2)} sh per $1`, g.gamma > 0 ? 'big moves help' : 'big moves hurt'],
    ['Theta', g.theta, `${money(g.theta / 100, 100, true)} / day`, g.theta > 0 ? 'time decay earns' : 'time decay costs'],
    ['Vega', g.vega, `${money(g.vega / 100, 100, true)} / vol pt`, g.vega > 0 ? 'rising IV helps' : 'falling IV helps'],
  ];
  const isCal = key === 'cal';

  return (
    <div className="viz-card not-content">
      <CardHead
        title="The volatility-spread map"
        sub="Pick a spread. Legs are real Nov 27 marks; the calendar's long leg is the Dec 18 770 call."
        right={
          <Segmented
            label="Mode"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setRevealed(new Set());
            }}
            options={[
              { value: 'show', label: 'Show families' },
              { value: 'guess', label: 'Quiz me' },
            ]}
          />
        }
      />
      {mode === 'show' ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          {FAMS.map((f) => (
            <div key={f} className="rounded-lg border border-(--sl-color-hairline) p-2">
              <div className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-(--sl-color-gray-3)">{FAMILY_LABEL[f]}</div>
              <div className="flex flex-wrap gap-1.5">
                {SPREADS.filter((s) => s.family === f).map((s) => (
                  <Chip key={s.key} s={s} on={s.key === key} onClick={() => setKey(s.key)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-(--sl-color-hairline) p-2">
          <div className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-(--sl-color-gray-3)">
            Shuffled. Read the payoff, call the signs, then reveal.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...SPREADS].sort((a, b) => a.desc.length - b.desc.length).map((s) => (
              <Chip key={s.key} s={s} on={s.key === key} onClick={() => setKey(s.key)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 text-[0.85rem] text-(--sl-color-gray-2)">
        <b className="text-(--sl-color-white)">{sp.label}</b>: {sp.desc}. {costLabel(sp.legs.reduce((a, l) => a + l.qty * l.premium, 0))} per spread.
      </div>

      <GChart
        series={[
          {
            key: 'exp',
            label: isCal ? 'At Nov 27 expiry (Dec call valued at its IV)' : 'At expiry',
            color: (t) => t.ink,
            f: (x) => pnlAt(sp.legs, x, DTE),
          },
          { key: 'now', label: 'Today (model)', color: (t) => t.stock, dash: '5 4', f: (x) => pnlAt(sp.legs, x, 0) },
        ]}
        washKey="exp"
        lo={720}
        hi={820}
        spot={S0}
        height={280}
        ariaLabel={`Payoff of the ${sp.label}`}
      />

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: hidden ? 'var(--sl-color-hairline)' : sp.family === 'long' ? 'var(--viz-aqua)' : sp.family === 'short' ? 'var(--viz-put)' : 'var(--viz-stock)' }}>
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Family</div>
          <div className="text-[0.95rem] font-semibold">{hidden ? '?' : FAMILY_LABEL[sp.family]}</div>
          <div className="text-[0.75rem] text-(--sl-color-gray-3)">{hidden ? 'long vol, short vol, or neither?' : sp.family === 'mixed' ? 'long vega, short gamma' : sp.family === 'long' ? 'long gamma and vega' : 'short gamma and vega'}</div>
        </div>
        {chips.map(([name, v, val, note]) => (
          <div key={name} className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
            <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">{name}</div>
            <div className="text-[0.95rem] font-semibold tabular-nums" style={{ color: hidden ? undefined : v > 0 ? 'var(--viz-profit)' : 'var(--viz-loss)' }}>
              {hidden ? '?' : v > 0 ? 'Positive' : 'Negative'}
            </div>
            <div className="text-[0.75rem] tabular-nums text-(--sl-color-gray-3)">{hidden ? ' ' : `${val}, ${note}`}</div>
          </div>
        ))}
      </div>
      {hidden && (
        <button
          type="button"
          onClick={() => setRevealed((r) => new Set(r).add(key))}
          className="mt-3 cursor-pointer rounded-md border border-(--sl-color-accent) bg-transparent px-3 py-1.5 text-[0.82rem] font-semibold text-(--sl-color-white)"
        >
          Reveal signs
        </button>
      )}
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Greeks per spread (100 shares per contract), Black-Scholes at each leg's own IV with SPY at {S0}.
      </p>
    </div>
  );
}
