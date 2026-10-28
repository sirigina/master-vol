import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot, atmIv, T_EXPIRY } from '../../../lib/snapshot';
import { bs } from '../../../lib/pricing';

type Row = { k: number; mkt: number; model: number; iv: number; ratio: number; diff: number };

/** H5: price the Nov 27 put chain with one volatility and compare with the market. */
export default function ModelError() {
  const t = useTokens();
  const [vol, setVol] = useState(atmIv * 100);
  const [view, setView] = useState<'price' | 'ratio'>('price');
  const sigma = vol / 100;

  const rows: Row[] = useMemo(
    () =>
      snapshot.chain.puts
        .filter((p) => p.strike <= 770)
        .map((p) => {
          const model = bs('put', { S: snapshot.spot, K: p.strike, T: T_EXPIRY, r: snapshot.rate, sigma }).price;
          return { k: p.strike, mkt: p.mark, model, iv: p.iv, ratio: p.mark / Math.max(model, 1e-6), diff: p.mark - model };
        }),
    [sigma],
  );
  const series = rows.flatMap((r) => [
    { k: r.k, v: view === 'price' ? r.mkt : r.ratio, s: 'Market mid' },
    { k: r.k, v: view === 'price' ? r.model : 1, s: `Model at ${vol.toFixed(1)}% flat` },
  ]);
  const r700 = rows.find((r) => r.k === 700)!;
  const r740 = rows.find((r) => r.k === 740)!;
  const r650 = rows.find((r) => r.k === 650)!;
  const names = ['Market mid', `Model at ${vol.toFixed(1)}% flat`];
  const fmtR = (x: number) => (x >= 100 ? `${Math.round(x).toLocaleString()}×` : `${x.toFixed(x >= 10 ? 0 : 1)}×`);

  return (
    <div className="viz-card not-content">
      <CardHead title="One volatility vs the real put chain" sub="Nov 27 SPY puts at or below the money, priced with Black-Scholes at a single volatility, against their market mids" />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Slider
          label="Volatility used for every strike"
          value={vol}
          min={10}
          max={35}
          step={0.5}
          onChange={setVol}
          format={(v) => `${v.toFixed(1)}%${Math.abs(v - atmIv * 100) < 0.3 ? ' (ATM)' : ''}`}
        />
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'price', label: 'Prices' },
            { value: 'ratio', label: 'Market ÷ model' },
          ]}
        />
      </div>
      <PlotFigure
        deps={[series, view]}
        minHeight={300}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 52,
            marginBottom: 36,
            style: plotStyle(tk),
            x: { label: 'Put strike', domain: [645, 775] },
            y:
              view === 'price'
                ? { label: 'Put price ($)', grid: true, type: 'log', domain: [0.0001, 15], ticks: [0.001, 0.01, 0.1, 1, 10], tickFormat: (d: number) => `$${d}` }
                : { label: 'Market ÷ model (log scale)', grid: true, type: 'log', domain: [0.5, 20000], ticks: [1, 10, 100, 1000, 10000], tickFormat: (d: number) => `${d.toLocaleString()}×` },
            color: { domain: names, range: [tk.put, tk.call] },
            marks: [
              view === 'ratio' ? Plot.ruleY([1], { stroke: tk.axis }) : null,
              Plot.line(
                series.filter((d) => d.s === names[0]).map((d) => ({ ...d, v: Math.max(d.v, view === 'price' ? 0.0001 : 0.5) })),
                { x: 'k', y: 'v', stroke: tk.put, strokeWidth: 2 },
              ),
              Plot.line(
                series.filter((d) => d.s === names[1]).map((d) => ({ ...d, v: Math.max(d.v, view === 'price' ? 0.0001 : 0.5) })),
                { x: 'k', y: 'v', stroke: tk.call, strokeWidth: 2, strokeDasharray: '6 4' },
              ),
              Plot.dot(
                series.map((d) => ({ ...d, v: Math.max(d.v, view === 'price' ? 0.0001 : 0.5) })),
                { x: 'k', y: 'v', fill: 's', r: 3.5, stroke: tk.surface, strokeWidth: 1.5 },
              ),
              Plot.tip(
                rows,
                Plot.pointerX({
                  x: 'k',
                  y: (d: Row) => Math.max(view === 'price' ? d.mkt : d.ratio, 0.0001),
                  title: (d: Row) => `${d.k} put\nMarket $${d.mkt.toFixed(2)} (IV ${(d.iv * 100).toFixed(1)}%)\nModel $${d.model.toFixed(d.model < 0.01 ? 4 : d.model < 0.1 ? 3 : 2)}\nMarket ÷ model ${fmtR(d.ratio)}`,
                }),
              ),
            ],
          })
        }
      />
      <Legend items={[{ label: 'Market mid', color: t.put }, { label: `Black-Scholes at ${vol.toFixed(1)}% for every strike`, color: t.call, kind: 'dash' }]} />
      <StatGrid
        cols={3}
        items={[
          ['740 put (−4%)', `$${r740.mkt.toFixed(2)} vs $${r740.model.toFixed(2)}`, `market ${fmtR(r740.ratio)} the model`],
          ['700 put (−9%)', `$${r700.mkt.toFixed(2)} vs $${r700.model.toFixed(2)}`, `market ${fmtR(r700.ratio)} the model`],
          ['650 put (−15.5%)', `$${r650.mkt.toFixed(2)} vs $${r650.model.toFixed(r650.model < 0.01 ? 4 : 3)}`, `market ${fmtR(r650.ratio)} the model`],
        ]}
      />
    </div>
  );
}
