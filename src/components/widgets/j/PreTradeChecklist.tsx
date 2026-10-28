import { useEffect, useState } from 'react';
import { CardHead } from '../../ui/Stats';

const KEY = 'mv-j4-checklist';

const GROUPS: { title: string; items: string[] }[] = [
  {
    title: 'View',
    items: [
      'I wrote down a realized-vol forecast and the reason for it before looking at option prices.',
      'I compared the forecast with implied vol for the same horizon (not a 1-year realized against a 1-month implied).',
      'I checked the term structure and skew and know which part of the surface my trade is exposed to.',
      'I know of any scheduled events before expiry (earnings, CPI, FOMC, ex-dividend dates).',
    ],
  },
  {
    title: 'Structure and size',
    items: [
      'The structure matches the view: short vol for rich implied, long vol for cheap implied.',
      'Max loss is defined, and the size keeps it within my risk budget.',
      'I priced the trade at mid and know the bid-ask cost of getting in and out.',
      'I checked early-assignment and settlement risks for every short leg (lesson J1).',
    ],
  },
  {
    title: 'Risk and exit',
    items: [
      'I looked at the scenario grid: price ±5%, vol ±3 points, and time passing.',
      'I wrote a profit target, a stop, and a time-based exit before entering.',
      'I know what adjustment I will make, and at what delta or price, if the market moves against me.',
      'I will log the trade and review it against the forecast afterwards.',
    ],
  },
];
const TOTAL = GROUPS.reduce((a, g) => a + g.items.length, 0);

/** J4: pre-trade checklist; completion is stored in this browser only. */
export default function PreTradeChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') setDone(saved);
    } catch {}
  }, []);

  function toggle(id: string) {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  function reset() {
    setDone({});
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  const count = Object.values(done).filter(Boolean).length;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Pre-trade checklist"
        sub="Ticks are saved in this browser only."
        right={
          <button type="button" onClick={reset} className="cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-2.5 py-1 text-[0.8rem] text-(--sl-color-white)">
            Reset
          </button>
        }
      />
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[0.8rem] text-(--sl-color-gray-3)">
          <span>Progress</span>
          <span className="tabular-nums">
            {count} / {TOTAL}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-(--sl-color-gray-5)">
          <div className="h-full rounded-full bg-(--sl-color-accent) transition-all" style={{ width: `${(count / TOTAL) * 100}%` }} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {GROUPS.map((g, gi) => (
          <fieldset key={g.title} className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-1.5 text-[0.82rem] font-semibold">{g.title}</legend>
            {g.items.map((it, ii) => {
              const id = `${gi}-${ii}`;
              return (
                <label key={id} className="mb-1.5 flex cursor-pointer items-start gap-2 text-[0.8rem] leading-snug text-(--sl-color-gray-2)">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-(--sl-color-accent)" checked={!!done[id]} onChange={() => toggle(id)} />
                  <span style={{ textDecoration: done[id] ? 'line-through' : undefined, opacity: done[id] ? 0.7 : 1 }}>{it}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
      {count === TOTAL && <p className="mt-2 mb-0 text-[0.82rem] font-semibold text-(--sl-color-white)">All checks complete. The plan is ready to review, not necessarily to trade.</p>}
    </div>
  );
}
