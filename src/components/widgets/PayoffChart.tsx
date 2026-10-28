import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line, area, extent } from 'd3';
import { positionPnlAtExpiry, breakevens, bs, type Leg } from '../../lib/pricing';
import { useTokens, useWidth } from '../../lib/useViz';

export interface PricedLeg {
  leg: Leg;
  /** IV used for the "today" curve; ignored for stock */
  iv?: number;
}

interface Props {
  legs: PricedLeg[];
  lo: number;
  hi: number;
  height?: number;
  /** Mark the current underlying price */
  spot?: number;
  /** Plot value before expiry too: {T in years, r} */
  today?: { T: number; r: number } | null;
  /** Contract multiplier for the y axis (100 = per contract) */
  multiplier?: number;
  compact?: boolean;
  ariaLabel?: string;
}

const N = 241;

export default function PayoffChart({
  legs, lo, hi, height = 320, spot, today = null, multiplier = 100, compact = false, ariaLabel,
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hoverX, setHoverX] = useState<number | null>(null);

  const m = compact
    ? { top: 20, right: 10, bottom: 26, left: 50 }
    : { top: 16, right: 16, bottom: 40, left: 78 };
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;

  const raw = legs.map((p) => p.leg);
  const data = useMemo(() => {
    const xs = Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1));
    return xs.map((s) => {
      const exp = positionPnlAtExpiry(raw, s) * multiplier;
      let now: number | null = null;
      if (today) {
        now = legs.reduce((acc, { leg, iv }) => {
          if (leg.kind === 'stock') return acc + leg.qty * (s - leg.entry);
          const v = bs(leg.right, { S: s, K: leg.K, T: today.T, r: today.r, sigma: iv ?? 0.15 }).price;
          return acc + leg.qty * (v - leg.premium);
        }, 0) * multiplier;
      }
      return { s, exp, now };
    });
  }, [JSON.stringify(legs), lo, hi, today?.T, today?.r, multiplier]);

  const be = useMemo(() => breakevens(raw, lo, hi), [JSON.stringify(raw), lo, hi]);

  const yVals = data.flatMap((d) => (d.now === null ? [d.exp] : [d.exp, d.now]));
  const [y0, y1] = extent([...yVals, 0]) as [number, number];
  const pad = (y1 - y0) * 0.08 || 50;
  const x = scaleLinear().domain([lo, hi]).range([0, iw]);
  const y = scaleLinear().domain([y0 - pad, y1 + pad]).nice().range([ih, 0]);

  const lineExp = line<(typeof data)[0]>().x((d) => x(d.s)).y((d) => y(d.exp))(data) ?? '';
  const lineNow = today
    ? line<(typeof data)[0]>().x((d) => x(d.s)).y((d) => y(d.now!))(data) ?? ''
    : '';
  const profitArea = area<(typeof data)[0]>().x((d) => x(d.s)).y0(y(0)).y1((d) => y(Math.max(d.exp, 0)))(data) ?? '';
  const lossArea = area<(typeof data)[0]>().x((d) => x(d.s)).y0(y(0)).y1((d) => y(Math.min(d.exp, 0)))(data) ?? '';

  const xTicks = x.ticks(compact ? 4 : Math.max(3, Math.floor(iw / 90)));
  const yTicks = y.ticks(compact ? 4 : 6);
  const fmtK = (v: number) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}$${Math.abs(v) / 1000}k`);
  const fmtMoney = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString()}`;

  const hover = hoverX === null ? null : data[Math.round(((hoverX - lo) / (hi - lo)) * (N - 1))];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    setHoverX(Math.min(hi, Math.max(lo, x.invert(px))));
  }

  return (
    <div ref={wrap} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel ?? 'Profit and loss at expiration'}
        style={{ display: 'block', touchAction: 'pan-y' }}
      >
        <g transform={`translate(${m.left},${m.top})`}>
          {yTicks.map((v) => (
            <g key={`y${v}`} transform={`translate(0,${y(v)})`}>
              <line x2={iw} stroke={v === 0 ? t.axis : t.grid} strokeWidth={v === 0 ? 1.25 : 1} />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={compact ? 10 : 11} fill={t.muted}>
                {compact ? fmtK(v) : fmtMoney(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={x(v)} y={ih + (compact ? 16 : 20)} textAnchor="middle" fontSize={compact ? 10 : 11} fill={t.muted}>
              {v}
            </text>
          ))}
          {!compact && (
            <>
              <text x={iw / 2} y={ih + 36} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
                SPY price at expiration
              </text>
              <text transform={`translate(${-66},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
                Profit / loss per contract
              </text>
            </>
          )}

          <path d={profitArea} fill={t['profit-wash']} />
          <path d={lossArea} fill={t['loss-wash']} />

          {spot !== undefined && spot >= lo && spot <= hi && (
            <g transform={`translate(${x(spot)},0)`}>
              <line y2={ih} stroke={t.muted} strokeDasharray="3 3" />
              <text y={-4} textAnchor="middle" fontSize={10} fill={t.muted}>
                today {spot.toFixed(2)}
              </text>
            </g>
          )}

          {today && <path d={lineNow} fill="none" stroke={t.stock} strokeWidth={2} strokeDasharray="5 4" />}
          <path d={lineExp} fill="none" stroke={t.ink} strokeWidth={2} strokeLinejoin="round" />

          {!compact &&
            be.map((b) => (
              <g key={b} transform={`translate(${x(b)},${y(0)})`}>
                <circle r={4.5} fill={t.surface} stroke={t.ink} strokeWidth={2} />
                <text y={-10} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={t['ink-2']}>
                  BE {b.toFixed(2)}
                </text>
              </g>
            ))}

          {hover && (
            <g transform={`translate(${x(hover.s)},0)`} pointerEvents="none">
              <line y2={ih} stroke={t['ink-2']} strokeWidth={1} />
              <circle cy={y(hover.exp)} r={4} fill={t.ink} stroke={t.surface} strokeWidth={2} />
              {hover.now !== null && <circle cy={y(hover.now)} r={4} fill={t.stock} stroke={t.surface} strokeWidth={2} />}
            </g>
          )}

          <rect
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHoverX(null)}
          />
        </g>
      </svg>

      {hover && (
        <div
          className="viz-tip"
          style={{
            left: Math.min(Math.max(m.left + x(hover.s) + 12, 0), width - 170),
            top: m.top + 4,
          }}
        >
          <div style={{ color: 'var(--sl-color-gray-3)' }}>SPY at {hover.s.toFixed(2)}</div>
          <div>
            At expiry: <b>{fmtMoney(hover.exp)}</b>
          </div>
          {hover.now !== null && (
            <div>
              Today: <b>{fmtMoney(hover.now)}</b>
            </div>
          )}
        </div>
      )}

      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.78rem] text-(--sl-color-gray-3)">
          <span className="inline-flex items-center gap-1.5">
            <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={t.ink} strokeWidth="2" /></svg>
            At expiration
          </span>
          {today && (
            <span className="inline-flex items-center gap-1.5">
              <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={t.stock} strokeWidth="2" strokeDasharray="5 4" /></svg>
              Value today (model)
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: t['profit-wash'], outline: `1px solid ${t.profit}` }} />
            Profit zone
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: t['loss-wash'], outline: `1px solid ${t.loss}` }} />
            Loss zone
          </span>
        </div>
      )}
    </div>
  );
}

