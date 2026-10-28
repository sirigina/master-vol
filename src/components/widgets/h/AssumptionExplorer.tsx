import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot, closes, dates, vixDates, vixValues, atmIv } from '../../../lib/snapshot';
import { logReturns, stdev, rollingVol, TRADING_DAYS } from '../../../lib/pricing';
import type { Tokens } from '../../../lib/useViz';

type A = 'gaps' | 'vol' | 'tails' | 'smile' | 'costs' | 'carry';

const R = logReturns(closes).map((x) => x * 100);
const SD = stdev(R);
const MU = R.reduce((a, b) => a + b, 0) / R.length;

/** Inverse normal CDF (Acklam). */
function invN(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155211239];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) return -invN(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

const INFO: Record<A, { tab: string; assumption: string; evidence: string; patch: string }> = {
  gaps: {
    tab: 'Gaps',
    assumption: 'Prices move continuously, so a hedge can be adjusted before any big change.',
    evidence: 'SPY moved more than 2 standard deviations on 16 of 256 days, and 3 of those were beyond 3. A hedge rebalanced once a day cannot follow moves that size, and the ones that open with a gap cannot be traded through at all.',
    patch: 'Desks hold gap limits: the loss from an instant ±5% or ±10% move, with no rehedge, must fit inside a cap.',
  },
  vol: {
    tab: 'Constant vol',
    assumption: 'Volatility is a single constant for the life of the option.',
    evidence: '20-day realized vol ranged from 7.0% to 20.7% in one year; VIX ranged from 13.47 to 31.05. High-vol days arrive in clusters (March, June), not evenly.',
    patch: 'Traders re-mark implied vol every day, track vega by expiry, and stress-test vol shocks of 5–10 points.',
  },
  tails: {
    tab: 'Fat tails',
    assumption: 'Log returns are normally distributed (prices are lognormal).',
    evidence: 'On a quantile plot a normal sample lies on the line. SPY’s extreme days peel away at both ends: the worst day was −3.3 SD and the best +3.5 SD, where 256 normal days would rarely exceed ±3.',
    patch: 'Instead of changing the model, the market changes the input: a different implied vol for each strike.',
  },
  smile: {
    tab: 'Skew',
    assumption: 'One volatility prices every strike of the same expiry.',
    evidence: 'Nov 27 IVs run from 32.1% at the 650 put down to 11.8% at the 800–820 calls. A single number cannot match them all.',
    patch: 'Desks fit a volatility surface (strike × expiry) and quote every option off it (lesson C8).',
  },
  costs: {
    tab: 'Costs',
    assumption: 'Trading is free and you can buy and sell at one price.',
    evidence: 'At-the-money SPY options are tight (the 770 straddle is 12 cents wide), but spreads widen to 3–8% of the price in the far call wing and in the in-the-money strikes.',
    patch: 'Edge is measured after crossing the spread, and hedging frequency is chosen to balance cost against gamma risk.',
  },
  carry: {
    tab: 'Rates & dividends',
    assumption: 'The interest rate and dividends are known and constant.',
    evidence: 'From December on, the vendor’s put IV exceeds the call IV at the same strike by 0.6–1.0 points: its model leaves out SPY’s dividend, so the gap is the missing carry showing up as “volatility”.',
    patch: 'Desks back the forward out of put-call parity for each expiry, so rates and dividends are implied, not assumed (lesson F2).',
  },
};

function build(a: A, width: number, t: Tokens) {
  const base = { width, style: plotStyle(t), marginLeft: 48, marginBottom: 36 };
  if (a === 'gaps') {
    const rows = R.map((v, i) => ({ date: dates[i + 1], v, z: (v - MU) / SD }));
    return Plot.plot({
      ...base,
      height: 280,
      x: { label: null },
      y: { label: 'Daily change (%)', grid: true },
      marks: [
        Plot.rect([{ lo: MU - 2 * SD, hi: MU + 2 * SD }], { x1: rows[0].date, x2: rows[rows.length - 1].date, y1: 'lo', y2: 'hi', fill: t['band-2'] }),
        Plot.ruleY([0], { stroke: t.axis }),
        Plot.ruleX(rows, { x: 'date', y: 'v', stroke: (d: { z: number }) => (Math.abs(d.z) > 2 ? t.put : t.muted), strokeWidth: (d: { z: number }) => (Math.abs(d.z) > 2 ? 2 : 1) }),
        Plot.tip(rows, Plot.pointerX({ x: 'date', y: 'v', title: (d: { date: Date; v: number; z: number }) => `${d.date.toDateString().slice(4)}\n${d.v > 0 ? '+' : ''}${d.v.toFixed(2)}% (${d.z > 0 ? '+' : ''}${d.z.toFixed(1)} SD)` })),
      ],
    });
  }
  if (a === 'vol') {
    const rv = rollingVol(closes, 20)
      .map((v, i) => ({ date: dates[i], v: v === null ? null : v * 100, s: 'Realized 20-day' }))
      .filter((d) => d.v !== null);
    const vx = vixValues.map((v, i) => ({ date: vixDates[i], v, s: 'VIX' }));
    const all = [...rv, ...vx];
    return Plot.plot({
      ...base,
      height: 280,
      x: { label: null },
      y: { label: 'Annualized vol (%)', grid: true, domain: [0, 34] },
      color: { domain: ['Realized 20-day', 'VIX', 'Constant (model)'], range: [t.call, t.put, t.muted] },
      marks: [
        Plot.ruleY([atmIv * 100], { stroke: t.muted, strokeDasharray: '5 4' }),
        Plot.line(all, { x: 'date', y: 'v', stroke: 's', strokeWidth: 1.75 }),
        Plot.tip(all, Plot.pointerX({ x: 'date', y: 'v', stroke: 's', title: (d: { date: Date; v: number; s: string }) => `${d.date.toDateString().slice(4)}\n${d.s}: ${d.v.toFixed(1)}` })),
      ],
    });
  }
  if (a === 'tails') {
    const s = [...R].sort((x, y) => x - y);
    const n = s.length;
    const pts = s.map((v, i) => ({ th: invN((i + 0.5) / n), z: (v - MU) / SD }));
    return Plot.plot({
      ...base,
      height: 300,
      x: { label: 'Normal quantile (SD)', domain: [-4, 4] },
      y: { label: 'SPY daily move (SD)', grid: true, domain: [-4, 4] },
      marks: [
        Plot.line([{ x: -4, y: -4 }, { x: 4, y: 4 }], { x: 'x', y: 'y', stroke: t.muted, strokeDasharray: '5 4' }),
        Plot.dot(pts, { x: 'th', y: 'z', r: 2.6, fill: (d: { th: number; z: number }) => (Math.abs(d.z) > 2.5 ? t.put : t.call) }),
        Plot.tip(pts, Plot.pointer({ x: 'th', y: 'z', title: (d: { th: number; z: number }) => `Normal predicts ${d.th.toFixed(2)} SD\nSPY had ${d.z.toFixed(2)} SD` })),
      ],
    });
  }
  if (a === 'smile') {
    const rows = [
      ...snapshot.chain.puts.filter((p) => p.strike <= snapshot.spot).map((p) => ({ k: p.strike, iv: p.iv * 100, s: 'OTM puts' })),
      ...snapshot.chain.calls.filter((c) => c.strike >= snapshot.spot).map((c) => ({ k: c.strike, iv: c.iv * 100, s: 'OTM calls' })),
    ];
    return Plot.plot({
      ...base,
      height: 280,
      x: { label: 'Strike (Nov 27)', domain: [640, 850] },
      y: { label: 'Implied vol (%)', grid: true, domain: [0, 35] },
      color: { domain: ['OTM puts', 'OTM calls'], range: [t.put, t.call] },
      marks: [
        Plot.ruleY([atmIv * 100], { stroke: t.muted, strokeDasharray: '5 4' }),
        Plot.text([atmIv * 100], { y: (d: number) => d, x: 645, dy: 12, textAnchor: 'start', text: () => `Black-Scholes: one vol (${(atmIv * 100).toFixed(1)}%)`, fill: t.muted }),
        Plot.ruleX([snapshot.spot], { stroke: t.axis }),
        Plot.line(rows, { x: 'k', y: 'iv', stroke: 's', strokeWidth: 2, curve: 'monotone-x' }),
        Plot.dot(rows, { x: 'k', y: 'iv', fill: 's', r: 4, stroke: t.surface, strokeWidth: 1.5 }),
        Plot.tip(rows, Plot.pointer({ x: 'k', y: 'iv', title: (d: { k: number; iv: number; s: string }) => `${d.k} ${d.s === 'OTM puts' ? 'put' : 'call'}\nIV ${d.iv.toFixed(1)}%` })),
      ],
    });
  }
  if (a === 'costs') {
    const rows = [
      ...snapshot.chain.puts.map((p) => ({ k: p.strike, w: ((p.ask - p.bid) / p.mark) * 100, c: p.ask - p.bid, s: 'Puts' })),
      ...snapshot.chain.calls.map((c) => ({ k: c.strike, w: ((c.ask - c.bid) / c.mark) * 100, c: c.ask - c.bid, s: 'Calls' })),
    ];
    return Plot.plot({
      ...base,
      height: 280,
      x: { label: 'Strike (Nov 27)', domain: [640, 850] },
      y: { label: 'Bid-ask spread (% of mid)', grid: true },
      color: { domain: ['Calls', 'Puts'], range: [t.call, t.put] },
      marks: [
        Plot.ruleY([0], { stroke: t.axis }),
        Plot.ruleX([snapshot.spot], { stroke: t.axis, strokeDasharray: '3 3' }),
        Plot.line(rows, { x: 'k', y: 'w', stroke: 's', strokeWidth: 1.5, z: 's' }),
        Plot.dot(rows, { x: 'k', y: 'w', fill: 's', r: 4, stroke: t.surface, strokeWidth: 1.5 }),
        Plot.tip(rows, Plot.pointer({ x: 'k', y: 'w', title: (d: { k: number; w: number; c: number; s: string }) => `${d.k} ${d.s === 'Calls' ? 'call' : 'put'}\nSpread $${d.c.toFixed(2)} = ${d.w.toFixed(1)}% of mid` })),
      ],
    });
  }
  const rows = snapshot.termStructure.map((p) => ({ dte: p.dte, gap: (p.putIv - p.callIv) * 100, e: p.expiry }));
  return Plot.plot({
    ...base,
    height: 280,
    x: { label: 'Days to expiry (770 strike)', type: 'log', domain: [8, 500], ticks: [10, 30, 50, 100, 200, 400] },
    y: { label: 'Put IV − call IV (vol pts)', grid: true, domain: [-0.6, 1.2] },
    marks: [
      Plot.ruleY([0], { stroke: t.axis }),
      Plot.line(rows, { x: 'dte', y: 'gap', stroke: t.stock, strokeWidth: 2 }),
      Plot.dot(rows, { x: 'dte', y: 'gap', fill: t.stock, r: 4, stroke: t.surface, strokeWidth: 1.5 }),
      Plot.tip(rows, Plot.pointer({ x: 'dte', y: 'gap', title: (d: { e: string; dte: number; gap: number }) => `${d.e} (${d.dte} days)\nPut − call IV ${d.gap > 0 ? '+' : ''}${d.gap.toFixed(2)} pts` })),
    ],
  });
}

/** H5: each Black-Scholes assumption next to the snapshot evidence against it. */
export default function AssumptionExplorer() {
  const t = useTokens();
  const [a, setA] = useState<A>('gaps');
  const I = INFO[a];
  const legend = useMemo(() => {
    if (a === 'gaps') return [{ label: 'Daily move', color: t.muted }, { label: 'Beyond ±2 SD', color: t.put }, { label: '±2 SD band', color: t['band-1'], kind: 'box' as const }];
    if (a === 'vol') return [{ label: 'Realized vol, 20-day', color: t.call }, { label: 'VIX', color: t.put }, { label: `Snapshot ATM IV ${(atmIv * 100).toFixed(1)}%`, color: t.muted, kind: 'dash' as const }];
    if (a === 'tails') return [{ label: 'SPY day', color: t.call, kind: 'dot' as const }, { label: 'Beyond 2.5 SD', color: t.put, kind: 'dot' as const }, { label: 'Normal distribution', color: t.muted, kind: 'dash' as const }];
    if (a === 'smile') return [{ label: 'OTM puts', color: t.put }, { label: 'OTM calls', color: t.call }, { label: 'Single model vol', color: t.muted, kind: 'dash' as const }];
    if (a === 'costs') return [{ label: 'Calls', color: t.call }, { label: 'Puts', color: t.put }];
    return [{ label: 'Put IV minus call IV, 770 strike', color: t.stock }];
  }, [a, t]);

  return (
    <div className="viz-card not-content">
      <CardHead title="Assumption vs evidence" sub="Pick a Black-Scholes assumption to see what the snapshot data says about it" />
      <Segmented label="Assumption" value={a} onChange={setA} options={(Object.keys(INFO) as A[]).map((k) => ({ value: k, label: INFO[k].tab }))} />
      <div className="mt-3 grid gap-2 text-[0.82rem] sm:grid-cols-3">
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">The model assumes</div>
          <div className="text-(--sl-color-white)">{I.assumption}</div>
        </div>
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: t.put }}>
          <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">The snapshot shows</div>
          <div className="text-(--sl-color-white)">{I.evidence}</div>
        </div>
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: t.aqua }}>
          <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">How desks patch it</div>
          <div className="text-(--sl-color-white)">{I.patch}</div>
        </div>
      </div>
      <div className="mt-3">
        <PlotFigure deps={[a]} minHeight={300} build={(w, tk) => build(a, w, tk)} />
      </div>
      <Legend items={legend} />
      <p className="mt-1 text-[0.75rem] text-(--sl-color-gray-3)">
        Daily closes and VIX Oct 20, 2025 to Oct 27, 2026; option quotes from the Oct 27 close. One-year annualized realized vol {(SD * Math.sqrt(TRADING_DAYS)).toFixed(1)}%.
      </p>
    </div>
  );
}
