import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot, T_EXPIRY, atmIv, fmt } from '../../../lib/snapshot';
import { binomial } from '../../../lib/position';
import { bs, type Right } from '../../../lib/pricing';
import { Tile, fmtSigned } from './kit';

const S0 = snapshot.spot;
const r = snapshot.rate;
const K = 770;
const sigma = Math.round(atmIv * 1000) / 1000; // 0.141
const MAXN = 200;

/** Tree price vs number of steps for the 770 option, against Black-Scholes. */
export default function BinomialConvergence() {
  const t = useTokens();
  const [right, setRight] = useState<Right>('call');
  const [style, setStyle] = useState<'eu' | 'am'>('eu');
  const am = style === 'am';
  const bsp = bs(right, { S: S0, K, T: T_EXPIRY, r, sigma }).price;
  const data = useMemo(() => {
    const out: { n: number; price: number }[] = [];
    for (let n = 1; n <= MAXN; n++) out.push({ n, price: binomial(right, { S: S0, K, T: T_EXPIRY, r, sigma, steps: n, american: am }).price });
    return out;
  }, [right, am]);
  const at = (n: number) => data[n - 1].price;
  const avgLast = (at(MAXN) + at(MAXN - 1)) / 2;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="More steps, closer to Black-Scholes"
        sub={`Tree price of the 770 ${right} for 1 to ${MAXN} steps (SPY ${S0}, ${snapshot.chain.dte} days, ${fmt.pct(sigma)} vol, 4.6% rate)`}
        right={
          <div className="flex flex-wrap gap-2">
            <Segmented
              label="Option type"
              value={right}
              onChange={setRight}
              options={[
                { value: 'call', label: 'Call' },
                { value: 'put', label: 'Put' },
              ]}
            />
            <Segmented
              label="Exercise style"
              value={style}
              onChange={setStyle}
              options={[
                { value: 'eu', label: 'European' },
                { value: 'am', label: 'American' },
              ]}
            />
          </div>
        }
      />
      <PlotFigure
        deps={[data, bsp]}
        minHeight={280}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 280,
            marginLeft: 46,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'Steps in the tree', type: 'log', domain: [1, MAXN], ticks: [1, 2, 5, 10, 20, 50, 100, 200], tickFormat: (d: number) => String(d) },
            y: { label: 'Price ($)', grid: true, domain: [bsp - 3.3, bsp + 3.3] },
            marks: [
              Plot.ruleY([bsp], { stroke: tk.ink, strokeDasharray: '5 4', strokeWidth: 1.5 }),
              Plot.line(data, { x: 'n', y: 'price', stroke: right === 'call' ? tk.call : tk.put, strokeWidth: 1.3, clip: true }),
              Plot.dot(data.filter((d) => d.n <= 30), { x: 'n', y: 'price', r: 2.5, fill: right === 'call' ? tk.call : tk.put, clip: true }),
              Plot.tip(data, Plot.pointerX({ x: 'n', y: 'price', title: (d: { n: number; price: number }) => `${d.n} steps\nTree ${d.price.toFixed(3)}\nBS ${bsp.toFixed(3)}\nGap ${(d.price - bsp >= 0 ? '+' : '−') + Math.abs(d.price - bsp).toFixed(3)}` })),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: `${am ? 'American' : 'European'} tree price`, color: right === 'call' ? t.call : t.put },
          { label: `Black-Scholes (European) ${fmt.usd(bsp)}`, color: t.ink, kind: 'dash' },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="1 step" value={fmt.usd(at(1))} sub={`gap ${fmtSigned(at(1) - bsp)}`} />
        <Tile label="10 steps" value={fmt.usd(at(10))} sub={`gap ${fmtSigned(at(10) - bsp)}`} />
        <Tile label="100 steps" value={fmt.usd(at(100))} sub={`gap ${fmtSigned(at(100) - bsp, 3)}`} />
        <Tile label={`${MAXN} steps`} value={fmt.usd(at(MAXN))} sub={am ? `≈ ${fmt.usd(avgLast - bsp)} above European BS` : `gap ${fmtSigned(at(MAXN) - bsp, 3)}`} accent={right === 'call' ? t.call : t.put} />
      </div>
    </div>
  );
}
