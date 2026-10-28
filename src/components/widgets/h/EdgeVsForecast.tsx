import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { atmIv } from '../../../lib/snapshot';
import { SPREADS, spreadModel, maxLoss, type VolMode } from './spreads';

const COLORS = ['call', 'aqua', 'stock'] as const;

/** H1: edge as a function of the forecast, per contract or per $ of max loss. */
export default function EdgeVsForecast() {
  const t = useTokens();
  const [mode, setMode] = useState<VolMode>('flat');
  const [scale, setScale] = useState<'contract' | 'risk'>('contract');

  const data = useMemo(() => {
    const out: { v: number; edge: number; name: string }[] = [];
    for (const s of SPREADS) {
      const ml = -maxLoss(s);
      for (let v = 6; v <= 26.001; v += 0.25) {
        const e = spreadModel(s, v / 100, mode).edge * 100;
        out.push({ v, edge: scale === 'contract' ? e : (e / ml) * 100, name: s.short });
      }
    }
    return out;
  }, [mode, scale]);

  /** Which spread has the most edge at each forecast. */
  const winners = useMemo(() => {
    const byV = new Map<number, { edge: number; name: string }>();
    for (const d of data) {
      const cur = byV.get(d.v);
      if (!cur || d.edge > cur.edge) byV.set(d.v, d);
    }
    const segs: { from: number; to: number; name: string }[] = [];
    for (const [v, w0] of byV) {
      const w = w0.edge > 0 ? w0 : { edge: w0.edge, name: 'None' };
      const last = segs[segs.length - 1];
      if (last && last.name === w.name) last.to = v;
      else segs.push({ from: v, to: v, name: w.name });
    }
    return segs;
  }, [data]);

  const unit = scale === 'contract' ? '$ per contract' : '% of max loss';

  return (
    <div className="viz-card not-content">
      <CardHead title="Where each spread wins" sub="Edge at the snapshot prices as your volatility forecast changes" />
      <div className="flex flex-wrap gap-3">
        <Segmented
          label="Vol mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'flat', label: 'One vol' },
            { value: 'skew', label: 'Shift the smile' },
          ]}
        />
        <Segmented
          label="Scale"
          value={scale}
          onChange={setScale}
          options={[
            { value: 'contract', label: 'Per contract' },
            { value: 'risk', label: 'Per $ at risk' },
          ]}
        />
      </div>
      <PlotFigure
        deps={[data]}
        minHeight={320}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 320,
            marginLeft: 56,
            marginBottom: 38,
            style: plotStyle(tk),
            x: { label: 'Forecast volatility (%)', domain: [6, 26] },
            y: { label: `Edge (${unit})`, grid: true, tickFormat: (d: number) => (scale === 'contract' ? `${d < 0 ? '−' : ''}$${Math.abs(d).toLocaleString()}` : `${d}%`) },
            color: { domain: SPREADS.map((s) => s.short), range: COLORS.map((c) => tk[c]) },
            marks: [
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.ruleX([atmIv * 100], { stroke: tk.muted, strokeDasharray: '3 3' }),
              Plot.text([atmIv * 100], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => `market ATM ${(atmIv * 100).toFixed(1)}%`, fill: tk.muted }),
              Plot.line(data, { x: 'v', y: 'edge', stroke: 'name', strokeWidth: 2.25 }),
              Plot.tip(
                data,
                Plot.pointerX({
                  x: 'v',
                  y: 'edge',
                  stroke: 'name',
                  title: (d: { v: number; edge: number; name: string }) =>
                    `${d.name} at ${d.v.toFixed(2)}%\nEdge ${scale === 'contract' ? `${d.edge < 0 ? '−' : '+'}$${Math.abs(Math.round(d.edge)).toLocaleString()}` : `${d.edge.toFixed(0)}% of max loss`}`,
                }),
              ),
            ],
          })
        }
      />
      <div className="mt-2 flex flex-wrap gap-1.5 text-[0.75rem]">
        <span className="text-(--sl-color-gray-3)">Most edge at each forecast:</span>
        {winners.map((w) => (
          <span
            key={w.from}
            className="rounded px-1.5 py-0.5 tabular-nums"
            style={{ background: 'var(--sl-color-gray-6)', color: w.name === 'None' ? t.muted : t[COLORS[SPREADS.findIndex((s) => s.short === w.name)]] }}
          >
            {w.from.toFixed(2).replace(/0$/, '')}–{w.to.toFixed(2).replace(/0$/, '')}%: <b>{w.name === 'None' ? 'none has positive edge' : w.name}</b>
          </span>
        ))}
      </div>
      <Legend items={SPREADS.map((s, i) => ({ label: s.label, color: t[COLORS[i]] }))} />
    </div>
  );
}
