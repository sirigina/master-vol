import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot, T_EXPIRY, atmIv, fmt } from '../../../lib/snapshot';
import { bs, type Right } from '../../../lib/pricing';
import { fmtSigned } from './kit';

type Mode = 'own' | 'flat';

/** Reprice the November 27 chain with each strike's own IV, or with one flat vol, and plot the error. */
export default function ModelVsMarket() {
  const t = useTokens();
  const [right, setRight] = useState<Right>('put');
  const [mode, setMode] = useState<Mode>('flat');
  const [flat, setFlat] = useState(Math.round(atmIv * 1000) / 10);

  const rows = useMemo(() => {
    const src = right === 'call' ? snapshot.chain.calls : snapshot.chain.puts;
    return src.map((c) => {
      const sigma = mode === 'own' ? c.iv : flat / 100;
      const model = bs(right, { S: snapshot.spot, K: c.strike, T: T_EXPIRY, r: snapshot.rate, sigma }).price;
      return { K: c.strike, market: c.mark, model, err: model - c.mark, half: (c.ask - c.bid) / 2 };
    });
  }, [right, mode, flat]);

  const worst = rows.reduce((a, b) => (Math.abs(b.err) > Math.abs(a.err) ? b : a));
  const mae = rows.reduce((a, r) => a + Math.abs(r.err), 0) / rows.length;

  return (
    <div className="viz-card not-content">
      <CardHead title="Does the model reproduce the chain?" sub="Model price minus market mid, strike by strike, November 27 expiry" />
      <div className="mb-3 grid gap-4 sm:grid-cols-[auto_auto_1fr] sm:items-end">
        <Segmented
          label="Option type"
          value={right}
          onChange={setRight}
          options={[
            { value: 'put', label: 'Puts' },
            { value: 'call', label: 'Calls' },
          ]}
        />
        <Segmented
          label="Volatility used"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'own', label: "Each strike's own IV" },
            { value: 'flat', label: 'One flat vol' },
          ]}
        />
        {mode === 'flat' ? (
          <Slider label="Flat volatility" value={flat} min={8} max={30} step={0.1} onChange={setFlat} format={(v) => `${v.toFixed(1)}%`} />
        ) : (
          <div className="text-[0.78rem] text-(--sl-color-gray-3)">Vendor IVs, 4.6% rate, no dividend</div>
        )}
      </div>
      <PlotFigure
        deps={[rows]}
        minHeight={290}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 50,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'Strike', domain: [645, 845] },
            y: { label: 'Model − market ($)', grid: true, domain: [-3.2, 3.2], tickFormat: (d: number) => (d === 0 ? '0' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`) },
            marks: [
              Plot.ruleY([0], { stroke: tk.axis, strokeWidth: 1.5 }),
              Plot.ruleX([snapshot.spot], { stroke: tk.stock, strokeDasharray: '3 3' }),
              Plot.text([snapshot.spot], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => `SPY ${snapshot.spot}`, fill: tk.stock }),
              Plot.ruleX(rows, { x: 'K', y1: 0, y2: (d: { err: number }) => Math.max(-3.2, Math.min(3.2, d.err)), stroke: right === 'call' ? tk.call : tk.put, strokeWidth: 1.5 }),
              Plot.dot(rows, { x: 'K', y: (d: { err: number }) => Math.max(-3.2, Math.min(3.2, d.err)), r: 5, fill: right === 'call' ? tk.call : tk.put, stroke: tk.surface }),
              Plot.tip(
                rows,
                Plot.pointerX({
                  x: 'K',
                  y: (d: { err: number }) => Math.max(-3.2, Math.min(3.2, d.err)),
                  title: (d: { K: number; market: number; model: number; err: number }) =>
                    `Strike ${d.K}\nMarket ${d.market.toFixed(2)}\nModel ${d.model.toFixed(2)}\nError ${d.err >= 0 ? '+' : '−'}${Math.abs(d.err).toFixed(2)}`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: `Model − market, ${right}s`, color: right === 'call' ? t.call : t.put, kind: 'dot' },
          { label: 'SPY spot', color: t.stock, kind: 'dash' },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Largest error</div>
          <div className="text-[0.95rem] font-semibold tabular-nums">
            {fmtSigned(worst.err)} at {worst.K}
          </div>
        </div>
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Average miss</div>
          <div className="text-[0.95rem] font-semibold tabular-nums">
            {fmt.usd(mae)} across {rows.length} strikes
          </div>
        </div>
        <div className="col-span-2 rounded-lg border border-(--sl-color-hairline) px-3 py-2 sm:col-span-1">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Volatility</div>
          <div className="text-[0.95rem] font-semibold tabular-nums">{mode === 'own' ? 'One per strike (the smile)' : `${flat.toFixed(1)}% everywhere`}</div>
        </div>
      </div>
    </div>
  );
}
