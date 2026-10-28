import { useMemo, useState } from 'react';
import LineChart from '../i/LineChart';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { normalSampler } from '../../../lib/position';
import { realizedVol } from '../../../lib/pricing';

const DAYS = 252;
const S0 = 100;

/** Two correlated GBM paths and their 50/50 basket (seeded, deterministic). */
function simulate(volA: number, volB: number, rho: number, seed: number) {
  const z1 = normalSampler(seed);
  const z2 = normalSampler(seed + 101);
  const dt = 1 / 252;
  const a = [S0];
  const b = [S0];
  const k = [S0];
  for (let i = 0; i < DAYS; i++) {
    const e1 = z1();
    const e2 = rho * e1 + Math.sqrt(1 - rho * rho) * z2();
    a.push(a[i] * Math.exp(-0.5 * volA * volA * dt + volA * Math.sqrt(dt) * e1));
    b.push(b[i] * Math.exp(-0.5 * volB * volB * dt + volB * Math.sqrt(dt) * e2));
    // daily-rebalanced equal-weight basket
    k.push(k[i] * (0.5 * (a[i + 1] / a[i]) + 0.5 * (b[i + 1] / b[i])));
  }
  return { a, b, k };
}

/** J3: seeded simulation of two correlated stocks; basket vol shrinks as correlation falls. */
export default function BasketSim() {
  const t = useTokens();
  const [rho, setRho] = useState(0.3);
  const [seed, setSeed] = useState(3);
  const volA = 0.3;
  const volB = 0.3;

  const { a, b, k } = useMemo(() => simulate(volA, volB, rho, seed), [rho, seed]);
  const rvA = realizedVol(a);
  const rvB = realizedVol(b);
  const rvK = realizedVol(k);
  const theory = Math.sqrt(0.25 * volA ** 2 + 0.25 * volB ** 2 + 0.5 * rho * volA * volB);
  const pts = (arr: number[]) => arr.map((y, x) => ({ x, y }));

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Two stocks, one basket"
        sub="Illustration: two simulated stocks, each 30% vol, and a 50/50 basket rebalanced daily. One year of seeded paths."
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Slider label="Correlation between the two stocks" value={rho} min={-0.5} max={1} step={0.05} onChange={setRho} format={(v) => v.toFixed(2)} />
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-3 py-1.5 text-[0.82rem] text-(--sl-color-white)"
        >
          New paths
        </button>
      </div>
      <div className="mt-3">
        <LineChart
          ariaLabel="Two simulated stock paths and their equal-weight basket"
          height={290}
          zero={false}
          series={[
            { key: 'a', label: 'Stock A', color: t.put, points: pts(a), width: 1.5 },
            { key: 'b', label: 'Stock B', color: t.call, points: pts(b), width: 1.5 },
            { key: 'k', label: '50/50 basket', color: t.ink, points: pts(k), width: 2.75 },
          ]}
          xDomain={[0, DAYS]}
          xLabel="Trading day"
          yLabel="Price (start = 100)"
          yFmt={(v) => v.toFixed(0)}
          tipFmt={(v) => v.toFixed(1)}
          tipTitle={(v) => `Day ${v.toFixed(0)}`}
        />
      </div>
      <Legend
        items={[
          { label: 'Stock A', color: t.put },
          { label: 'Stock B', color: t.call },
          { label: '50/50 basket', color: t.ink },
        ]}
      />
      <StatGrid
        items={[
          ['Stock A realized', `${(rvA * 100).toFixed(1)}%`, 'target 30%'],
          ['Stock B realized', `${(rvB * 100).toFixed(1)}%`, 'target 30%'],
          ['Basket realized', `${(rvK * 100).toFixed(1)}%`, `formula ${(theory * 100).toFixed(1)}%`, t.ink],
          ['Diversification', `${((1 - rvK / ((rvA + rvB) / 2)) * 100).toFixed(0)}% lower`, 'than the average member'],
        ]}
      />
    </div>
  );
}
