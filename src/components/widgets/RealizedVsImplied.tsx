import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from './PlotFigure';
import { Segmented } from '../ui/Segmented';
import { closes, dates, atmIv } from '../../lib/snapshot';
import { rollingVol } from '../../lib/pricing';

export default function RealizedVsImplied() {
  const [win, setWin] = useState<'10' | '20' | '60'>('20');
  const data = useMemo(() => {
    const rv = rollingVol(closes, +win);
    return rv.map((v, i) => ({ date: dates[i], rv: v === null ? null : v * 100 })).filter((d) => d.rv !== null);
  }, [win]);
  const lastRv = data[data.length - 1].rv!;

  return (
    <div className="viz-card not-content">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[0.95rem] font-semibold text-(--sl-color-white)">How much SPY actually moved vs what options are pricing</div>
        <Segmented
          label="Look-back window"
          value={win}
          onChange={setWin}
          options={[
            { value: '10', label: '10-day' },
            { value: '20', label: '20-day' },
            { value: '60', label: '60-day' },
          ]}
        />
      </div>
      <PlotFigure
        deps={[win]}
        minHeight={280}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 280,
            marginLeft: 40,
            marginRight: width < 520 ? 12 : 120,
            style: plotStyle(t),
            x: { label: null },
            y: { label: 'Annualized %', grid: true, domain: [0, Math.max(30, ...data.map((d) => d.rv!)) + 2] },
            marks: [
              Plot.ruleY([atmIv * 100], { stroke: t.put, strokeWidth: 2, strokeDasharray: '6 4' }),
              Plot.text([atmIv * 100], {
                y: (d: number) => d,
                frameAnchor: width < 520 ? 'left' : 'right',
                dx: width < 520 ? 4 : 116,
                dy: width < 520 ? 10 : -8,
                textAnchor: width < 520 ? 'start' : 'end',
                text: () => `Implied ${(atmIv * 100).toFixed(1)}%`,
                fill: t.put,
                fontWeight: 600,
                stroke: t.surface,
                strokeWidth: 3,
                paintOrder: 'stroke',
              }),
              Plot.lineY(data, { x: 'date', y: 'rv', stroke: t.call, strokeWidth: 2 }),
              Plot.dot([data[data.length - 1]], { x: 'date', y: 'rv', r: 4, fill: t.call, stroke: t.surface, strokeWidth: 2 }),
              width >= 520
                ? Plot.text([data[data.length - 1]], { x: 'date', y: 'rv', dx: 8, textAnchor: 'start', text: (d: { rv: number }) => `Realized ${d.rv.toFixed(1)}%`, fill: t.call, fontWeight: 600 })
                : null,
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.tip(data, Plot.pointerX({ x: 'date', y: 'rv', title: (d: { date: Date; rv: number }) => `${d.date.toDateString().slice(4)}\nRealized (${win}d): ${d.rv.toFixed(1)}%` })),
            ],
          })
        }
      />
      <p className="mt-2 text-[0.82rem] text-(--sl-color-gray-2)">
        At the snapshot, options implied <b>{(atmIv * 100).toFixed(1)}%</b> while SPY had realized <b>{lastRv.toFixed(1)}%</b> over the last {win} days.
      </p>
      <div className="mt-1 flex flex-wrap gap-x-5 text-[0.78rem] text-(--sl-color-gray-3)">
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" style={{ stroke: 'var(--viz-call)' }} strokeWidth="2" /></svg> Realized volatility (rolling {win}-day)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" style={{ stroke: 'var(--viz-put)' }} strokeWidth="2" strokeDasharray="6 4" /></svg> Implied volatility, 770 strike, Nov 27 expiry
        </span>
      </div>
    </div>
  );
}
