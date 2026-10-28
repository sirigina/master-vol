import { useMemo, useState } from 'react';
import LineChart from '../i/LineChart';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { gbmPath } from '../../../lib/position';

const X0 = snapshot.index.SPX;
const R = snapshot.rate;
const fv = (S: number, q: number, days: number) => S * Math.exp((R - q) * (days / 365));

/** J2: futures fair value vs time to expiry, and basis convergence along a simulated index path. */
export default function FairValue() {
  const t = useTokens();
  const [q, setQ] = useState(1.1);
  const [days, setDays] = useState(52);
  const [view, setView] = useState<'curve' | 'converge'>('curve');

  const qq = q / 100;
  const curve = Array.from({ length: 74 }, (_, i) => i * 5).map((d) => ({ x: d, y: fv(X0, qq, d) - X0 }));
  const carryOnly = curve.map((p) => ({ x: p.x, y: X0 * (Math.exp(R * (p.x / 365)) - 1) }));

  const F = fv(X0, qq, days);
  const interest = X0 * (Math.exp(R * (days / 365)) - 1);
  const divs = interest - (F - X0); // dividend effect, so interest − dividends = basis exactly

  // convergence: index follows a seeded path; fair futures recomputed each day with remaining time
  const conv = useMemo(() => {
    const tradingDays = Math.round((days * 252) / 365);
    const path = gbmPath(X0, 0.14, tradingDays, 21);
    return path.map((s, i) => {
      const rem = days * (1 - i / tradingDays);
      return { i, rem, s, f: fv(s, qq, rem) };
    });
  }, [days, qq]);

  return (
    <div className="viz-card not-content">
      <CardHead title="S&P 500 futures fair value" sub={`F = S·e^((r − q)T), SPX ${X0.toFixed(1)}, financing rate ${(R * 100).toFixed(1)}%`} />
      <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'curve', label: 'Basis vs expiry' },
            { value: 'converge', label: 'Convergence' },
          ]}
        />
        <Slider label="Dividend yield q" value={q} min={0} max={3} step={0.1} onChange={setQ} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="Days to futures expiry" value={days} min={5} max={365} step={1} onChange={setDays} format={(v) => `${v} days`} />
      </div>

      <div className="mt-3">
        {view === 'curve' ? (
          <>
            <LineChart
              ariaLabel="Futures basis (fair value minus index) against days to expiry"
              height={290}
              series={[
                { key: 'b', label: 'Fair basis (r − q)', color: t.call, points: curve, width: 2.5 },
                { key: 'c', label: 'Interest only (q = 0)', color: t.muted, points: carryOnly, dash: true },
              ]}
              xDomain={[0, 365]}
              xLabel="Days to expiry"
              yLabel="Futures − index (points)"
              yFmt={(v) => v.toFixed(0)}
              tipFmt={(v) => `${v.toFixed(2)} pts`}
              tipTitle={(v) => `${v.toFixed(0)} days`}
              vlines={[{ x: days, label: `${days}d`, color: t.put }]}
            />
            <Legend
              items={[
                { label: 'Fair basis with dividends', color: t.call },
                { label: 'Interest only (no dividends)', color: t.muted, kind: 'dash' },
              ]}
            />
          </>
        ) : (
          <>
            <LineChart
              ariaLabel="Simulated SPX path and the fair futures price converging to it at expiry"
              height={290}
              zero={false}
              series={[
                { key: 'f', label: 'Fair futures', color: t.call, points: conv.map((c) => ({ x: c.rem, y: c.f })), width: 2.5 },
                { key: 's', label: 'Index', color: t.ink, points: conv.map((c) => ({ x: c.rem, y: c.s })), width: 1.75 },
              ]}
              xDomain={[days, 0]}
              xLabel="Days remaining to expiry"
              yLabel="Level"
              yFmt={(v) => v.toFixed(0)}
              tipFmt={(v) => v.toFixed(1)}
              tipTitle={(v) => `${v.toFixed(0)} days left`}
            />
            <Legend
              items={[
                { label: 'Fair futures price', color: t.call },
                { label: 'SPX (simulated path, 14% vol, seeded)', color: t.ink },
              ]}
            />
          </>
        )}
      </div>
      <StatGrid
        items={[
          ['Fair futures', F.toFixed(2), `${days} days, q = ${q.toFixed(1)}%`],
          ['Basis', `+${(F - X0).toFixed(2)} pts`, `${(((F - X0) / X0) * 100).toFixed(2)}% over index`, t.call],
          ['Interest carry', `+${interest.toFixed(2)}`, `${(R * 100).toFixed(1)}% for ${days} days`],
          ['Dividends', `−${divs.toFixed(2)}`, 'paid to index holders'],
        ]}
      />
    </div>
  );
}
