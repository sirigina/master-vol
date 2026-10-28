import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { normCdf } from '../../../lib/pricing';
import { leg, has, net, S0, R, T_EXPIRY, atmIv } from './G1_kit';

const SHORTS: [number, number][] = [
  [765, 775],
  [760, 780],
  [750, 790],
  [740, 800],
];
const WIDTHS = [5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 65];

function pBetween(lo: number, hi: number) {
  const d2 = (K: number) => (Math.log(S0 / K) + (R - 0.5 * atmIv * atmIv) * T_EXPIRY) / (atmIv * Math.sqrt(T_EXPIRY));
  return normCdf(d2(lo)) - normCdf(d2(hi));
}

/** G4: iron condor credit vs wing width for several short-strike pairs. */
export default function G4CondorTradeoff() {
  const t = useTokens();
  const [metric, setMetric] = useState<'credit' | 'loss' | 'ratio'>('credit');
  const rows = useMemo(
    () =>
      SHORTS.flatMap(([p, c]) =>
        WIDTHS.filter((w) => has('put', p - w) && has('call', c + w)).map((w) => {
          const credit = -net([leg('put', p - w, 1), leg('put', p, -1), leg('call', c, -1), leg('call', c + w, 1)]);
          return { pair: `${p}/${c}`, w, credit: credit * 100, loss: (w - credit) * 100, ratio: (credit / w) * 100, keep: pBetween(p, c) };
        }),
      ),
    [],
  );
  const colors = [t.put, t.stock, t.call, t.aqua];
  const pairs = SHORTS.map(([p, c]) => `${p}/${c}`);
  const yLabel = metric === 'credit' ? 'Credit per condor ($)' : metric === 'loss' ? 'Max loss per condor ($)' : 'Credit as % of wing width';

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Iron condors: what wider wings buy you"
        sub="Short a put and a call, buy protection further out. Each line keeps the short strikes fixed and widens the wings."
        right={
          <Segmented
            label="Metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'credit', label: 'Credit' },
              { value: 'loss', label: 'Max loss' },
              { value: 'ratio', label: 'Credit ÷ width' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[metric]}
        minHeight={300}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 56,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'Wing width ($ between short and long strike)', domain: [0, 68], ticks: [0, 10, 20, 30, 40, 50, 60] },
            y: { label: yLabel, grid: true, nice: true, zero: true, tickFormat: (v: number) => (metric === 'ratio' ? `${v}%` : `$${v.toLocaleString('en-US')}`) },
            color: { domain: pairs, range: colors },
            marks: [
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.line(rows, { x: 'w', y: metric, stroke: 'pair', strokeWidth: 2 }),
              Plot.dot(rows, { x: 'w', y: metric, fill: 'pair', r: 3.5, stroke: tk.surface, strokeWidth: 1 }),
              Plot.tip(
                rows,
                Plot.pointer({
                  x: 'w',
                  y: metric,
                  title: (d: (typeof rows)[0]) =>
                    `Shorts ${d.pair}, $${d.w} wings\nCredit $${d.credit.toFixed(0)}  ·  Max loss $${d.loss.toFixed(0)}\nCredit ÷ width ${d.ratio.toFixed(0)}%\nModel odds of keeping full credit ${(d.keep * 100).toFixed(0)}%`,
                }),
              ),
            ],
          })
        }
      />
      <Legend items={SHORTS.map(([p, c], i) => ({ label: `Shorts ${p}/${c} (${(pBetween(p, c) * 100).toFixed(0)}% odds inside)`, color: colors[i], kind: 'dot' as const }))} />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Real Nov 27 marks, per condor (100 shares). Only widths where both long strikes are listed appear. Hover a point for detail. "Odds inside" is the lognormal
        probability at {(atmIv * 100).toFixed(1)}% IV that SPY (now {S0}) finishes between the short strikes.
      </p>
    </div>
  );
}
