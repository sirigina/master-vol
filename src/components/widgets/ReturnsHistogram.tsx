import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from './PlotFigure';
import { Segmented } from '../ui/Segmented';
import { closes, dates } from '../../lib/snapshot';
import { logReturns, stdev, normPdf, TRADING_DAYS } from '../../lib/pricing';

const BIN = 0.25; // percent

export default function ReturnsHistogram() {
  const [showNormal, setShowNormal] = useState<'on' | 'off'>('on');
  const r = useMemo(() => logReturns(closes).map((x) => x * 100), []);
  const sd = stdev(r);
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const beyond2 = r.filter((x) => Math.abs(x - mean) > 2 * sd).length;
  const expected2 = r.length * 0.0455;
  const rows = r.map((v, i) => ({ v, date: dates[i + 1] }));

  const curve = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let x = -3.5; x <= 3.5; x += 0.05) out.push({ x, y: (normPdf((x - mean) / sd) / sd) * r.length * BIN });
    return out;
  }, []);

  return (
    <div className="viz-card not-content">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[0.95rem] font-semibold text-(--sl-color-white)">SPY daily moves, past 12 months</div>
        <Segmented
          label="Normal curve"
          value={showNormal}
          onChange={setShowNormal}
          options={[
            { value: 'on', label: 'Normal curve on' },
            { value: 'off', label: 'Off' },
          ]}
        />
      </div>
      <PlotFigure
        deps={[showNormal]}
        minHeight={300}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 300,
            clip: true,
            marginLeft: 44,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Daily change (%)', domain: [-3.25, 3.25], tickFormat: (d: number) => `${d > 0 ? '+' : ''}${d}%` },
            y: { label: 'Days', grid: true },
            marks: [
              Plot.rectY(
                rows,
                Plot.binX(
                  { y: 'count' },
                  {
                    x: 'v',
                    thresholds: Array.from({ length: 29 }, (_, i) => -3.5 + i * BIN),
                    // @ts-expect-error Plot's binX typing omits mark style options it accepts
                    fill: t.call,
                    inset: 1,
                    rx: 2,
                    tip: { format: { x: (d: number) => `${d.toFixed(2)}%` } },
                  },
                ),
              ),
              showNormal === 'on' ? Plot.line(curve, { x: 'x', y: 'y', stroke: t.put, strokeWidth: 2 }) : null,
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.ruleX([mean - sd, mean + sd], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.text([mean + sd], { x: (d: number) => d, frameAnchor: 'top', dy: 6, dx: 4, textAnchor: 'start', text: () => '+1 SD', fill: t.muted }),
              Plot.text([mean - sd], { x: (d: number) => d, frameAnchor: 'top', dy: 6, dx: -4, textAnchor: 'end', text: () => '−1 SD', fill: t.muted }),
            ],
          })
        }
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Typical day (1 SD)', `±${sd.toFixed(2)}%`],
          ['Annualized volatility', `${(sd * Math.sqrt(TRADING_DAYS)).toFixed(1)}%`],
          ['Days beyond ±2 SD', `${beyond2}`],
          ['A normal curve predicts', `≈ ${expected2.toFixed(0)}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
            <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">{k}</div>
            <div className="text-[0.95rem] font-semibold tabular-nums text-(--sl-color-white)">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 text-[0.78rem] text-(--sl-color-gray-3)">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--viz-call)' }} /> Actual days ({r.length})
        </span>
        {showNormal === 'on' && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" style={{ stroke: 'var(--viz-put)' }} strokeWidth="2" /></svg> Normal curve, same volatility
          </span>
        )}
      </div>
    </div>
  );
}
