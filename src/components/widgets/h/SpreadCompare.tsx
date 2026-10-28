import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { atmIv } from '../../../lib/snapshot';
import { SPREADS, spreadCost, spreadModel, breakevenVol, maxLoss, simulate, payoffAt, distStats, type VolMode } from './spreads';
import { sgn0, usd0 } from './hlib';

const COLORS = ['call', 'aqua', 'stock'] as const;

/** H1: three spreads side by side at a forecast volatility, with simulated expiry P/L. */
export default function SpreadCompare() {
  const t = useTokens();
  const [vol, setVol] = useState(16);
  const [mode, setMode] = useState<VolMode>('flat');
  const f = vol / 100;

  const rows = useMemo(
    () =>
      SPREADS.map((s, i) => {
        const m = spreadModel(s, f, mode);
        const ST = simulate(f);
        const pl = ST.map((x) => payoffAt(s, x) * 100);
        return { s, i, m, cost: spreadCost(s) * 100, ml: maxLoss(s), be: breakevenVol(s, mode), d: distStats(pl), pl };
      }),
    [f, mode],
  );

  const hist = rows.flatMap((r) => r.pl.map((v) => ({ v: Math.max(-3000, Math.min(6000, v)), name: r.s.short })));

  const metric = (label: string, fn: (r: (typeof rows)[0]) => string, hint?: string) => (
    <tr className="border-t border-(--sl-color-hairline)">
      <th scope="row" className="py-1.5 pr-2 text-left font-normal text-(--sl-color-gray-3)">
        {label}
        {hint && <div className="text-[0.7rem] leading-tight">{hint}</div>}
      </th>
      {rows.map((r) => (
        <td key={r.s.id} className="py-1.5 pl-2 text-right font-semibold tabular-nums text-(--sl-color-white)">
          {fn(r)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Three ways to buy volatility, side by side"
        sub="Nov 27 SPY options at the snapshot marks, one contract each. Edge = model value at your forecast minus cost."
      />
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <Slider
          label="Your volatility forecast"
          value={vol}
          min={8}
          max={26}
          step={0.5}
          onChange={setVol}
          format={(v) => `${v.toFixed(1)}%${Math.abs(v - atmIv * 100) < 0.3 ? ' (≈ market ATM)' : ''}`}
        />
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">How the forecast applies across strikes</div>
          <Segmented
            label="Vol mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'flat', label: 'One vol, every strike' },
              { value: 'skew', label: 'Shift the market smile' },
            ]}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[0.74rem] sm:text-[0.82rem]">
          <thead>
            <tr>
              <th />
              {rows.map((r) => (
                <th key={r.s.id} className="pb-1 pl-2 text-right text-[0.8rem] font-semibold" style={{ color: t[COLORS[r.i]] }}>
                  {r.s.short}
                  <div className="hidden text-[0.7rem] font-normal text-(--sl-color-gray-3) sm:block">{r.s.label.replace(/^Long /, '').replace('1×2 call backspread ', '1×2 calls ')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metric('Cost', (r) => (r.cost >= 0 ? `${usd0(r.cost)} debit` : `${usd0(-r.cost)} credit`))}
            {metric('Edge', (r) => sgn0(r.m.edge * 100), 'at your forecast')}
            {metric('Max loss', (r) => usd0(r.ml), 'at expiry')}
            {metric('Vega', (r) => sgn0(r.m.vega * 100), '$ per vol pt')}
            {metric('Gamma', (r) => (r.m.gamma * 100).toFixed(2), 'shares per $1')}
            {metric('Theta', (r) => sgn0(r.m.theta * 100), '$ per day')}
            {metric('Edge ÷ vega', (r) => `${(r.m.edge / r.m.vega).toFixed(1)} pts`, 'forecast room')}
            {metric('Breakeven vol', (r) => (isNaN(r.be) ? 'none' : `${(r.be * 100).toFixed(1)}%`))}
            {metric('Edge ÷ max loss', (r) => `${((r.m.edge * 100) / -r.ml * 100).toFixed(0)}%`)}
          </tbody>
        </table>
      </div>

      <div className="mt-5 text-[0.85rem] font-semibold text-(--sl-color-white)">P/L at expiry if SPY realizes {vol.toFixed(1)}% (20,000 lognormal paths)</div>
      <PlotFigure
        deps={[f, mode]}
        minHeight={330}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 330,
            marginLeft: 44,
            marginRight: width < 520 ? 8 : 80,
            marginBottom: 36,
            style: plotStyle(tk),
            fy: { label: null, domain: SPREADS.map((s) => s.short), axis: width < 520 ? null : 'right' },
            x: { label: 'P/L per contract at expiry ($), clipped at −3,000 and +6,000', domain: [-3000, 6000], tickFormat: (d: number) => `${d < 0 ? '−' : ''}${Math.abs(d / 1000)}k` },
            y: { label: '% of paths', grid: true, tickFormat: (d: number) => `${d}` },
            color: { domain: SPREADS.map((s) => s.short), range: COLORS.map((c) => tk[c]) },
            marks: [
              Plot.rectY(
                hist,
                Plot.binX({ y: (d: unknown[]) => (d.length / 20000) * 100 }, { x: 'v', fy: 'name', fill: 'name', thresholds: Array.from({ length: 46 }, (_, i) => -3000 + i * 200), inset: 0.5 } as Plot.RectYOptions & Plot.BinXInputs<Plot.RectYOptions>),
              ),
              Plot.ruleX([0], { stroke: tk.axis }),
              Plot.ruleY([0], { stroke: tk.axis }),
              width < 520 ? Plot.text(SPREADS.map((s) => s.short), { fy: (d: string) => d, frameAnchor: 'top-right', text: (d: string) => d, dy: 4, fill: tk['ink-2'], fontWeight: 600 }) : null,
            ],
          })
        }
      />
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[0.72rem] sm:text-[0.8rem]">
          <thead>
            <tr className="text-(--sl-color-gray-3)">
              <th className="text-left font-medium">Simulated</th>
              <th className="text-right font-medium">Avg</th>
              <th className="text-right font-medium">Win %</th>
              <th className="text-right font-medium">Worst 5%</th>
              <th className="hidden text-right font-medium sm:table-cell">Median</th>
              <th className="text-right font-medium">Best 5%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.s.id} className="border-t border-(--sl-color-hairline) tabular-nums">
                <td className="py-1 font-semibold" style={{ color: t[COLORS[r.i]] }}>
                  {r.s.short}
                </td>
                <td className="text-right">{sgn0(r.d.mean)}</td>
                <td className="text-right">{(r.d.pWin * 100).toFixed(0)}%</td>
                <td className="text-right">{sgn0(r.d.p5)}</td>
                <td className="hidden text-right sm:table-cell">{sgn0(r.d.p50)}</td>
                <td className="text-right">{sgn0(r.d.p95)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend items={SPREADS.map((s, i) => ({ label: s.label, color: t[COLORS[i]], kind: 'box' as const }))} />
      <p className="mt-2 text-[0.75rem] text-(--sl-color-gray-3)">
        Illustration: the simulation draws SPY from one lognormal distribution at your forecast (the one-vol world), so its average tracks the
        one-vol edge. Real markets have fat tails. Edge and Greeks use your forecast; cost uses the real marks.
      </p>
    </div>
  );
}
