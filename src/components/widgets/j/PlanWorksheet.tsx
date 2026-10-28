import { useMemo, useState, type ReactNode } from 'react';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { FAMILIES, FAMILY_KEYS, analyze, scenario, marketRead, MOVES, VOL_SHIFTS, DTE_FRONT, type Family } from './plan';

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
const sgn = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-(--sl-color-hairline) pt-3 pb-1">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-(--sl-color-accent) text-[0.78rem] font-bold text-(--sl-color-black)">
          {n}
        </span>
        <span className="text-[0.92rem] font-semibold">{title}</span>
      </div>
      <div className="text-[0.84rem] text-(--sl-color-gray-2)">{children}</div>
    </section>
  );
}

/** J4: seven-step trade-plan worksheet on the snapshot. */
export default function PlanWorksheet() {
  const t = useTokens();
  const [forecast, setForecast] = useState(12);
  const [fam, setFam] = useState<Family>('condor');
  const [budget, setBudget] = useState(5000);
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState(false);

  const mr = marketRead;
  const f = forecast / 100;
  const gap = f - mr.atmIv;
  const volView = gap < -0.01 ? 'short' : gap > 0.01 ? 'long' : 'neutral';
  const def = FAMILIES[fam];
  const a = useMemo(() => analyze(fam, f), [fam, f]);
  const fits = def.view === volView || def.view === 'neutral';

  const perContractLoss = -a.maxLoss * 100;
  const contracts = Math.max(0, Math.floor(budget / perContractLoss));
  const n = Math.max(contracts, 0);
  const grid = VOL_SHIFTS.map((vs) => MOVES.map((m) => scenario(a.legs, m, vs, days) * 100 * n));
  const gridMax = Math.max(1, ...grid.flat().map(Math.abs));
  const longCalls = a.legs.filter((l) => l.right === 'call').reduce((s, l) => s + l.qty, 0);
  const openUp = longCalls > 0 && a.legs.every((l) => l.T === a.legs[0].T);
  const shortVol = a.greeks.vega < 0;

  const exitRules = shortVol
    ? [
        `Take profit at 50% of the maximum gain (${usd(a.maxGain * 50 * n)}).`,
        `Stop out if the loss reaches ${usd(Math.min(budget * 0.5, -a.maxLoss * 100 * n))}, half the risk budget or the max loss, whichever is smaller.`,
        `Adjust if position delta exceeds ±${Math.max(5, Math.round(n * 15))} shares: roll the tested side out or away (lesson G9).`,
        `Close or roll by ${DTE_FRONT - 7} days in (one week before Nov 27), when gamma risk rises fastest.`,
      ]
    : [
        `Take profit if realized volatility over the holding period exceeds ${pct(mr.atmIv)} and the position is up 30–50% on premium.`,
        `Stop out at 50% of the premium paid (${usd(Math.abs(a.net) * 50 * n)}) or if implied vol falls 2+ points with no realized move.`,
        `Re-hedge delta when it exceeds ±${Math.max(5, Math.round(n * 15))} shares if trading the volatility, not the direction (lesson E3).`,
        `Exit by ${DTE_FRONT - 10} days in: theta accelerates in the last two to three weeks.`,
      ];

  const summary = [
    `TRADE PLAN · SPY · data as of ${snapshot.asOfLabel} (educational exercise, static data)`,
    ``,
    `1. Market read: SPY ${mr.spot.toFixed(2)}; 20-day realized ${pct(mr.rv20)}, 1-year ${pct(mr.rv1y)}; ATM implied ${pct(mr.atmIv, 2)}; VIX ${mr.vix.toFixed(2)}; term structure ${pct(mr.front.atmIv)} (${mr.front.dte}d) to ${pct(mr.back.atmIv)} (${mr.back.dte}d), upward; 740 put ${pct(mr.skew.put.iv)} vs 800 call ${pct(mr.skew.call.iv)}.`,
    `2. Vol view: forecast ${forecast.toFixed(1)}% vs implied ${pct(mr.atmIv, 2)} → ${volView === 'short' ? 'implied looks rich: sell volatility' : volView === 'long' ? 'implied looks cheap: buy volatility' : 'no clear vol edge'}. Model edge ${sgn(a.edge * 100)} per spread.`,
    `3. Strategy: ${def.label}. Net ${a.net >= 0 ? 'debit' : 'credit'} ${Math.abs(a.net).toFixed(2)} per share.`,
    `4. Size: risk budget ${usd(budget)}; max loss ${usd(perContractLoss)} per spread → ${n} spread${n === 1 ? '' : 's'} (max loss ${usd(perContractLoss * n)}).`,
    `5. Greeks (position): delta ${(a.greeks.delta * 100 * n).toFixed(0)} sh, gamma ${(a.greeks.gamma * 100 * n).toFixed(2)}, theta ${sgn(a.greeks.theta * 100 * n)}/day, vega ${sgn(a.greeks.vega * 100 * n)}/vol pt.`,
    `   Scenario after ${days} days: SPY −5% ${sgn(grid[1][0])}, flat ${sgn(grid[1][2])}, +5% ${sgn(grid[1][4])}; vol +3 pts flat ${sgn(grid[2][2])}.`,
    `6. Rules:`,
    ...exitRules.map((r) => `   - ${r}`),
    `7. Review: record entry/exit prices, realized vol over the hold, P/L split into delta, gamma, theta and vega; did the forecast or the execution drive the result?`,
  ].join('\n');

  function copy() {
    try {
      navigator.clipboard?.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  function printPlan() {
    const w = window.open('', '_blank', 'width=760,height=900');
    if (!w) return;
    const esc = summary.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    w.document.write(`<!doctype html><title>Trade plan</title><pre style="font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;padding:24px">${esc}</pre>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const cell = (v: number) => ({
    background: Math.abs(v) < 0.5 ? 'transparent' : v > 0 ? t['profit-wash'] : t['loss-wash'],
    borderLeft: `3px solid ${Math.abs(v) / gridMax > 0.5 ? (v > 0 ? t.profit : t.loss) : 'transparent'}`,
  });

  return (
    <div className="viz-card not-content">
      <CardHead title="Trade-plan worksheet: SPY, October 27, 2026" sub="Educational exercise on historical static data. Not a recommendation." />

      <Step n={1} title="Market read">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['SPY', mr.spot.toFixed(2), 'near the October highs'],
            ['Realized vol', pct(mr.rv20), `20-day; 1-year ${pct(mr.rv1y)}`],
            ['Implied vol', pct(mr.atmIv, 2), `Nov 27 ATM; VIX ${mr.vix.toFixed(2)}`],
            ['Term / skew', `${pct(mr.front.atmIv)} → ${pct(mr.back.atmIv)}`, `740 put ${pct(mr.skew.put.iv)}, 800 call ${pct(mr.skew.call.iv)}`],
          ].map(([k, v, s]) => (
            <div key={k} className="rounded-md border border-(--sl-color-hairline) px-2.5 py-1.5">
              <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">{k}</div>
              <div className="font-semibold tabular-nums text-(--sl-color-white)">{v}</div>
              <div className="text-[0.72rem] text-(--sl-color-gray-3)">{s}</div>
            </div>
          ))}
        </div>
      </Step>

      <Step n={2} title="Volatility view and edge">
        <Slider label="Your forecast of realized vol to Nov 27" value={forecast} min={8} max={24} step={0.5} onChange={setForecast} format={(v) => `${v.toFixed(1)}%`} />
        <p className="mt-2 mb-0">
          Forecast {forecast.toFixed(1)}% vs implied {pct(mr.atmIv, 2)}: gap <b className="tabular-nums text-(--sl-color-white)">{(gap * 100 >= 0 ? '+' : '−') + Math.abs(gap * 100).toFixed(1)} pts</b>.{' '}
          {volView === 'short' && 'Implied looks rich against your forecast: the edge is on the short-volatility side.'}
          {volView === 'long' && 'Implied looks cheap against your forecast: the edge is on the long-volatility side.'}
          {volView === 'neutral' && 'Within a point of implied: no clear volatility edge. A directional or term-structure trade, or no trade, fits better.'}
        </p>
      </Step>

      <Step n={3} title="Spread selection">
        <Segmented label="Strategy family" value={fam} onChange={setFam} options={FAMILY_KEYS.map((k) => ({ value: k, label: FAMILIES[k].label.split(' ').slice(0, 2).join(' ') }))} />
        <p className="mt-2 mb-0">
          <b className="text-(--sl-color-white)">{def.label}.</b> {def.blurb} Net {a.net >= 0 ? 'debit' : 'credit'} <span className="tabular-nums">{Math.abs(a.net).toFixed(2)}</span> per share.
        </p>
        <p className="mt-1 mb-0 tabular-nums">
          Model edge at your forecast: <b style={{ color: a.edge >= 0 ? t.profit : t.loss }}>{sgn(a.edge * 100)}</b> per spread{' '}
          <span className="text-(--sl-color-gray-3)">(every leg's IV shifted by the gap, skew shape kept)</span>.{' '}
          {!fits && <span style={{ color: t.loss }}>This structure is {def.view} volatility, against your view.</span>}
        </p>
      </Step>

      <Step n={4} title="Sizing from max loss">
        <Slider label="Risk budget (max loss you accept)" value={budget} min={500} max={25000} step={250} onChange={setBudget} format={(v) => usd(v)} />
        <p className="mt-2 mb-0 tabular-nums">
          Max loss per spread at Nov 27: <b className="text-(--sl-color-white)">{usd(perContractLoss)}</b>. Max gain: {openUp ? 'open-ended on the upside' : usd(a.maxGain * 100)}.{' '}
          Size: <b className="text-(--sl-color-white)">{n} spread{n === 1 ? '' : 's'}</b> (max loss {usd(perContractLoss * n)}).{' '}
          {n === 0 && <span style={{ color: t.loss }}>The budget is below one spread's max loss: no trade at this size.</span>}
        </p>
      </Step>

      <Step n={5} title="Greeks and scenarios">
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4 tabular-nums">
          {[
            ['Delta', `${(a.greeks.delta * 100 * n).toFixed(0)} sh`],
            ['Gamma', `${(a.greeks.gamma * 100 * n).toFixed(2)} /$`],
            ['Theta', `${sgn(a.greeks.theta * 100 * n)} /day`],
            ['Vega', `${sgn(a.greeks.vega * 100 * n)} /pt`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-(--sl-color-hairline) px-2.5 py-1.5">
              <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">{k}</div>
              <div className="font-semibold text-(--sl-color-white)">{v}</div>
            </div>
          ))}
        </div>
        <Slider className="mb-2" label="Scenario horizon" value={days} min={0} max={DTE_FRONT} step={1} onChange={setDays} format={(v) => `${v} days`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[19rem] text-[0.72rem] tabular-nums sm:text-[0.8rem]">
            <thead>
              <tr className="text-(--sl-color-gray-3)">
                <th className="py-1 pr-1 text-left font-medium">Vol</th>
                {MOVES.map((m) => (
                  <th key={m} className="py-1 px-1 text-right font-medium">
                    {m === 0 ? 'flat' : `${m > 0 ? '+' : '−'}${Math.abs(m * 100)}%`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VOL_SHIFTS.map((vs, i) => (
                <tr key={vs} className="border-t border-(--sl-color-hairline)">
                  <td className="py-1 pr-2 text-(--sl-color-gray-3)">{vs === 0 ? '0' : `${vs > 0 ? '+' : '−'}${Math.abs(vs * 100)}`}</td>
                  {grid[i].map((v, j) => (
                    <td key={j} className="py-1 px-0.5 text-right font-semibold text-(--sl-color-white) sm:px-1" style={cell(v)}>
                      {sgn(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 mb-0 text-[0.75rem] text-(--sl-color-gray-3)">Rows: implied vol shift in points. Columns: SPY move. Position P/L after the horizon.</p>
      </Step>

      <Step n={6} title="Entry, adjustment and exit rules">
        <p className="mt-0 mb-1">Enter at mid or better; if the spread is not filled within a few cents of mid, re-check the edge rather than chase.</p>
        <ul className="m-0 pl-5">
          {exitRules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Step>

      <Step n={7} title="Post-trade review">
        <p className="my-0">
          Afterwards, record realized volatility over the holding period against your {forecast.toFixed(1)}% forecast, and split the P/L into delta, gamma, theta and vega. Ask
          whether the result came from the forecast, from execution, or from luck in the path.
        </p>
      </Step>

      <div className="mt-3 rounded-lg border border-(--sl-color-hairline) p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.85rem] font-semibold">Plan summary</span>
          <span className="flex gap-2">
            <button type="button" onClick={copy} className="cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-2.5 py-1 text-[0.8rem] text-(--sl-color-white)">
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={printPlan} className="cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-2.5 py-1 text-[0.8rem] text-(--sl-color-white)">
              Print
            </button>
          </span>
        </div>
        <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap text-[0.74rem] leading-snug text-(--sl-color-gray-2)">{summary}</pre>
      </div>
    </div>
  );
}
