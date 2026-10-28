import { useMemo, useRef, useState } from 'react';
import { scaleBand, scaleDiverging, interpolateRgb } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { leg, pnlAt, DTE, S0 } from './G1_kit';

const PRICES = Array.from({ length: 17 }, (_, i) => 730 + i * 5); // 730..810
const DAYS = [0, 4, 7, 10, 14, 17, 21, 24, 27, 29, 31];

/** G3: P/L of a straddle or strangle over price x days, IVs held at the snapshot. */
export default function G3PnlHeatmap() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [which, setWhich] = useState<'strad' | 'strang'>('strad');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [hover, setHover] = useState<[number, number] | null>(null);
  const sg = side === 'long' ? 1 : -1;
  const legs = useMemo(() => (which === 'strad' ? [leg('put', 770, sg), leg('call', 770, sg)] : [leg('put', 750, sg), leg('call', 790, sg)]), [which, sg]);
  const grid = useMemo(() => DAYS.map((d) => PRICES.map((s) => pnlAt(legs, s, d) * 100)), [legs]);

  const narrow = width < 520;
  const m = { top: 8, right: 8, bottom: 40, left: narrow ? 46 : 64 };
  const iw = Math.max(width - m.left - m.right, 60);
  const cellH = narrow ? 22 : 26;
  const ih = cellH * DAYS.length;
  const height = ih + m.top + m.bottom;
  const x = scaleBand<number>().domain(PRICES).range([0, iw]).padding(0.04);
  const y = scaleBand<number>().domain(DAYS).range([0, ih]).padding(0.06);
  const ext = 2500;
  const color = scaleDiverging<string>()
    .domain([-ext, 0, ext])
    .interpolator((u: number) => (u < 0.5 ? interpolateRgb(t.loss, t.surface)(u * 2) : interpolateRgb(t.surface, t.profit)((u - 0.5) * 2)))
    .clamp(true);
  const hv = hover ? grid[hover[0]][hover[1]] : null;
  const showNum = iw / PRICES.length > 30;
  const fmt0 = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : Math.abs(Math.round(v))}`;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="P/L across price and time"
        sub="Each cell is the P/L per spread if SPY is at that price after that many days, with every IV unchanged."
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Segmented label="Structure" value={which} onChange={setWhich} options={[{ value: 'strad', label: '770 straddle' }, { value: 'strang', label: '750/790 strangle' }]} />
        <Segmented label="Side" value={side} onChange={setSide} options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]} />
      </div>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label="Heatmap of profit and loss by SPY price and days elapsed" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {DAYS.map((d, i) =>
              PRICES.map((s, j) => (
                <rect
                  key={`${d}-${s}`}
                  x={x(s)}
                  y={y(d)}
                  width={x.bandwidth()}
                  height={y.bandwidth()}
                  fill={color(grid[i][j])}
                  stroke={hover && hover[0] === i && hover[1] === j ? t.ink : 'none'}
                  strokeWidth={1.5}
                  onPointerEnter={() => setHover([i, j])}
                  onPointerDown={() => setHover([i, j])}
                  onPointerLeave={() => setHover(null)}
                />
              )),
            )}
            {showNum &&
              DAYS.map((d, i) =>
                PRICES.map((s, j) => (
                  <text key={`t${d}-${s}`} x={x(s)! + x.bandwidth() / 2} y={y(d)! + y.bandwidth() / 2} dy="0.32em" textAnchor="middle" fontSize={9} fill={t.ink} pointerEvents="none" opacity={0.85}>
                    {fmt0(grid[i][j])}
                  </text>
                )),
              )}
            {DAYS.map((d) => (
              <text key={`yd${d}`} x={-6} y={y(d)! + y.bandwidth() / 2} dy="0.32em" textAnchor="end" fontSize={10} fill={t.muted}>
                {d === DTE ? 'expiry' : `day ${d}`}
              </text>
            ))}
            {PRICES.filter((_, i) => i % (narrow ? 4 : 2) === 0).map((s) => (
              <text key={`xs${s}`} x={x(s)! + x.bandwidth() / 2} y={ih + 16} textAnchor="middle" fontSize={10} fill={t.muted}>
                {s}
              </text>
            ))}
            <text x={iw / 2} y={ih + 33} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              SPY price
            </text>
          </g>
        </svg>
        {hover && hv !== null && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(PRICES[hover[1]])! + 18, width - 180), top: m.top + y(DAYS[hover[0]])! + 24 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              SPY {PRICES[hover[1]]}, {DAYS[hover[0]] === DTE ? 'at expiry' : `day ${DAYS[hover[0]]}`}
            </div>
            <div>
              P/L: <b>{`${hv < 0 ? '−' : hv > 0 ? '+' : ''}$${Math.abs(Math.round(hv)).toLocaleString('en-US')}`}</b>
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[0.78rem] text-(--sl-color-gray-3)">
        <span>≤ −$2,500</span>
        <span className="inline-block h-2.5 w-28 rounded-sm" style={{ background: 'linear-gradient(90deg, var(--viz-loss), var(--viz-surface), var(--viz-profit))', outline: '1px solid var(--sl-color-hairline)' }} />
        <span>≥ +$2,500</span>
      </div>
    </div>
  );
}
