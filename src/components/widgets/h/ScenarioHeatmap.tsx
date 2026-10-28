import { useMemo, useRef, useState } from 'react';
import { interpolateRgb, scaleBand } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { BOOKS, S0, bookPnl, bookCost, sgn0 } from './hlib';

const MOVES = Array.from({ length: 21 }, (_, i) => i - 10); // % SPY
const VOLS = Array.from({ length: 17 }, (_, i) => 8 - i); // vol points, top = +8
const KEYS = ['shortStrangle', 'ironCondor', 'shortPut', 'longStraddle', 'calendar', 'coveredCall'];

/** H3: full-revaluation P/L grid, SPY price × IV change, with days forward. */
export default function ScenarioHeatmap() {
  const t = useTokens();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const [book, setBook] = useState('ironCondor');
  const [days, setDays] = useState(0);
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);

  const legs = BOOKS[book].legs;
  const grid = useMemo(
    () => VOLS.map((dv) => MOVES.map((m) => bookPnl(legs, { S: S0 * (1 + m / 100), volPts: dv, days }))),
    [book, days],
  );
  const flat = grid.flat();
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  const ext = Math.max(Math.abs(lo), Math.abs(hi), 1);
  const color = (v: number) => {
    const a = Math.min(Math.abs(v) / ext, 1) ** 0.75;
    return v >= 0 ? interpolateRgb(t.surface, t.profit)(a * 0.85) : interpolateRgb(t.surface, t.loss)(a * 0.85);
  };

  const narrow = width < 520;
  const m = { top: 8, right: 8, bottom: 40, left: narrow ? 40 : 52 };
  const iw = Math.max(width - m.left - m.right, 100);
  const cellH = narrow ? 15 : 18;
  const ih = VOLS.length * cellH;
  const x = scaleBand<number>().domain(MOVES).range([0, iw]).padding(0.04);
  const y = scaleBand<number>().domain(VOLS).range([0, ih]).padding(0.06);
  const hv = hover ? { m: MOVES[hover.i], dv: VOLS[hover.j], v: grid[hover.j][hover.i] } : null;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / iw) * MOVES.length);
    const j = Math.floor(((e.clientY - r.top) / ih) * VOLS.length);
    if (i >= 0 && i < MOVES.length && j >= 0 && j < VOLS.length) setHover({ i, j });
  }

  const cost = bookCost(legs);
  const base = grid[VOLS.indexOf(0)][MOVES.indexOf(0)];

  return (
    <div className="viz-card not-content">
      <CardHead title="Full revaluation grid" sub="P/L of the whole position (dollars), every cell repriced with Black-Scholes. Columns: SPY move. Rows: change in every IV." />
      <Segmented label="Position" value={book} onChange={setBook} options={KEYS.map((k) => ({ value: k, label: BOOKS[k].label }))} />
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Slider label="Days forward" value={days} min={0} max={30} step={1} onChange={setDays} format={(v) => `${v} day${v === 1 ? '' : 's'} (${31 - v} left on Nov 27)`} />
        <div className="text-[0.8rem] text-(--sl-color-gray-3) tabular-nums">
          {cost >= 0 ? 'Paid' : 'Collected'} {sgn0(Math.abs(cost)).replace('+', '')} · center cell {sgn0(base)}
        </div>
      </div>

      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={ih + m.top + m.bottom} role="img" aria-label="Heatmap of P/L over SPY price change and implied volatility change" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {VOLS.map((dv, j) =>
              MOVES.map((mv, i) => (
                <rect key={`${i}-${j}`} x={x(mv)} y={y(dv)} width={x.bandwidth()} height={y.bandwidth()} rx={1.5} fill={color(grid[j][i])} />
              )),
            )}
            <rect x={x(0)! - 1} y={y(0)! - 1} width={x.bandwidth() + 2} height={y.bandwidth() + 2} fill="none" stroke={t.ink} strokeWidth={1.25} rx={2} />
            {hv && (
              <rect x={x(hv.m)! - 1} y={y(hv.dv)! - 1} width={x.bandwidth() + 2} height={y.bandwidth() + 2} fill="none" stroke={t.stock} strokeWidth={2} rx={2} pointerEvents="none" />
            )}
            {VOLS.filter((v) => v % 2 === 0).map((dv) => (
              <text key={dv} x={-6} y={y(dv)! + y.bandwidth() / 2} dy="0.32em" textAnchor="end" fontSize={10.5} fill={t.muted}>
                {dv > 0 ? `+${dv}` : dv < 0 ? `−${-dv}` : '0'}
              </text>
            ))}
            {MOVES.filter((mv) => mv % (narrow ? 5 : 2) === 0).map((mv) => (
              <text key={mv} x={x(mv)! + x.bandwidth() / 2} y={ih + 14} textAnchor="middle" fontSize={10.5} fill={t.muted}>
                {mv > 0 ? `+${mv}%` : mv < 0 ? `−${-mv}%` : '0'}
              </text>
            ))}
            <text x={iw / 2} y={ih + 32} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              SPY move from {S0.toFixed(2)}
            </text>
            <text transform={`translate(${narrow ? -30 : -40},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              IV change (vol pts)
            </text>
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hv && (
          <div
            className="viz-tip"
            style={{
              left: Math.max(0, Math.min(m.left + x(hv.m)! + x.bandwidth() + 8, width - 190)),
              top: m.top + y(hv.dv)! + (hover!.j > VOLS.length / 2 ? -64 : 18),
            }}
          >
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              SPY {hv.m >= 0 ? '+' : '−'}
              {Math.abs(hv.m)}% → {(S0 * (1 + hv.m / 100)).toFixed(2)}
            </div>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              IV {hv.dv >= 0 ? '+' : '−'}
              {Math.abs(hv.dv)} pts, day {days}
            </div>
            <div>
              P/L: <b>{sgn0(hv.v)}</b>
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.75rem] text-(--sl-color-gray-3) tabular-nums">
        <span>{sgn0(-ext)}</span>
        <span
          className="inline-block h-2.5 w-40 rounded-sm"
          style={{ background: `linear-gradient(90deg, ${color(-ext)}, ${color(-ext / 3)}, ${t.surface}, ${color(ext / 3)}, ${color(ext)})`, border: `1px solid ${t.grid}` }}
        />
        <span>{sgn0(ext)}</span>
        <span className="ml-2">Outlined cell: no move, no vol change. Worst cell {sgn0(lo)}, best {sgn0(hi)}.</span>
      </div>
      <p className="mt-1 text-[0.75rem] text-(--sl-color-gray-3)">
        P/L is measured against the model value at the snapshot (each option at its quoted IV), so the center cell at day 0 is zero. IVs move in parallel; the smile does not reshape.
      </p>
    </div>
  );
}
