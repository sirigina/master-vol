import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { fmt } from '../../../lib/snapshot';
import { msft, msftIv, straddlePnl } from './volmath';

const FRONT = msft.expiries[0];
const PRE_IV = msftIv(FRONT);
const moves = Array.from({ length: 161 }, (_, i) => -10 + i * 0.125);

function breakeven(iv: number, sign: 1 | -1) {
  let lo = 0;
  let hi = 20;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (straddlePnl(sign * mid, iv) < 0) lo = mid;
    else hi = mid;
  }
  return sign * (lo + hi) / 2;
}

/** Long Oct 30 530 straddle: P/L at the close the day after earnings vs the stock move, for a chosen post-event IV. */
export default function CrushSim() {
  const t = useTokens();
  const [iv, setIv] = useState(30);
  const [move, setMove] = useState(0);
  const sigma = iv / 100;
  const after = moves.map((m) => ({ m, pnl: straddlePnl(m, sigma) * 100 }));
  const noCrush = moves.map((m) => ({ m, pnl: straddlePnl(m, PRE_IV) * 100 }));
  const expiry = moves.map((m) => {
    const S = msft.spot * (1 + m / 100);
    return { m, pnl: (Math.abs(S - msft.strike) - FRONT.straddle) * 100 };
  });
  const here = straddlePnl(move, sigma) * 100;
  const up = breakeven(sigma, 1);
  const dn = breakeven(sigma, -1);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="The crush: one MSFT 530 straddle (Oct 30), the day after earnings"
        sub={`Bought at ${fmt.usd(FRONT.straddle)} (IV ${(PRE_IV * 100).toFixed(1)}%) at the Oct 27 close; valued at the Oct 29 close, one day before expiry. Per contract (100 shares).`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="IV after earnings" value={iv} min={15} max={75} step={0.5} onChange={setIv} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="MSFT move on the news" value={move} min={-10} max={10} step={0.25} onChange={setMove} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}% (${fmt.usd(msft.spot * (1 + v / 100))})`} />
      </div>
      <PlotFigure
        deps={[iv, move]}
        minHeight={290}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 290,
            marginLeft: 52,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'MSFT move (%)', domain: [-10, 10], tickFormat: (d: number) => `${d > 0 ? '+' : ''}${d}%`, grid: true },
            y: { label: 'P/L per contract ($)', domain: [-3000, 3000], grid: true },
            marks: [
              Plot.areaY(after, { x: 'm', y1: 0, y2: (d: { pnl: number }) => Math.max(d.pnl, 0), fill: tk['profit-wash'] }),
              Plot.areaY(after, { x: 'm', y1: 0, y2: (d: { pnl: number }) => Math.min(d.pnl, 0), fill: tk['loss-wash'] }),
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.line(expiry, { x: 'm', y: 'pnl', stroke: tk.muted, strokeWidth: 1.2, strokeDasharray: '2 3' }),
              Plot.line(noCrush, { x: 'm', y: 'pnl', stroke: tk.stock, strokeWidth: 1.5, strokeDasharray: '6 4' }),
              Plot.line(after, { x: 'm', y: 'pnl', stroke: tk.call, strokeWidth: 2.5 }),
              Plot.ruleX([up, dn], { stroke: tk.ink, strokeOpacity: 0.4, strokeDasharray: '3 3' }),
              Plot.dot([{ m: move, pnl: here }], { x: 'm', y: 'pnl', r: 6, fill: here >= 0 ? tk.profit : tk.loss, stroke: tk.surface, strokeWidth: 2 }),
              Plot.tip(after, Plot.pointerX({ x: 'm', y: 'pnl', title: (d: { m: number; pnl: number }) => `Move ${d.m > 0 ? '+' : ''}${d.m.toFixed(2)}%\nP/L ${d.pnl >= 0 ? '+' : '−'}$${Math.abs(d.pnl).toFixed(0)}` })),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: `Day after, IV ${iv.toFixed(1)}%`, color: t.call },
          { label: `Day after, if IV stayed ${(PRE_IV * 100).toFixed(0)}% (no crush)`, color: t.stock, kind: 'dash' },
          { label: 'At expiry', color: t.muted, kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          ['P/L at this move', `${here >= 0 ? '+' : '−'}$${Math.abs(here).toFixed(0)}`, `${here < 0 ? '−' : '+'}${Math.abs((here / (FRONT.straddle * 100)) * 100).toFixed(0)}% of premium`, here >= 0 ? 'var(--viz-profit)' : 'var(--viz-loss)'],
          ['If MSFT doesn\'t move', `−$${Math.abs(straddlePnl(0, sigma) * 100).toFixed(0)}`, 'the crush plus two days of decay'],
          ['Breakeven moves', `−${Math.abs(dn).toFixed(2)}% / +${up.toFixed(2)}%`, `${fmt.usd(msft.spot * (1 + dn / 100))} / ${fmt.usd(msft.spot * (1 + up / 100))}`],
          ['Premium paid', `$${(FRONT.straddle * 100).toFixed(0)}`, `${fmt.usd(FRONT.straddle)} × 100`],
        ]}
      />
    </div>
  );
}
