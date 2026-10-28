import { useRef, useState } from 'react';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, T_EXPIRY, fmt } from '../../../lib/snapshot';
import { binomial } from '../../../lib/position';
import { bs, type Right } from '../../../lib/pricing';
import { Tile, fmtSigned } from './kit';

const S0 = snapshot.spot;
const r = snapshot.rate;

type Style = 'eu' | 'am';

/** CRR tree drawn as nodes. Hover a node to read stock and option value; early-exercise nodes are marked. */
export default function BinomialTree() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [steps, setSteps] = useState(4);
  const [right, setRight] = useState<Right>('put');
  const [style, setStyle] = useState<Style>('am');
  const [K, setK] = useState(800);
  const [vol, setVol] = useState(14);
  const [hover, setHover] = useState<[number, number] | null>(null);

  const sigma = vol / 100;
  const tree = binomial(right, { S: S0, K, T: T_EXPIRY, r, sigma, steps, american: style === 'am' });
  const euro = style === 'am' ? binomial(right, { S: S0, K, T: T_EXPIRY, r, sigma, steps }).price : tree.price;
  const bsp = bs(right, { S: S0, K, T: T_EXPIRY, r, sigma }).price;
  const dt = T_EXPIRY / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const pu = (Math.exp(r * dt) - 1 / u) / (u - 1 / u);

  const narrow = width < 520;
  const showVals = steps <= (narrow ? 4 : 6);
  const h = narrow ? 360 : 420;
  const m = { top: 20, right: narrow ? 40 : 64, bottom: 30, left: narrow ? 36 : 56 };
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = h - m.top - m.bottom;
  const xs = (i: number) => (iw * i) / steps;
  // vertical: node j at step i sits at (2j − i) half-units; center at 0
  const ys = (i: number, j: number) => ih / 2 - ((2 * j - i) * ih) / (2 * Math.max(steps, 1)) * 0.92;
  const nodeR = showVals ? (narrow ? 19 : 25) : Math.max(4, 12 - steps);

  // only American, non-terminal exercise nodes are "early"
  const early = (i: number, j: number) => style === 'am' && i < steps && tree.exercised[i][j];
  const hv = hover ? { i: hover[0], j: hover[1], s: tree.stock[hover[0]][hover[1]], v: tree.value[hover[0]][hover[1]] } : null;
  const nEarly = tree.exercised.slice(0, steps).flat().filter(Boolean).length;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="A binomial tree for SPY"
        sub="Illustration: SPY starts at 769.66 and steps up or down until November 27. Option values are worked backward from expiry"
      />
      <div className="mb-3 grid gap-4 sm:grid-cols-3">
        <Slider label="Steps" value={steps} min={1} max={7} step={1} onChange={setSteps} format={(v) => `${v}`} />
        <Slider label="Strike" value={K} min={720} max={840} step={5} onChange={setK} format={(v) => `${v}`} />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <Segmented
          label="Option type"
          value={right}
          onChange={setRight}
          options={[
            { value: 'put', label: 'Put' },
            { value: 'call', label: 'Call' },
          ]}
        />
        <Segmented
          label="Exercise style"
          value={style}
          onChange={setStyle}
          options={[
            { value: 'am', label: 'American' },
            { value: 'eu', label: 'European' },
          ]}
        />
      </div>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={h} role="img" aria-label="Binomial tree of stock prices and option values" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {Array.from({ length: steps + 1 }, (_, i) => (
              <text key={i} x={xs(i)} y={ih + 22} textAnchor="middle" fontSize={10.5} fill={t.muted}>
                {i === 0 ? 'today' : i === steps ? 'expiry' : `step ${i}`}
              </text>
            ))}
            {tree.stock.slice(0, steps).map((row, i) =>
              row.map((_, j) => (
                <g key={`e${i}-${j}`} stroke={t.axis} strokeWidth={1.2}>
                  <line x1={xs(i)} y1={ys(i, j)} x2={xs(i + 1)} y2={ys(i + 1, j + 1)} />
                  <line x1={xs(i)} y1={ys(i, j)} x2={xs(i + 1)} y2={ys(i + 1, j)} />
                </g>
              )),
            )}
            {tree.stock.map((row, i) =>
              row.map((s, j) => {
                const v = tree.value[i][j];
                const ex = early(i, j);
                const itm = right === 'call' ? s > K : s < K;
                const fill = ex ? t.put : i === steps ? (itm ? t['band-1'] : t.surface) : t.surface;
                const isH = hover && hover[0] === i && hover[1] === j;
                return (
                  <g
                    key={`n${i}-${j}`}
                    transform={`translate(${xs(i)},${ys(i, j)})`}
                    onPointerEnter={() => setHover([i, j])}
                    onPointerDown={() => setHover([i, j])}
                    onPointerLeave={() => setHover(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle r={nodeR} fill={fill} fillOpacity={ex ? 0.85 : 1} stroke={isH ? t.ink : ex ? t.put : t.call} strokeWidth={isH ? 2.5 : 1.5} />
                    {showVals && (
                      <>
                        <text dy="-0.25em" textAnchor="middle" fontSize={narrow ? 9 : 10.5} fill={ex ? t.surface : t['ink-2']}>
                          {s.toFixed(0)}
                        </text>
                        <text dy="0.95em" textAnchor="middle" fontSize={narrow ? 9.5 : 11} fontWeight={700} fill={ex ? t.surface : t.ink}>
                          {v.toFixed(narrow ? 1 : 2)}
                        </text>
                      </>
                    )}
                  </g>
                );
              }),
            )}
          </g>
        </svg>
        {hv && (
          <div className="viz-tip" style={{ left: Math.max(4, Math.min(m.left + xs(hv.i) + 30, width - 220)), top: Math.max(4, m.top + ys(hv.i, hv.j) - 30) }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              Step {hv.i} of {steps}, {hv.j} up-moves
            </div>
            <div>
              SPY: <b>{hv.s.toFixed(2)}</b>
            </div>
            <div>
              {right === 'put' ? 'Put' : 'Call'} value: <b>{hv.v.toFixed(2)}</b>
            </div>
            <div>
              Exercise now: <b>{Math.max(right === 'call' ? hv.s - K : K - hv.s, 0).toFixed(2)}</b>
              {early(hv.i, hv.j) ? ' (better than holding)' : ''}
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'Top number: SPY. Bottom: option value', color: t.call, kind: 'dot' },
          { label: 'Expires in the money', color: t['band-1'], kind: 'box' },
          { label: 'Early exercise is optimal (American)', color: t.put, kind: 'box' },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={`Tree price (${style === 'am' ? 'American' : 'European'})`} value={fmt.usd(tree.price)} accent={t.call} />
        <Tile label="European tree" value={fmt.usd(euro)} sub={style === 'am' ? `early-exercise value ${fmt.usd(tree.price - euro)}` : 'same tree, no early exercise'} />
        <Tile label="Black-Scholes" value={fmt.usd(bsp)} sub={`tree error ${fmtSigned(euro - bsp)}`} />
        <Tile label="Up move / prob." value={`×${u.toFixed(4)} / ${(pu * 100).toFixed(1)}%`} sub={`${nEarly} early-exercise node${nEarly === 1 ? '' : 's'}`} />
      </div>
    </div>
  );
}
