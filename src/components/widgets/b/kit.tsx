/**
 * Module B helpers: small chart scaffolding shared by the B-lesson widgets.
 * Colors always come from useTokens(); nothing here hard-codes a hex value.
 */
import type { ReactNode } from 'react';
import type { ScaleLinear } from 'd3';
import type { Tokens } from '../../../lib/useViz';
import { bs, normCdf } from '../../../lib/pricing';

export const fmtSigned = (v: number, d = 2) => {
  const z = Math.abs(v) < 0.5 * 10 ** -d;
  return `${z ? '' : v > 0 ? '+' : '−'}${Math.abs(z ? 0 : v).toFixed(d)}`;
};
export const usd = (v: number, d = 2) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(d)}`;

/** Horizontal gridlines + left tick labels. */
export function YAxis({
  y,
  width,
  t,
  ticks = 5,
  format = (v: number) => String(v),
  label,
}: {
  y: ScaleLinear<number, number>;
  width: number;
  t: Tokens;
  ticks?: number;
  format?: (v: number) => string;
  label?: string;
}) {
  return (
    <g>
      {y.ticks(ticks).map((v) => (
        <g key={v} transform={`translate(0,${y(v)})`}>
          <line x2={width} stroke={t.grid} />
          <text x={-7} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
            {format(v)}
          </text>
        </g>
      ))}
      {label && (
        <text x={-7} y={-8} textAnchor="start" fontSize={11} fill={t['ink-2']} transform="translate(0,0)">
          {label}
        </text>
      )}
    </g>
  );
}

/** Bottom tick labels and an axis line. */
export function XAxis({
  x,
  height,
  t,
  ticks = 6,
  format = (v: number) => String(v),
  label,
  width,
}: {
  x: ScaleLinear<number, number>;
  height: number;
  t: Tokens;
  ticks?: number;
  format?: (v: number) => string;
  label?: string;
  width: number;
}) {
  return (
    <g>
      <line y1={height} y2={height} x2={width} stroke={t.axis} />
      {x.ticks(ticks).map((v) => (
        <text key={v} x={x(v)} y={height + 17} textAnchor="middle" fontSize={11} fill={t.muted}>
          {format(v)}
        </text>
      ))}
      {label && (
        <text x={width} y={height + 33} textAnchor="end" fontSize={11} fill={t['ink-2']}>
          {label}
        </text>
      )}
    </g>
  );
}

/** A labelled number tile (same look as StatGrid, but usable one at a time). */
export function Tile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-(--sl-color-hairline) px-3 py-2" style={accent ? { borderColor: accent } : undefined}>
      <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">{label}</div>
      <div className="text-[0.95rem] font-semibold tabular-nums text-(--sl-color-white)">{value}</div>
      {sub && <div className="text-[0.75rem] text-(--sl-color-gray-3)">{sub}</div>}
    </div>
  );
}

/** Small text button in the site style. */
export function Btn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-md border border-(--sl-color-gray-5) bg-(--sl-color-bg) px-2.5 py-1 text-[0.8rem] font-medium text-(--sl-color-white) hover:bg-(--sl-color-gray-6)"
    >
      {children}
    </button>
  );
}

/** Black-Scholes d1, d2 and the two building blocks of a call. */
export function bsParts(p: { S: number; K: number; T: number; r: number; sigma: number; q?: number }) {
  const { S, K, T, r, sigma, q = 0 } = p;
  const vt = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / vt;
  const d2 = d1 - vt;
  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  const stockLeg = S * Math.exp(-q * T) * Nd1;
  const strikeLeg = K * Math.exp(-r * T) * Nd2;
  return { d1, d2, Nd1, Nd2, stockLeg, strikeLeg, call: stockLeg - strikeLeg };
}

/** Bisection implied vol that never returns NaN for in-bounds prices (for charts). */
export function ivSafe(right: 'call' | 'put', target: number, p: { S: number; K: number; T: number; r: number; q?: number }) {
  let lo = 0.001;
  let hi = 3;
  for (let i = 0; i < 80; i++) {
    const m = 0.5 * (lo + hi);
    if (bs(right, { ...p, sigma: m }).price > target) hi = m;
    else lo = m;
  }
  return 0.5 * (lo + hi);
}

/** Lognormal density of S_T with drift mu (risk-neutral: mu = r - q). */
export function lnPdf(x: number, S0: number, sigma: number, T: number, mu: number) {
  if (x <= 0) return 0;
  const m = Math.log(S0) + (mu - 0.5 * sigma * sigma) * T;
  const s = sigma * Math.sqrt(T);
  return Math.exp(-((Math.log(x) - m) ** 2) / (2 * s * s)) / (x * s * Math.sqrt(2 * Math.PI));
}
