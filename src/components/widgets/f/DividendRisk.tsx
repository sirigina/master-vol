import { useState } from 'react';
import * as Plot from '@observablehq/plot';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid, Legend } from '../../ui/Stats';
import { bs } from '../../../lib/pricing';
import { S0, R, money } from './fdata';

/** Strikes whose holders should exercise before the ex-date: dividend vs put value + interest on the strike. */
export function exerciseTest(K: number, S: number, D: number, days: number, iv: number, r: number) {
  const t = days / 365;
  const put = bs('put', { S: S - D, K, T: t, r, sigma: iv }).price;
  const interest = K * (1 - Math.exp(-r * t));
  return { put, interest, hurdle: put + interest, exercise: D > put + interest && S > K };
}

export default function DividendRisk() {
  const [D, setD] = useState(2.1);
  const [days, setDays] = useState(1);
  const [iv, setIv] = useState(18);
  const [K, setK] = useState(730);
  const r = R;
  const S = S0;
  const strikes = Array.from({ length: 131 }, (_, i) => 660 + i);
  const rows = strikes.map((k) => ({ k, ...exerciseTest(k, S, D, days, iv / 100, r) }));
  const crit = rows.filter((x) => x.exercise).map((x) => x.k);
  const critK = crit.length ? Math.max(...crit) : null;
  const sel = exerciseTest(K, S, D, days, iv / 100, r);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Dividend risk: which short calls get exercised?"
        sub="The evening before the ex-date, a call holder exercises if the dividend beats the put's value plus interest on the strike. Model prices, SPY 769.66."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Dividend per share" value={D} min={0} max={6} step={0.05} onChange={setD} format={(v) => `$${v.toFixed(2)}`} />
        <Slider label="Option life left after the ex-date (days)" value={days} min={1} max={120} step={1} onChange={setDays} format={(v) => `${v}`} />
        <Slider label="Implied volatility" value={iv} min={8} max={40} step={1} onChange={setIv} format={(v) => `${v}%`} />
        <Slider label="Your short call strike" value={K} min={660} max={785} step={2.5} onChange={setK} format={(v) => `${v}`} />
      </div>
      <div className="mt-3">
        <PlotFigure
          deps={[D, days, iv, K]}
          minHeight={260}
          build={(width, t) =>
            Plot.plot({
              width,
              height: 260,
              clip: true,
              marginLeft: 46,
              marginBottom: 38,
              style: plotStyle(t),
              x: { label: "Strike", domain: [660, 790] },
              y: { label: 'Dollars per share', grid: true, domain: [0, Math.max(D * 1.6, 3)] },
              marks: [
                Plot.areaY(rows, { x: 'k', y1: (d) => Math.min(d.hurdle, D), y2: D, fill: t['loss-wash'] }),
                Plot.line(rows, { x: 'k', y: 'hurdle', stroke: t.call, strokeWidth: 2.5 }),
                Plot.line(rows, { x: 'k', y: 'interest', stroke: t.muted, strokeWidth: 1.5, strokeDasharray: '4 3' }),
                Plot.ruleY([D], { stroke: t.put, strokeWidth: 2 }),
                Plot.ruleX([K], { stroke: t.ink, strokeDasharray: '3 3' }),
                Plot.dot([sel], { x: () => K, y: 'hurdle', r: 5, fill: sel.exercise ? t.loss : t.profit, stroke: t.surface }),
                Plot.ruleY([0], { stroke: t.axis }),
              ],
            })
          }
        />
      </div>
      <Legend
        items={[
          { label: 'Hurdle: put value + interest on strike', color: 'var(--viz-call)' },
          { label: 'Interest part only', color: 'var(--viz-muted)', kind: 'dash' },
          { label: 'Dividend', color: 'var(--viz-put)' },
          { label: 'Shaded: dividend beats hurdle, expect exercise', color: 'var(--viz-loss-wash)', kind: 'box' },
        ]}
      />
      <StatGrid
        items={[
          ['Exercised: strikes up to', critK ? `${critK}` : 'none', critK ? 'every ITM call at or below this' : 'interest on the strike beats the dividend'],
          [`${K} put value`, money(sel.put), 'ex-dividend, rest of life'],
          ['Interest on strike', money(sel.interest), `${days} day${days === 1 ? '' : 's'} at ${(R * 100).toFixed(1)}%`],
          [
            `${K} call`,
            sel.exercise ? 'Likely exercised' : 'Likely held',
            `dividend ${money(D)} vs hurdle ${money(sel.hurdle)}`,
            sel.exercise ? 'var(--viz-loss)' : 'var(--viz-profit)',
          ],
        ]}
      />
    </div>
  );
}
