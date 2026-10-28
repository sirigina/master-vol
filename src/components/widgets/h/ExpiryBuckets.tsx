import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import { SAMPLE_BOOK, buckets, type Bucket } from './bucketBook';
import { sgn0, sgnN } from './hlib';

type K = 'vega' | 'wvega' | 'gamma' | 'theta';
const META: Record<K, { label: string; unit: string; fmt: (v: number) => string }> = {
  vega: { label: 'Vega', unit: '$ per vol point', fmt: (v) => sgn0(v) },
  wvega: { label: 'Weighted vega', unit: '$ per 30-day-equivalent vol point', fmt: (v) => sgn0(v) },
  gamma: { label: 'Gamma', unit: 'shares per $1', fmt: (v) => sgnN(v, 1) },
  theta: { label: 'Theta', unit: '$ per day', fmt: (v) => sgn0(v) },
};

/** H4: a book's Greeks bucketed by expiry. */
export default function ExpiryBuckets() {
  const [k, setK] = useState<K>('vega');
  const data = useMemo(() => buckets(), []);
  const total = (key: K) => data.reduce((a, b) => a + b[key], 0);
  const M = META[k];

  return (
    <div className="viz-card not-content">
      <CardHead title="The same book, bucketed by expiry" sub="A sample SPY book: short front-month straddles and strangles, long December and March straddles" />
      <Segmented label="Greek" value={k} onChange={setK} options={(Object.keys(META) as K[]).map((x) => ({ value: x, label: META[x].label }))} />
      <PlotFigure
        deps={[k]}
        minHeight={270}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 270,
            marginLeft: 62,
            marginBottom: 36,
            style: plotStyle(t),
            x: { label: null, domain: data.map((d) => d.label), padding: 0.3 },
            y: { label: `${M.label} (${M.unit})`, grid: true, domain: [Math.min(0, ...data.map((d) => d[k])) * 1.25, Math.max(0, ...data.map((d) => d[k])) * 1.2], nice: true, tickFormat: (d: number) => (k === 'gamma' ? `${d}` : `${d < 0 ? '−' : ''}$${Math.abs(d).toLocaleString()}`) },
            marks: [
              Plot.barY(data, { x: 'label', y: k, fill: (d: Bucket) => (d[k] >= 0 ? t.call : t.put), rx: 2 }),
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.text(
                data.filter((d) => d[k] >= 0),
                { x: 'label', y: k, text: (d: Bucket) => M.fmt(d[k]), dy: -8, fill: t['ink-2'], fontWeight: 600 },
              ),
              Plot.text(
                data.filter((d) => d[k] < 0),
                { x: 'label', y: k, text: (d: Bucket) => M.fmt(d[k]), dy: 10, fill: t['ink-2'], fontWeight: 600 },
              ),
              Plot.tip(data, Plot.pointerX({ x: 'label', y: k, title: (d: Bucket) => `${d.label} (${d.dte} days)\nVega ${sgn0(d.vega)}/pt\nWeighted vega ${sgn0(d.wvega)}\nGamma ${sgnN(d.gamma, 1)} sh/$\nTheta ${sgn0(d.theta)}/day` })),
            ],
          })
        }
      />
      <StatGrid
        cols={4}
        items={[
          ['Net vega', `${sgn0(total('vega'))}/pt`, 'looks almost flat'],
          ['Weighted vega', sgn0(total('wvega')), 'scaled by √(30/days)'],
          ['Net gamma', `${sgnN(total('gamma'), 1)} sh/$`, 'mostly in Nov 6'],
          ['Net theta', `${sgn0(total('theta'))}/day`],
        ]}
      />
      <details className="mt-3 text-[0.8rem] text-(--sl-color-gray-2)">
        <summary className="cursor-pointer text-(--sl-color-gray-3)">Book contents</summary>
        <ul className="mt-1 mb-0 pl-5">
          {SAMPLE_BOOK.map((p) => (
            <li key={p.label}>{p.label}</li>
          ))}
        </ul>
      </details>
      <p className="mt-2 text-[0.75rem] text-(--sl-color-gray-3)">
        Greeks from Black-Scholes at each expiry&apos;s quoted 770-strike IVs (term structure) and the Nov 27 / Dec 18 chains. Bars: blue long, orange short.
      </p>
    </div>
  );
}
