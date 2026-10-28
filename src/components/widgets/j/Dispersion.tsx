import { useState } from 'react';
import LineChart from '../i/LineChart';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';

const msftDec = snapshot.earnings.expiries.find((e) => e.expiry === '2026-12-18')!;
export const MSFT_DEC_IV = (msftDec.callIv + msftDec.putIv) / 2;
export const SPY_DEC_IV = snapshot.termStructure.find((p) => p.expiry === '2026-12-18')!.atmIv;
const N = 500;

/** Equal-weight basket vol with N members, common vol s and pairwise correlation rho. */
export const basketVol = (s: number, rho: number, n = N) => s * Math.sqrt(rho + (1 - rho) / n);
/** Correlation that reconciles index vol with average member vol. */
export const impliedCorr = (idx: number, s: number, n = N) => ((idx / s) ** 2 - 1 / n) / (1 - 1 / n);

/** J3: index vol as a function of average member vol and average correlation. */
export default function Dispersion() {
  const t = useTokens();
  const [vol, setVol] = useState(Math.round(MSFT_DEC_IV * 1000) / 10);
  const [rho, setRho] = useState(0.23);

  const s = vol / 100;
  const pts = Array.from({ length: 101 }, (_, i) => i / 100);
  const curve = pts.map((r) => ({ x: r * 100, y: basketVol(s, r) * 100 }));
  const ic = impliedCorr(SPY_DEC_IV, MSFT_DEC_IV);
  const idx = basketVol(s, rho);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Why index vol is lower than its members' vol"
        sub="Equal-weight basket of 500 stocks with the same volatility and one average pairwise correlation"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="Average single-stock vol" value={vol} min={15} max={50} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="Average correlation" value={rho} min={0} max={1} step={0.01} onChange={setRho} format={(v) => v.toFixed(2)} />
      </div>
      <div className="mt-3">
        <LineChart
          ariaLabel="Index volatility against average correlation"
          height={290}
          series={[{ key: 'idx', label: 'Index vol', color: t.call, points: curve, width: 2.5 }]}
          xDomain={[0, 100]}
          yDomain={[0, Math.max(50, vol + 2)]}
          xLabel="Average pairwise correlation"
          yLabel="Index vol (%)"
          xFmt={(v) => (v / 100).toFixed(1)}
          yFmt={(v) => `${v}%`}
          tipFmt={(v) => `${v.toFixed(1)}%`}
          tipTitle={(v) => `Correlation ${(v / 100).toFixed(2)}`}
          hlines={[
            { y: MSFT_DEC_IV * 100, label: `MSFT Dec IV ${(MSFT_DEC_IV * 100).toFixed(1)}%`, color: t.put },
            { y: SPY_DEC_IV * 100, label: `SPY Dec IV ${(SPY_DEC_IV * 100).toFixed(1)}%`, color: t.stock },
          ]}
          extra={({ x, y, t: tk }) => <circle cx={x(rho * 100)} cy={y(idx * 100)} r={6} fill={tk.call} stroke={tk.surface} strokeWidth={2} />}
        />
      </div>
      <Legend
        items={[
          { label: 'Index vol for this member vol', color: t.call },
          { label: 'MSFT Dec 18 implied vol', color: t.put, kind: 'dash' },
          { label: 'SPY Dec 18 implied vol', color: t.stock, kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          ['Index vol at your inputs', `${(idx * 100).toFixed(1)}%`, `σ·√(ρ + (1−ρ)/N)`],
          ['Ratio to member vol', `${((idx / s) * 100).toFixed(0)}%`, `√ρ = ${(Math.sqrt(rho) * 100).toFixed(0)}% when N is large`],
          ['Implied correlation', ic.toFixed(2), `if every member traded at MSFT's ${(MSFT_DEC_IV * 100).toFixed(1)}%`],
          ['At correlation 1', `${vol.toFixed(1)}%`, 'no diversification at all'],
        ]}
      />
    </div>
  );
}
