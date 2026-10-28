import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { fmt } from '../../../lib/snapshot';
import { IV, finePath, runHedge, usd0 } from './hedgeSim';
import { RULES } from './rules';

const N = 200;
type Rv = '12' | 'iv' | '16';

/**
 * E3: final P/L of a hedged long 770 straddle across 200 seeded paths, for
 * four hedging rules, with a transaction cost per share traded.
 */
export default function HedgeRuleDistribution() {
  const t = useTokens();
  const [rv, setRv] = useState<Rv>('iv');
  const [cents, setCents] = useState(5);
  const sigma = rv === 'iv' ? IV : +rv / 100;

  // Gross P/L and shares traded don't depend on the cost, so simulate once per volatility.
  const gross = useMemo(() => {
    const paths = Array.from({ length: N }, (_, i) => finePath(i + 1, sigma));
    return RULES.map((r) => paths.map((p) => runHedge(p, 1, r.rule)).map((x) => ({ pnl: x.final, shares: x.sharesTraded, trades: x.trades.length })));
  }, [sigma]);

  const c = cents / 100;
  const rows = RULES.flatMap((r, ri) => gross[ri].map((g) => ({ rule: r.short, pnl: g.pnl - g.shares * c })));
  const stats = RULES.map((r, ri) => {
    const xs = gross[ri].map((g) => g.pnl - g.shares * c);
    const mean = xs.reduce((a, b) => a + b, 0) / N;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (N - 1));
    const sorted = [...xs].sort((a, b) => a - b);
    const shares = gross[ri].reduce((a, g) => a + g.shares, 0) / N;
    const trades = gross[ri].reduce((a, g) => a + g.trades, 0) / N;
    return { ...r, mean, sd, p5: sorted[Math.floor(0.05 * N)], shares, trades, cost: shares * c };
  });
  const lo = Math.min(...rows.map((d) => d.pnl));
  const hi = Math.max(...rows.map((d) => d.pnl));
  const ext = Math.max(Math.abs(lo), Math.abs(hi));
  const thresholds = Array.from({ length: 41 }, (_, i) => -ext + (i * 2 * ext) / 40);

  return (
    <div className="viz-card not-content">
      <CardHead title="Same trade, four hedging rules, 200 paths" sub={`Illustration: long 10 Nov 27 770 straddles at ${fmt.pct(IV, 2)} implied; final P/L after hedging costs`} />
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Volatility SPY delivers</div>
          <Segmented
            label="Realized volatility"
            value={rv}
            onChange={setRv}
            options={[
              { value: '12', label: '12%' },
              { value: 'iv', label: `${(IV * 100).toFixed(2)}% (= implied)` },
              { value: '16', label: '16%' },
            ]}
          />
        </div>
        <Slider label="Cost per share traded" value={cents} min={0} max={50} step={0.5} onChange={setCents} format={(v) => `${v.toFixed(1)}¢`} />
      </div>
      <div className="mt-3">
        <PlotFigure
          deps={[rv, cents]}
          minHeight={400}
          build={(width, tk) =>
            Plot.plot({
              width,
              height: 400,
              marginLeft: width < 520 ? 12 : 92,
              marginRight: 8,
              marginBottom: 36,
              style: plotStyle(tk),
              x: { label: 'Final P/L, $', domain: [-ext, ext], tickFormat: (d: number) => (d === 0 ? '0' : `${d < 0 ? '−' : ''}${Math.abs(d / 1000)}k`) },
              y: { axis: null },
              fy: { domain: RULES.map((r) => r.short), label: null, axis: width < 520 ? null : 'left', padding: 0.18 },
              marks: [
                // fy is a valid mark option at runtime; Plot's BinXInputs type omits it
                Plot.rectY(rows, Plot.binX({ y: 'count' }, { x: 'pnl', fy: 'rule', thresholds, fill: tk.call, inset: 0.5, tip: true } as Plot.BinXInputs<Plot.RectYOptions>)),
                Plot.ruleX([0], { stroke: tk.axis }),
                Plot.ruleX(stats, { x: 'mean', fy: 'short', stroke: tk.put, strokeWidth: 2 }),
                Plot.frame({ anchor: 'bottom', stroke: tk.grid }),
                width < 520 ? Plot.text(stats, { fy: 'short', frameAnchor: 'top-left', dy: 2, text: 'short', fill: tk['ink-2'], fontWeight: 600 }) : null,
                Plot.text(stats, {
                  fy: 'short',
                  frameAnchor: 'top-right',
                  dy: 2,
                  text: (s: { sd: number }) => `SD ${usd0(s.sd).replace('+', '')}`,
                  fill: tk['ink-2'],
                }),
              ],
            })
          }
        />
      </div>
      <Legend
        items={[
          { label: `Paths (${N} per rule)`, color: t.call, kind: 'box' },
          { label: 'Average P/L after costs', color: t.put },
        ]}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[0.8rem] tabular-nums" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              {['Rule', 'Average P/L', 'Std dev', 'Worst 5%', 'Hedge trades', 'Shares', 'Cost'].map((h, i) => (
                <th key={h} className={`whitespace-nowrap border-b border-(--sl-color-hairline) px-2 py-1 font-medium ${i === 3 || i === 4 ? 'hidden sm:table-cell' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap px-2 py-1">
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.short}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-1">{usd0(s.mean)}</td>
                <td className="whitespace-nowrap px-2 py-1">{usd0(s.sd).replace('+', '')}</td>
                <td className="hidden whitespace-nowrap px-2 py-1 sm:table-cell">{usd0(s.p5)}</td>
                <td className="hidden whitespace-nowrap px-2 py-1 sm:table-cell">{s.trades.toFixed(0)}</td>
                <td className="whitespace-nowrap px-2 py-1">{Math.round(s.shares).toLocaleString('en-US')}</td>
                <td className="whitespace-nowrap px-2 py-1">{usd0(-s.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Averages over {N} seeded paths. SPY trades with a one-cent spread, so half a cent per share is a realistic cost for a liquid hedge; the
        higher settings stand in for slippage and wider markets. Zero rates, options marked at the entry implied vol.
      </p>
    </div>
  );
}
