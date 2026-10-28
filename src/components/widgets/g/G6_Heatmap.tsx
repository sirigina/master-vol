import { useRef, useState, type ReactNode } from 'react';
import { scaleBand, interpolateRgb } from 'd3';
import { useTokens, useWidth } from '../../../lib/useViz';

interface Props {
  /** column labels (x) and row labels (y, top to bottom) */
  cols: string[];
  rows: string[];
  /** values[row][col]; null = not applicable */
  values: (number | null)[][];
  xLabel: string;
  yLabel: string;
  /** diverging around zero (profit/loss) or sequential (higher = better) */
  mode: 'diverging' | 'sequential';
  fmtCell: (v: number) => string;
  tip: (r: number, c: number, v: number) => ReactNode;
  ariaLabel: string;
  highlight?: [number, number] | null;
  cellH?: number;
  /** show numbers in cells when there's room */
  showText?: boolean;
}

/** Grid heatmap shared by module G (part 2) figures. */
export default function Heatmap({ cols, rows, values, xLabel, yLabel, mode, fmtCell, tip, ariaLabel, highlight = null, cellH = 30, showText = true }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hv, setHv] = useState<[number, number] | null>(null);
  const narrow = width < 520;
  const m = { top: 8, right: 8, bottom: 40, left: narrow ? 50 : 64 };
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = rows.length * cellH;
  const height = ih + m.top + m.bottom;
  const x = scaleBand<number>().domain(cols.map((_, i) => i)).range([0, iw]).padding(0.04);
  const y = scaleBand<number>().domain(rows.map((_, i) => i)).range([0, ih]).padding(0.06);

  const flat = values.flat().filter((v): v is number => v !== null);
  const maxAbs = Math.max(...flat.map(Math.abs), 1e-9);
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  const pos = interpolateRgb(t.surface, t.profit);
  const neg = interpolateRgb(t.surface, t.loss);
  const seq = interpolateRgb(t.surface, t.call);
  const color = (v: number) => {
    if (mode === 'sequential') return seq(0.12 + 0.88 * ((v - lo) / (hi - lo || 1)));
    const k = Math.min(Math.abs(v) / maxAbs, 1) ** 0.75;
    return v >= 0 ? pos(0.1 + 0.8 * k) : neg(0.1 + 0.8 * k);
  };
  const strong = (v: number) => (mode === 'sequential' ? (v - lo) / (hi - lo || 1) > 0.6 : Math.abs(v) / maxAbs > 0.55);
  const textOn = showText && x.bandwidth() > (narrow ? 30 : 27);
  const everyX = Math.ceil(cols.length / Math.max(3, Math.floor(iw / 46)));

  return (
    <div ref={wrap} className="relative w-full" onPointerLeave={() => setHv(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block', touchAction: 'pan-y' }}>
        <g transform={`translate(${m.left},${m.top})`}>
          {values.map((row, ri) =>
            row.map((v, ci) =>
              v === null ? (
                <rect key={`${ri}-${ci}`} x={x(ci)} y={y(ri)} width={x.bandwidth()} height={y.bandwidth()} fill={t.grid} opacity={0.35} rx={2} />
              ) : (
                <g key={`${ri}-${ci}`}>
                  <rect
                    x={x(ci)}
                    y={y(ri)}
                    width={x.bandwidth()}
                    height={y.bandwidth()}
                    rx={2}
                    fill={color(v)}
                    stroke={highlight && highlight[0] === ri && highlight[1] === ci ? t.ink : hv && hv[0] === ri && hv[1] === ci ? t['ink-2'] : 'none'}
                    strokeWidth={2}
                    onPointerEnter={() => setHv([ri, ci])}
                    onPointerDown={() => setHv([ri, ci])}
                  />
                  {textOn && (
                    <text
                      x={(x(ci) ?? 0) + x.bandwidth() / 2}
                      y={(y(ri) ?? 0) + y.bandwidth() / 2}
                      dy="0.34em"
                      textAnchor="middle"
                      fontSize={x.bandwidth() < 36 ? 9 : 10}
                      fill={strong(v) ? t.surface : t.ink}
                      pointerEvents="none"
                    >
                      {fmtCell(v)}
                    </text>
                  )}
                </g>
              ),
            ),
          )}
          {rows.map((r, ri) => (
            <text key={r} x={-6} y={(y(ri) ?? 0) + y.bandwidth() / 2} dy="0.32em" textAnchor="end" fontSize={narrow ? 10 : 11} fill={t.muted}>
              {r}
            </text>
          ))}
          {cols.map((c, ci) =>
            ci % everyX === 0 ? (
              <text key={c} x={(x(ci) ?? 0) + x.bandwidth() / 2} y={ih + 15} textAnchor="middle" fontSize={narrow ? 10 : 11} fill={t.muted}>
                {c}
              </text>
            ) : null,
          )}
          <text x={iw / 2} y={ih + 33} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
            {xLabel}
          </text>
          {!narrow && (
            <text transform={`translate(${-50},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              {yLabel}
            </text>
          )}
        </g>
      </svg>
      {narrow && <div className="-mt-1 text-[0.75rem] text-(--sl-color-gray-3)">Rows: {yLabel}</div>}
      {hv && values[hv[0]][hv[1]] !== null && (
        <div
          className="viz-tip"
          style={{
            left: Math.min(Math.max(m.left + (x(hv[1]) ?? 0) + x.bandwidth() + 6, 0), width - 200),
            top: Math.max(m.top + (y(hv[0]) ?? 0) - 50, 0),
          }}
        >
          {tip(hv[0], hv[1], values[hv[0]][hv[1]] as number)}
        </div>
      )}
    </div>
  );
}
