import { useMemo, useState } from 'react';
import LineChart from '../i/LineChart';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { normalSampler } from '../../../lib/position';

const X0 = snapshot.index.SPX;
const R = snapshot.rate;
const Q = 0.011;
const DAYS = 52;
const N = 160; // intraday observations across the period (illustration)

/** J2: no-arbitrage band around fair value; mispricings outside the band are tradable (illustrative). */
export default function ArbBand() {
  const t = useTokens();
  const [cost, setCost] = useState(0.06);
  const [noise, setNoise] = useState(4);

  const data = useMemo(() => {
    const z = normalSampler(5);
    let dev = 0;
    return Array.from({ length: N + 1 }, (_, i) => {
      const rem = DAYS * (1 - i / N);
      const fair = X0 * (Math.exp((R - Q) * (rem / 365)) - 1);
      // mean-reverting mispricing that shrinks toward expiry
      dev = 0.8 * dev + z() * noise * 0.6 * Math.sqrt(rem / DAYS + 0.05);
      return { rem, fair, mkt: fair + dev };
    });
  }, [noise]);

  const band = (X0 * cost) / 100;
  const outside = data.filter((d) => Math.abs(d.mkt - d.fair) > band);
  const rich = outside.filter((d) => d.mkt > d.fair).length;
  const cheap = outside.length - rich;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="The no-arbitrage band"
        sub="Illustration: a simulated market basis wandering around fair value for a 52-day future. Only moves outside the band pay after costs."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="Round-trip arbitrage cost" value={cost} min={0.01} max={0.2} step={0.01} onChange={setCost} format={(v) => `${v.toFixed(2)}% = ${((X0 * v) / 100).toFixed(1)} pts`} />
        <Slider label="Size of mispricings" value={noise} min={1} max={8} step={0.5} onChange={setNoise} format={(v) => `${v.toFixed(1)} pts`} />
      </div>
      <div className="mt-3">
        <LineChart
          ariaLabel="Market basis against fair basis with a cost band"
          height={290}
          series={[
            { key: 'up', label: 'Upper bound', color: t.muted, points: data.map((d) => ({ x: d.rem, y: d.fair + band })), dash: true, width: 1.25 },
            { key: 'lo', label: 'Lower bound', color: t.muted, points: data.map((d) => ({ x: d.rem, y: d.fair - band })), dash: true, width: 1.25 },
            { key: 'fair', label: 'Fair basis', color: t.call, points: data.map((d) => ({ x: d.rem, y: d.fair })), width: 2 },
            { key: 'mkt', label: 'Market basis', color: t.ink, points: data.map((d) => ({ x: d.rem, y: d.mkt })), width: 1.5 },
            { key: 'rich', label: 'Futures rich', color: t.loss, points: outside.filter((d) => d.mkt > d.fair).map((d) => ({ x: d.rem, y: d.mkt })), dots: true, noLine: true },
            { key: 'cheap', label: 'Futures cheap', color: t.profit, points: outside.filter((d) => d.mkt <= d.fair).map((d) => ({ x: d.rem, y: d.mkt })), dots: true, noLine: true },
          ]}
          xDomain={[DAYS, 0]}
          xLabel="Days remaining"
          yLabel="Futures − index (points)"
          yFmt={(v) => v.toFixed(0)}
          tipFmt={(v) => `${v.toFixed(1)} pts`}
          tipTitle={(v) => `${v.toFixed(1)} days left`}
        />
      </div>
      <Legend
        items={[
          { label: 'Fair basis', color: t.call },
          { label: 'Market basis', color: t.ink },
          { label: 'Cost band', color: t.muted, kind: 'dash' },
          { label: 'Rich: sell futures, buy stocks', color: t.loss, kind: 'dot' },
          { label: 'Cheap: buy futures, sell stocks', color: t.profit, kind: 'dot' },
        ]}
      />
      <StatGrid
        cols={3}
        items={[
          ['Band half-width', `±${band.toFixed(1)} pts`, `±$${Math.round(band * 50).toLocaleString()} per ES`],
          ['Observations outside', `${outside.length} of ${N + 1}`, `${rich} rich, ${cheap} cheap`],
          ['Fair basis today', `+${data[0].fair.toFixed(2)} pts`, `r ${(R * 100).toFixed(1)}%, q ${(Q * 100).toFixed(1)}%`],
        ]}
      />
    </div>
  );
}
