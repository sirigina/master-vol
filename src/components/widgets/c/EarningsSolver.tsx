import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { fmt } from '../../../lib/snapshot';
import { msft, msftIv, eventMove, fitEarnings } from './volmath';

const FIT = fitEarnings();
const label = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const rows = msft.expiries.map((e) => ({
  ...e,
  iv: msftIv(e),
  label: label(e.expiry),
  // total variance in "percent squared": iv² × days/365 × 10⁴
  w: msftIv(e) ** 2 * (e.dte / 365) * 1e4,
}));

/** MSFT: implied move from straddles, and the one-day earnings move that explains the term structure. */
export default function EarningsSolver() {
  const t = useTokens();
  const [nv, setNv] = useState(25);
  const sn = nv / 100;
  const front = rows[0];
  const moves = rows.map((r) => eventMove(r.iv, r.dte, sn));
  const m0 = moves[0];
  const line = [0, 55].map((d) => ({ d, w: (m0 * m0 + (sn * sn * Math.max(d - 1, 0)) / 365) * 1e4 }));

  return (
    <div className="viz-card not-content">
      <CardHead
        title={`MSFT before earnings (${msft.spot}, reports ${label(msft.reportDate)} after the close)`}
        sub="Each expiry's total variance = ordinary days × normal-day variance + one earnings day. Choose the normal-day vol; the event move falls out."
      />
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((r, i) => (
          <div key={r.expiry} className="rounded-lg border border-(--sl-color-hairline) px-3 py-2 text-[0.8rem]">
            <div className="font-semibold text-(--sl-color-white)">
              {r.label} <span className="font-normal text-(--sl-color-gray-3)">({r.dte}d)</span>
            </div>
            <div className="tabular-nums">
              IV <b>{(r.iv * 100).toFixed(1)}%</b>
            </div>
            <div className="tabular-nums text-(--sl-color-gray-2)">
              530 straddle {fmt.usd(r.straddle)} <span className="text-(--sl-color-gray-3)">({((r.straddle / msft.spot) * 100).toFixed(1)}%)</span>
            </div>
            <div className="tabular-nums text-(--sl-color-gray-2)">
              event move {Number.isFinite(moves[i]) ? `±${(moves[i] * 100).toFixed(2)}%` : 'n/a'}
            </div>
          </div>
        ))}
      </div>
      <Slider
        label="Normal-day volatility (no earnings)"
        value={nv}
        min={10}
        max={60}
        step={0.5}
        onChange={setNv}
        format={(v) => `${v.toFixed(1)}%${Math.abs(v - FIT.normalVol * 100) < 0.3 ? ' (best fit)' : ''}`}
      />
      <PlotFigure
        deps={[nv]}
        minHeight={260}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 260,
            marginLeft: 48,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'Calendar days to expiry', domain: [0, 55], grid: true },
            y: { label: 'Total variance (%²)', domain: [0, 150], grid: true },
            marks: [
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.line(line, { x: 'd', y: 'w', stroke: tk.put, strokeWidth: 2, strokeDasharray: '6 4' }),
              Plot.ruleX([0], { y1: 0, y2: m0 * m0 * 1e4, stroke: tk.put, strokeWidth: 5 }),
              Plot.text([0], { x: 0, y: m0 * m0 * 1e4 * 0.45, dx: 8, textAnchor: 'start', text: () => `earnings day: ±${(m0 * 100).toFixed(1)}%`, fill: tk.put, fontWeight: 600, stroke: tk.surface, strokeWidth: 3, paintOrder: 'stroke' }),
              Plot.dot(rows, { x: 'dte', y: 'w', r: 6, fill: tk.call, stroke: tk.surface, strokeWidth: 2 }),
              Plot.text(rows, { x: 'dte', y: 'w', dy: -12, text: 'label', fill: tk['ink-2'] }),
              Plot.tip(rows, Plot.pointer({ x: 'dte', y: 'w', title: (d: (typeof rows)[0]) => `${d.label}: IV ${(d.iv * 100).toFixed(1)}% × ${d.dte} days\nTotal variance ${d.w.toFixed(1)} (%²)\n= SD ${Math.sqrt(d.w).toFixed(2)}% to expiry` })),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Market: IV² × days (each expiry)', color: t.call, kind: 'dot' },
          { label: 'Model: earnings day + normal days', color: t.put, kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          ['Front straddle', fmt.usd(front.straddle), `${((front.straddle / msft.spot) * 100).toFixed(2)}% of spot, the "implied move"`],
          ['Earnings-day SD', Number.isFinite(m0) ? `±${(m0 * 100).toFixed(2)}%` : 'n/a', Number.isFinite(m0) ? `±${fmt.usd(m0 * msft.spot)}` : ''],
          ['Expected size of move', Number.isFinite(m0) ? `${(m0 * 0.7979 * 100).toFixed(2)}%` : 'n/a', '0.8 × SD, compare with the straddle'],
          ['Best fit, all four expiries', `±${(FIT.move * 100).toFixed(2)}%`, `with normal-day vol ${(FIT.normalVol * 100).toFixed(1)}%`],
        ]}
      />
    </div>
  );
}
