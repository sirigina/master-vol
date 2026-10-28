import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { spyWithinSd } from './volmath';

const rows = spyWithinSd();

/** SPY's real daily moves checked against the 68-95-99.7 rule. Teaser for C2. */
export default function SpyVsNormal() {
  const [view, setView] = useState<'inside' | 'beyond'>('beyond');
  const n = rows[0].n;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Does SPY follow the 68-95-99.7 rule?"
        sub={`SPY's ${n} daily moves over the past year, measured against their own standard deviation`}
        right={
          <Segmented
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: 'beyond', label: 'Days outside' },
              { value: 'inside', label: '% inside' },
            ]}
          />
        }
      />
      <div className="space-y-4">
        {rows.map((r) => {
          const spy = view === 'inside' ? r.share * 100 : r.beyond;
          const nor = view === 'inside' ? r.normal * 100 : r.normalBeyond;
          const max = view === 'inside' ? 100 : rows[0].normalBeyond * 1.05;
          const lab = (v: number) => (view === 'inside' ? `${v.toFixed(1)}%` : v < 1 ? v.toFixed(1) : v.toFixed(0));
          return (
            <div key={r.k} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 text-[0.84rem]">
              <span className="font-semibold text-(--sl-color-white)">±{r.k} SD</span>
              <div className="space-y-1">
                {[
                  ['SPY', spy, 'var(--viz-call)'],
                  ['Normal', nor, 'var(--viz-put)'],
                ].map(([k, v, c]) => (
                  <div key={k as string} className="grid grid-cols-[1fr_4.5rem] items-center gap-2">
                    <div className="h-3 rounded-sm bg-(--sl-color-gray-6)">
                      <div className="h-3 rounded-sm" style={{ width: `${Math.max(((v as number) / max) * 100, 0.8)}%`, background: c as string }} />
                    </div>
                    <span className="text-right tabular-nums">{lab(v as number)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Legend
        items={[
          { label: 'SPY, actual days', color: 'var(--viz-call)', kind: 'box' },
          { label: 'Normal (bell curve) prediction', color: 'var(--viz-put)', kind: 'box' },
        ]}
      />
      <p className="mt-2 text-[0.8rem] text-(--sl-color-gray-3)">
        More quiet days inside ±1 SD than the bell predicts, and more extreme days beyond ±2 and ±3 SD. Lesson C2 looks at the full histogram.
      </p>
    </div>
  );
}
