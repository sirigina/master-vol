import { useRef, useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { binomial } from '../../../lib/position';
import { intrinsic } from '../../../lib/pricing';
import { S0 } from './fdata';

/** Small CRR tree for an American put with the early-exercise nodes highlighted. Illustration. */
export default function TreeMini() {
  const t = useTokens();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const [K, setK] = useState(800);
  const [rate, setRate] = useState(4.6);
  const [days, setDays] = useState(180);
  const [vol, setVol] = useState(14);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const steps = 8;
  const T = days / 365;
  const am = binomial('put', { S: S0, K, T, r: rate / 100, sigma: vol / 100, steps, american: true });
  const eu = binomial('put', { S: S0, K, T, r: rate / 100, sigma: vol / 100, steps });

  const H = 320;
  const m = { top: 18, right: 22, bottom: 30, left: 22 };
  const iw = width - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const px = (i: number) => (i / steps) * iw;
  const py = (i: number, j: number) => ih / 2 - ((2 * j - i) / steps) * (ih / 2);
  // Count a node as early exercise only when exercising is strictly better than holding:
  // at a 0% rate deep nodes tie (exercise = continuation) to within floating-point noise.
  const dt = T / steps;
  const u = Math.exp((vol / 100) * Math.sqrt(dt));
  const pu = (Math.exp((rate / 100) * dt) - 1 / u) / (u - 1 / u);
  const disc = Math.exp((-rate / 100) * dt);
  const early = (i: number, j: number) =>
    i < steps &&
    am.exercised[i][j] &&
    intrinsic('put', am.stock[i][j], K) - disc * (pu * am.value[i + 1][j + 1] + (1 - pu) * am.value[i + 1][j]) > 1e-6;
  const nEarly = am.stock.slice(0, steps).reduce((a, row, i) => a + row.filter((_, j) => early(i, j)).length, 0);
  const hv = hover ? { i: hover[0], j: hover[1] } : null;

  return (
    <div className="viz-card not-content">
      <CardHead title="Inside the tree: where an American put is exercised" sub={`${steps}-step binomial tree from SPY 769.66. An illustration: coarse steps, model inputs.`} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Put strike" value={K} min={720} max={860} step={5} onChange={setK} format={(v) => `${v}`} />
        <Slider label="Interest rate" value={rate} min={0} max={10} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} />
        <Slider label="Days to expiry" value={days} min={10} max={365} step={5} onChange={setDays} format={(v) => `${v}`} />
        <Slider label="Volatility" value={vol} min={8} max={40} step={1} onChange={setVol} format={(v) => `${v}%`} />
      </div>
      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={H} role="img" aria-label="Binomial tree with early exercise nodes highlighted">
          <g transform={`translate(${m.left},${m.top})`}>
            {am.stock.slice(0, steps).map((row, i) =>
              row.map((_, j) => (
                <g key={`e${i}-${j}`}>
                  <line x1={px(i)} y1={py(i, j)} x2={px(i + 1)} y2={py(i + 1, j + 1)} stroke={t.grid} />
                  <line x1={px(i)} y1={py(i, j)} x2={px(i + 1)} y2={py(i + 1, j)} stroke={t.grid} />
                </g>
              )),
            )}
            {am.stock.map((row, i) =>
              row.map((s, j) => {
                const e = early(i, j);
                const itm = intrinsic('put', s, K) > 0;
                const fill = e ? t.put : i === steps ? (itm ? t['band-1'] : t.surface) : t.surface;
                return (
                  <circle
                    key={`n${i}-${j}`}
                    cx={px(i)}
                    cy={py(i, j)}
                    r={hv && hv.i === i && hv.j === j ? 9 : 7}
                    fill={fill}
                    stroke={e ? t.put : itm ? t.call : t.muted}
                    strokeWidth={2}
                    onPointerEnter={() => setHover([i, j])}
                    onPointerDown={() => setHover([i, j])}
                    onPointerLeave={() => setHover(null)}
                    style={{ cursor: 'pointer' }}
                  />
                );
              }),
            )}
            <text x={0} y={ih + 22} fontSize={11} fill={t.muted}>
              today
            </text>
            <text x={iw} y={ih + 22} fontSize={11} textAnchor="end" fill={t.muted}>
              expiry ({days} days)
            </text>
          </g>
        </svg>
        {hv && (
          <div className="viz-tip" style={{ left: Math.min(m.left + px(hv.i) + 14, width - 200), top: Math.max(m.top + py(hv.i, hv.j) - 30, 0) }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              Step {hv.i} of {steps}, SPY {am.stock[hv.i][hv.j].toFixed(2)}
            </div>
            <div>
              Exercise now: <b>{intrinsic('put', am.stock[hv.i][hv.j], K).toFixed(2)}</b>
            </div>
            <div>
              American value: <b>{am.value[hv.i][hv.j].toFixed(2)}</b>
            </div>
            <div>
              European value: <b>{eu.value[hv.i][hv.j].toFixed(2)}</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: `Exercise early (${nEarly} nodes)`, color: 'var(--viz-put)', kind: 'dot' },
          { label: 'In the money, hold (shaded at expiry)', color: 'var(--viz-call)', kind: 'dot' },
          { label: 'Out of the money', color: 'var(--viz-muted)', kind: 'dot' },
        ]}
      />
      <div className="mt-2 text-[0.82rem] text-(--sl-color-gray-2)">
        American {am.price.toFixed(2)} vs European {eu.price.toFixed(2)}: early-exercise premium <b>{(am.price - eu.price).toFixed(2)}</b>. Set the rate to 0% and the
        orange nodes disappear.
      </div>
    </div>
  );
}
