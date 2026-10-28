import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { forwardVol } from './volmath';

const ts = snapshot.termStructure;
const label = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: iso.startsWith('2027') ? '2-digit' : undefined });
const rows = ts.map((p) => ({ ...p, iv: p.atmIv * 100, label: label(p.expiry) }));

/** SPY ATM implied vol by days to expiry, plus a forward-vol calculator between any two expiries. */
export default function TermStructure() {
  const t = useTokens();
  const [a, setA] = useState('3');
  const [b, setB] = useState('4');
  const i1 = Math.min(+a, +b);
  const i2 = Math.max(+a, +b);
  const p1 = ts[i1];
  const p2 = ts[i2];
  const same = i1 === i2;
  const fwd = same ? NaN : forwardVol(p1.atmIv, p1.dte, p2.atmIv, p2.dte) * 100;
  const v1 = p1.atmIv ** 2 * p1.dte;
  const v2 = p2.atmIv ** 2 * p2.dte;
  const opts = ts.map((p, i) => ({ value: String(i), label: label(p.expiry) }));

  return (
    <div className="viz-card not-content">
      <CardHead title="SPY term structure and forward volatility" sub="At-the-money implied vol (770 strike) for nine expiries. Pick two to see the volatility priced for the gap between them." />
      <PlotFigure
        deps={[i1, i2]}
        minHeight={280}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 280,
            marginLeft: 40,
            marginRight: 16,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'Calendar days to expiry', domain: [0, 430], grid: true },
            y: { label: 'ATM implied vol (%)', domain: [12, 20], grid: true },
            marks: [
              same
                ? null
                : Plot.rect([{ x1: p1.dte, x2: p2.dte }], { x1: 'x1', x2: 'x2', y1: 12, y2: 20, fill: tk['band-2'] }),
              same ? null : Plot.ruleY([fwd], { x1: p1.dte, x2: p2.dte, stroke: tk.put, strokeWidth: 2.5, strokeDasharray: '6 3' }),
              same
                ? null
                : Plot.text([{ x: p2.dte < 300 ? p1.dte : p2.dte }], {
                    x: 'x',
                    frameAnchor: 'top',
                    dy: 8,
                    dx: p2.dte < 300 ? 2 : -2,
                    textAnchor: p2.dte < 300 ? 'start' : 'end',
                    text: () => `forward ${Number.isFinite(fwd) ? fwd.toFixed(1) + '%' : 'n/a'}`,
                    fill: tk.put,
                    fontWeight: 600,
                    stroke: tk.surface,
                    strokeWidth: 3,
                    paintOrder: 'stroke',
                  }),
              Plot.line(rows, { x: 'dte', y: 'iv', stroke: tk.call, strokeWidth: 2 }),
              Plot.dot(rows, {
                x: 'dte',
                y: 'iv',
                r: (_: unknown, i: number) => (i === i1 || i === i2 ? 6 : 4),
                fill: (_: unknown, i: number) => (i === i1 || i === i2 ? tk.put : tk.call),
                stroke: tk.surface,
                strokeWidth: 2,
              }),
              Plot.tip(rows, Plot.pointer({ x: 'dte', y: 'iv', title: (d: (typeof rows)[0]) => `${d.label} (${d.dte} days)\nATM IV ${d.iv.toFixed(2)}%\nStraddle ${d.straddle.toFixed(2)}` })),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'ATM implied vol by expiry', color: t.call },
          { label: 'Forward vol between the two picks', color: t.put, kind: 'dash' },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[
          ['Near expiry', a, setA],
          ['Far expiry', b, setB],
        ].map(([lbl, val, set]) => (
          <label key={lbl as string} className="block text-[0.8rem] text-(--sl-color-gray-3)">
            {lbl as string}
            <select
              value={val as string}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
              className="mt-1 block w-full cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-2 py-1.5 text-[0.85rem] text-(--sl-color-white)"
            >
              {opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} · {ts[+o.value].dte}d
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <StatGrid
        items={[
          [`${label(p1.expiry)} (${p1.dte}d)`, `${(p1.atmIv * 100).toFixed(2)}%`, `variance × days ${(v1 * 1e4).toFixed(0)}`],
          [`${label(p2.expiry)} (${p2.dte}d)`, `${(p2.atmIv * 100).toFixed(2)}%`, `variance × days ${(v2 * 1e4).toFixed(0)}`],
          ['Forward vol', same ? 'pick two' : Number.isFinite(fwd) ? `${fwd.toFixed(2)}%` : 'negative variance', same ? '' : `${label(p1.expiry)} → ${label(p2.expiry)}`, t.put],
          ['Days in the gap', same ? '–' : `${p2.dte - p1.dte}`, 'calendar days'],
        ]}
      />
    </div>
  );
}
