import { useMemo, useState } from 'react';
import LineChart, { kfmtSigned, moneySigned } from './LineChart';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { normalSampler, rng } from '../../../lib/position';
import { S0, quote } from './hedge';

const V = 1_000_000;
const K = 740;
const PREM = quote('nov', 'put', K)!.mark;
const T = 31 / 365;
const N_SIM = 360;

/** I3: hedged vs unhedged portfolio P/L under market moves, with basis-risk scatter (illustrative). */
export default function HedgedPortfolio() {
  const t = useTokens();
  const [beta, setBeta] = useState(1.2);
  const [te, setTe] = useState(8);
  const [sizing, setSizing] = useState<'beta' | 'dollar'>('beta');

  const n = Math.round((V * (sizing === 'beta' ? beta : 1)) / (100 * S0));
  const hedgeAt = (m: number) => n * 100 * (Math.max(K - S0 * (1 + m), 0) - PREM);

  const xs = Array.from({ length: 71 }, (_, i) => -0.25 + i * 0.005);
  const unhedged = xs.map((m) => ({ x: m * 100, y: V * beta * m }));
  const hedged = xs.map((m) => ({ x: m * 100, y: V * beta * m + hedgeAt(m) }));

  const sims = useMemo(() => {
    const u = rng(7);
    const z = normalSampler(11);
    const sd = (te / 100) * Math.sqrt(T);
    return Array.from({ length: N_SIM }, () => {
      const m = -0.25 + u() * 0.35;
      const e = z() * sd;
      return { m, e };
    });
  }, [te]);
  const dots = sims.map(({ m, e }) => ({ x: m * 100, y: V * (beta * m + e) + hedgeAt(m) }));

  // dispersion of hedged outcomes around the beta line, in dollars
  const resid = (te / 100) * Math.sqrt(T) * V;
  const at = (m: number) => V * beta * m + hedgeAt(m);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Hedged vs unhedged: a $1M portfolio with Nov 27 740 SPY puts"
        sub="Illustration: portfolio return = beta × SPY return + stock-specific noise. Dots are simulated outcomes (seeded)."
      />
      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <Slider label="Portfolio beta" value={beta} min={0.6} max={1.6} step={0.05} onChange={setBeta} format={(v) => v.toFixed(2)} />
        <Slider label="Tracking error" value={te} min={0} max={20} step={1} onChange={setTe} format={(v) => `${v}% / yr`} />
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Hedge sized by</div>
          <Segmented
            label="Sizing"
            value={sizing}
            onChange={setSizing}
            options={[
              { value: 'beta', label: 'Beta-weighted' },
              { value: 'dollar', label: 'Dollar value' },
            ]}
          />
        </div>
      </div>
      <div className="mt-3">
        <LineChart
          ariaLabel="Portfolio P/L against the SPY move at expiry, hedged and unhedged, with simulated outcomes"
          height={320}
          series={[
            { key: 'sim', label: 'Simulated hedged outcome', color: t.call, points: dots, dots: true, noLine: true, faded: false },
            { key: 'un', label: 'Unhedged (beta line)', color: t.loss, points: unhedged, dash: true },
            { key: 'h', label: 'Hedged (beta line)', color: t.ink, points: hedged, width: 2.5 },
          ]}
          xDomain={[-25, 10]}
          xLabel="SPY move by Nov 27 expiry"
          yLabel="Portfolio P/L"
          xFmt={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`}
          yFmt={kfmtSigned}
          tipFmt={moneySigned}
          tipTitle={(v) => `SPY ${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`}
        />
      </div>
      <Legend
        items={[
          { label: 'Hedged, no basis risk', color: t.ink },
          { label: 'Unhedged', color: t.loss, kind: 'dash' },
          { label: 'Simulated hedged outcomes', color: t.call, kind: 'dot' },
        ]}
      />
      <StatGrid
        items={[
          ['Puts held', `${n} × ${K}`, sizing === 'beta' ? `$1M × ${beta.toFixed(2)} ÷ $76,966` : '$1M ÷ $76,966 (ignores beta)'],
          ['Premium paid', `$${Math.round(n * 100 * PREM).toLocaleString('en-US')}`, `${((n * 100 * PREM) / V * 100).toFixed(2)}% of the portfolio`],
          ['Hedged P/L if SPY −20%', moneySigned(at(-0.2)), `unhedged ${moneySigned(V * beta * -0.2)}`],
          ['Basis risk, 1 SD', `±${moneySigned(resid).replace('+', '')}`, 'stock-specific moves the puts cannot offset'],
        ]}
      />
    </div>
  );
}
