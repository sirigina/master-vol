import type { ReactNode } from 'react';

/** Row of labelled numbers under a figure. Pass [label, value, sub?] tuples. */
export function StatGrid({
  items,
  cols = 4,
}: {
  items: [label: string, value: ReactNode, sub?: ReactNode, accent?: string][];
  cols?: 2 | 3 | 4;
}) {
  const grid = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4';
  return (
    <div className={`mt-3 grid grid-cols-2 gap-3 ${grid}`}>
      {items.map(([label, value, sub, accent]) => (
        <div
          key={label}
          className="rounded-lg border border-(--sl-color-hairline) px-3 py-2"
          style={accent ? { borderColor: accent } : undefined}
        >
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">{label}</div>
          <div className="text-[0.95rem] font-semibold tabular-nums text-(--sl-color-white)">{value}</div>
          {sub && <div className="text-[0.75rem] text-(--sl-color-gray-3)">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

type Swatch = { label: string; color: string; kind?: 'line' | 'dash' | 'box' | 'dot' };

/** Legend row. Colors should be resolved tokens (from useTokens) or CSS vars. */
export function Legend({ items }: { items: Swatch[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.78rem] text-(--sl-color-gray-3)">
      {items.map(({ label, color, kind = 'line' }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          {kind === 'box' ? (
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
          ) : kind === 'dot' ? (
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          ) : (
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" style={{ stroke: color }} strokeWidth="2" strokeDasharray={kind === 'dash' ? '5 4' : undefined} />
            </svg>
          )}
          {label}
        </span>
      ))}
    </div>
  );
}

/** Card title + optional subtitle, used at the top of every widget. */
export function CardHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[0.95rem] font-semibold text-(--sl-color-white)">{title}</div>
        {sub && <div className="text-[0.8rem] text-(--sl-color-gray-3)">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
