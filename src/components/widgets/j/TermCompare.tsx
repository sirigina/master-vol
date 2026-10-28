import { useState } from 'react';
import LineChart from '../i/LineChart';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';

const msft = snapshot.earnings.expiries.map((e) => ({ dte: e.dte, iv: (e.callIv + e.putIv) / 2, expiry: e.expiry }));
const spy = snapshot.termStructure.filter((p) => p.dte <= 80).map((p) => ({ dte: p.dte, iv: p.atmIv, expiry: p.expiry }));

// Fit: total variance = diffusive σ² · t + one earnings jump variance E², from the 10d and 52d MSFT points.
const v = (p: { dte: number; iv: number }) => p.iv * p.iv * (p.dte / 365);
const A = msft.find((m) => m.dte === 10)!;
const B = msft.find((m) => m.dte === 52)!;
export const MSFT_BASE = Math.sqrt((v(B) - v(A)) / ((B.dte - A.dte) / 365));
export const MSFT_EVENT = Math.sqrt(v(A) - MSFT_BASE ** 2 * (A.dte / 365));
const model = (dte: number) => Math.sqrt(MSFT_BASE ** 2 + (MSFT_EVENT ** 2 * 365) / dte);

/** J3: MSFT vs SPY implied vol term structure, with the earnings bump decomposed. */
export default function TermCompare() {
  const t = useTokens();
  const [view, setView] = useState<'iv' | 'ratio'>('iv');

  const curve = Array.from({ length: 78 }, (_, i) => 3 + i).map((d) => ({ x: d, y: model(d) * 100 }));
  const ratio = msft
    .map((m) => {
      const s = snapshot.termStructure.reduce((a, b) => (Math.abs(b.dte - m.dte) < Math.abs(a.dte - m.dte) ? b : a));
      return { x: m.dte, y: m.iv / s.atmIv, s: s.dte };
    })
    .filter((r) => r.x >= 3);

  return (
    <div className="viz-card not-content">
      <CardHead title="MSFT vs SPY: term structure around earnings" sub="At-the-money implied vol by expiry. MSFT reports Oct 28 after the close." />
      <div className="mb-3">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'iv', label: 'Implied vol' },
            { value: 'ratio', label: 'MSFT ÷ SPY ratio' },
          ]}
        />
      </div>
      {view === 'iv' ? (
        <>
          <LineChart
            ariaLabel="MSFT and SPY at-the-money implied volatility by days to expiry"
            height={300}
            series={[
              { key: 'fit', label: 'MSFT fit (base + one event)', color: t.put, points: curve, dash: true, width: 1.5 },
              { key: 'msft', label: 'MSFT', color: t.put, points: msft.map((m) => ({ x: m.dte, y: m.iv * 100 })), dots: true, width: 2.5 },
              { key: 'spy', label: 'SPY', color: t.stock, points: spy.map((m) => ({ x: m.dte, y: m.iv * 100 })), dots: true, width: 2.5 },
              { key: 'base', label: 'MSFT ex-earnings', color: t.muted, points: [{ x: 0, y: MSFT_BASE * 100 }, { x: 82, y: MSFT_BASE * 100 }], dash: true, width: 1.25 },
            ]}
            xDomain={[0, 82]}
            yDomain={[0, 80]}
            xLabel="Days to expiry"
            yLabel="ATM implied vol"
            yFmt={(v) => `${v}%`}
            tipFmt={(v) => `${v.toFixed(1)}%`}
            tipTitle={(v) => `${v.toFixed(0)} days`}
          />
          <Legend
            items={[
              { label: 'MSFT (530 strike)', color: t.put },
              { label: 'SPY (770 strike)', color: t.stock },
              { label: 'MSFT model: base vol + earnings jump', color: t.put, kind: 'dash' },
              { label: 'MSFT base vol, ex-earnings', color: t.muted, kind: 'dash' },
            ]}
          />
        </>
      ) : (
        <>
          <LineChart
            ariaLabel="Ratio of MSFT to SPY implied volatility by expiry"
            height={300}
            series={[{ key: 'r', label: 'MSFT ÷ SPY', color: t.call, points: ratio, dots: true, width: 2.5 }]}
            xDomain={[0, 56]}
            yDomain={[0, 6]}
            xLabel="Days to expiry (MSFT expiry; SPY nearest)"
            yLabel="Vol ratio"
            yFmt={(v) => `${v.toFixed(1)}×`}
            tipFmt={(v) => `${v.toFixed(2)}×`}
            tipTitle={(v) => `${v.toFixed(0)} days`}
            hlines={[{ y: MSFT_BASE / snapshot.termStructure[4].atmIv, label: 'ex-earnings ratio', color: t.muted }]}
          />
          <Legend items={[{ label: 'MSFT IV ÷ SPY IV, nearest expiry', color: t.call }]} />
        </>
      )}
      <StatGrid
        items={[
          ['MSFT Oct 30 (3d)', `${(msft[0].iv * 100).toFixed(1)}%`, 'carries the earnings move'],
          ['MSFT Dec 18 (52d)', `${(B.iv * 100).toFixed(1)}%`, `SPY Dec ${(snapshot.termStructure[4].atmIv * 100).toFixed(1)}%`],
          ['MSFT base vol', `${(MSFT_BASE * 100).toFixed(1)}%`, 'fitted from the 10d and 52d points'],
          ['Implied earnings move', `±${(MSFT_EVENT * 100).toFixed(1)}%`, `about ±$${(MSFT_EVENT * snapshot.earnings.spot).toFixed(0)}, one SD`],
        ]}
      />
    </div>
  );
}
