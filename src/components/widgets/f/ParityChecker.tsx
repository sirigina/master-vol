import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { pairs, impliedRate, rateBand, tOf, americanImpliedRate, S0, R, DIV, type Expiry } from './fdata';

/**
 * Backs the financing rate out of every call/put pair on the real chain, with
 * the band a trader could actually lock in after crossing the bid/ask.
 */
export default function ParityChecker() {
  const [exp, setExp] = useState<Expiry>('nov');
  const [adj, setAdj] = useState<'none' | 'adj'>('none');
  const T = tOf(exp);
  const amer = adj === 'adj';
  const D = exp === 'dec' ? DIV : 0;
  // American model rates are slow-ish (a bisection over binomial trees), so compute once per expiry.
  const amRates = useMemo(() => {
    if (!amer) return null;
    return new Map(
      pairs(exp).map((p) => {
        const sg = (p.call.iv + p.put.iv) / 2;
        return [
          p.K,
          {
            mid: americanImpliedRate(p.call.mark - p.put.mark, p.K, T, sg, D, undefined, 100),
            lo: americanImpliedRate(p.call.ask - p.put.bid, p.K, T, sg, D, undefined, 100),
            hi: americanImpliedRate(p.call.bid - p.put.ask, p.K, T, sg, D, undefined, 100),
          },
        ];
      }),
    );
  }, [exp, amer]);
  const rows = pairs(exp).map((p) => {
    const cp = p.call.mark - p.put.mark;
    const b = rateBand(p, T);
    const pvK = p.K * Math.exp(-R * T);
    const a = amRates?.get(p.K);
    return {
      K: p.K,
      call: p.call.mark,
      put: p.put.mark,
      cp,
      rhs: S0 - pvK,
      resid: cp - (S0 - pvK),
      rate: a ? a.mid : impliedRate(cp, p.K, T),
      lo: a ? a.lo : b.lo,
      hi: a ? a.hi : b.hi,
      width: p.call.ask - p.call.bid + p.put.ask - p.put.bid,
    };
  });
  const pctF = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="viz-card not-content">
      <CardHead title="Parity checker: the rate hidden in each strike" sub="C − P versus S − PV(K), and the financing rate that makes them equal" />
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Expiry</div>
          <Segmented
            label="Expiry"
            value={exp}
            onChange={setExp}
            options={[
              { value: 'nov', label: 'Nov 27 (31 days)' },
              { value: 'dec', label: 'Dec 18 (52 days)' },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Read the rate with</div>
          <Segmented
            label="Adjustment"
            value={adj}
            onChange={setAdj}
            options={[
              { value: 'none', label: 'European formula' },
              { value: 'adj', label: exp === 'nov' ? 'American model' : `American model + $${DIV.toFixed(2)} dividend` },
            ]}
          />
        </div>
      </div>
      <div className="mt-3">
        <PlotFigure
          deps={[exp, adj]}
          minHeight={270}
          build={(width, t) =>
            Plot.plot({
              width,
              height: 270,
              marginLeft: 48,
              marginBottom: 38,
              style: plotStyle(t),
              x: { label: 'Strike', type: 'point', padding: 0.4, tickFormat: (d: number, i: number) => (width < 520 && rows.length > 6 && i % 2 === 1 ? '' : String(d)) },
              y: { label: 'Implied rate', grid: true, domain: [0, 0.08], tickFormat: (d: number) => `${(d * 100).toFixed(0)}%` },
              marks: [
                Plot.ruleY([R], { stroke: t.muted, strokeDasharray: '4 3' }),
                Plot.text([R], { y: (d: number) => d, frameAnchor: 'right', dy: -7, text: () => `${(R * 100).toFixed(1)}% reference`, fill: t.muted, textAnchor: 'end' }),
                Plot.ruleX(rows, { x: 'K', y1: (d) => Math.max(d.lo, 0), y2: (d) => Math.min(d.hi, 0.08), stroke: t.call, strokeWidth: 6, strokeOpacity: 0.3 }),
                Plot.dot(rows, {
                  x: 'K',
                  y: 'rate',
                  r: 5,
                  fill: t.call,
                  stroke: t.surface,
                  tip: true,
                  title: (d) => `Strike ${d.K}\nRate at mid: ${pctF(d.rate)}\nRange after spreads: ${pctF(d.lo)} to ${pctF(d.hi)}\nCall + put spread: $${d.width.toFixed(2)}`,
                }),
              ],
            })
          }
        />
      </div>
      <Legend
        items={[
          { label: 'Rate at mid prices', color: 'var(--viz-call)', kind: 'dot' },
          { label: 'Range after bid/ask (clipped at 0–8%)', color: 'var(--viz-band-1)', kind: 'box' },
        ]}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-0 border-collapse text-[0.8rem] tabular-nums">
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              <th className="py-1 pr-2 font-medium">Strike</th>
              <th className="hidden py-1 pr-2 text-right font-medium sm:table-cell">Call</th>
              <th className="hidden py-1 pr-2 text-right font-medium sm:table-cell">Put</th>
              <th className="py-1 pr-2 text-right font-medium">C − P</th>
              <th className="py-1 pr-2 text-right font-medium">S − PV(K)</th>
              <th className="py-1 pr-2 text-right font-medium">Gap</th>
              <th className="py-1 text-right font-medium">Implied rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.K} className="border-t border-(--sl-color-hairline)">
                <td className="py-1 pr-2 font-semibold">{d.K}</td>
                <td className="hidden py-1 pr-2 text-right sm:table-cell">{d.call.toFixed(2)}</td>
                <td className="hidden py-1 pr-2 text-right sm:table-cell">{d.put.toFixed(2)}</td>
                <td className="py-1 pr-2 text-right">{d.cp.toFixed(2)}</td>
                <td className="py-1 pr-2 text-right">{d.rhs.toFixed(2)}</td>
                <td className="py-1 pr-2 text-right" style={{ color: Math.abs(d.resid) > 0.3 ? 'var(--viz-put)' : undefined }}>
                  {Math.abs(d.resid) < 0.005 ? '0.00' : `${d.resid > 0 ? '+' : '−'}${Math.abs(d.resid).toFixed(2)}`}
                </td>
                <td className="py-1 text-right font-semibold">{pctF(d.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Mid prices, SPY {S0.toFixed(2)}, table gaps use the European formula at {(R * 100).toFixed(1)}%. Hover a dot for the range a trader could lock in after paying the
        bid/ask on both options.
        {amer
          ? ` American model: the rate at which a binomial tree with early exercise${exp === 'dec' ? `, and a $${DIV.toFixed(2)} dividend going ex on Dec 18,` : ''} reproduces each quoted C − P.`
          : ''}
      </p>
    </div>
  );
}
