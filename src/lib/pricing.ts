/**
 * Shared pricing engine. Every widget on the site prices options through this
 * module so numbers agree across lessons.
 *
 * Conventions
 *   S  underlying price        K  strike
 *   T  time to expiry, years   r  continuously compounded rate
 *   q  continuous dividend yield
 *   sigma  annualized volatility (0.15 = 15%)
 * Greeks are reported per 1 unit of S (delta, gamma), per 1 calendar day
 * (theta), and per 1 volatility point (vega), the way trading screens show them.
 */

export type Right = 'call' | 'put';

export interface Inputs {
  S: number;
  K: number;
  T: number;
  r: number;
  sigma: number;
  q?: number;
}

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  /** per calendar day */
  theta: number;
  /** per 1 vol point */
  vega: number;
  /** per 1 rate point */
  rho: number;
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** Standard normal CDF (Hart / West double-precision approximation, |err| < 1e-14). */
export function normCdf(x: number): number {
  const z = Math.abs(x);
  let c: number;
  if (z > 37) {
    c = 0;
  } else {
    const e = Math.exp(-0.5 * z * z);
    if (z < 7.07106781186547) {
      let n = 3.52624965998911e-2 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      let d = 8.83883476483184e-2 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * n) / d;
    } else {
      let f = z + 0.65;
      f = z + 4 / f;
      f = z + 3 / f;
      f = z + 2 / f;
      f = z + 1 / f;
      c = e / f / 2.506628274631;
    }
  }
  return x <= 0 ? c : 1 - c;
}

function d1d2({ S, K, T, r, sigma, q = 0 }: Inputs) {
  const vt = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / vt;
  return { d1, d2: d1 - vt, vt };
}

/** Value at expiration (T = 0). */
export function intrinsic(right: Right, S: number, K: number): number {
  return right === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
}

/** Black-Scholes-Merton price and Greeks for a European option. */
export function bs(right: Right, inp: Inputs): Greeks {
  const { S, K, T, r, sigma, q = 0 } = inp;
  if (T <= 0 || sigma <= 0) {
    const price = intrinsic(right, S, K);
    const itm = right === 'call' ? S > K : S < K;
    return { price, delta: itm ? (right === 'call' ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  const { d1, d2 } = d1d2(inp);
  const dfq = Math.exp(-q * T);
  const dfr = Math.exp(-r * T);
  const sqrtT = Math.sqrt(T);
  const pdf = normPdf(d1);
  const gamma = (dfq * pdf) / (S * sigma * sqrtT);
  const vega = (S * dfq * pdf * sqrtT) / 100;
  const decay = -(S * dfq * pdf * sigma) / (2 * sqrtT);

  if (right === 'call') {
    const Nd1 = normCdf(d1);
    const Nd2 = normCdf(d2);
    return {
      price: S * dfq * Nd1 - K * dfr * Nd2,
      delta: dfq * Nd1,
      gamma,
      theta: (decay - r * K * dfr * Nd2 + q * S * dfq * Nd1) / 365,
      vega,
      rho: (K * T * dfr * Nd2) / 100,
    };
  }
  const Nmd1 = normCdf(-d1);
  const Nmd2 = normCdf(-d2);
  return {
    price: K * dfr * Nmd2 - S * dfq * Nmd1,
    delta: -dfq * Nmd1,
    gamma,
    theta: (decay + r * K * dfr * Nmd2 - q * S * dfq * Nmd1) / 365,
    vega,
    rho: (-K * T * dfr * Nmd2) / 100,
  };
}

export const price = (right: Right, inp: Inputs) => bs(right, inp).price;

/**
 * Implied volatility by safeguarded Newton (falls back to bisection).
 * Returns NaN when the price is outside no-arbitrage bounds.
 */
export function impliedVol(right: Right, target: number, inp: Omit<Inputs, 'sigma'>): number {
  const { S, K, T, r, q = 0 } = inp;
  const fwdIntrinsic =
    right === 'call'
      ? Math.max(S * Math.exp(-q * T) - K * Math.exp(-r * T), 0)
      : Math.max(K * Math.exp(-r * T) - S * Math.exp(-q * T), 0);
  const upper = right === 'call' ? S * Math.exp(-q * T) : K * Math.exp(-r * T);
  if (target <= fwdIntrinsic || target >= upper) return NaN;

  let lo = 1e-4;
  let hi = 5;
  let sigma = 0.2;
  for (let i = 0; i < 100; i++) {
    const g = bs(right, { S, K, T, r, q, sigma });
    const diff = g.price - target;
    if (Math.abs(diff) < 1e-8) return sigma;
    if (diff > 0) hi = sigma;
    else lo = sigma;
    const vegaRaw = g.vega * 100;
    let next = vegaRaw > 1e-10 ? sigma - diff / vegaRaw : NaN;
    if (!(next > lo && next < hi)) next = 0.5 * (lo + hi);
    sigma = next;
  }
  return sigma;
}

/* ---------------- Positions & payoffs ---------------- */

export type Leg =
  | { kind: 'option'; right: Right; K: number; qty: number; premium: number }
  | { kind: 'stock'; qty: number; entry: number };

/** Profit/loss per share-equivalent at expiration for one leg (qty > 0 long, < 0 short). */
export function legPnlAtExpiry(leg: Leg, S: number): number {
  if (leg.kind === 'stock') return leg.qty * (S - leg.entry);
  return leg.qty * (intrinsic(leg.right, S, leg.K) - leg.premium);
}

export function positionPnlAtExpiry(legs: Leg[], S: number): number {
  return legs.reduce((sum, leg) => sum + legPnlAtExpiry(leg, S), 0);
}

/** Breakeven prices: sign changes of the expiry P/L across [lo, hi]. */
export function breakevens(legs: Leg[], lo: number, hi: number, steps = 4000): number[] {
  const out: number[] = [];
  const dx = (hi - lo) / steps;
  let prevS = lo;
  let prev = positionPnlAtExpiry(legs, lo);
  for (let i = 1; i <= steps; i++) {
    const s = lo + i * dx;
    const v = positionPnlAtExpiry(legs, s);
    if (prev === 0) out.push(prevS);
    else if (prev * v < 0) out.push(prevS + (dx * Math.abs(prev)) / (Math.abs(prev) + Math.abs(v)));
    prev = v;
    prevS = s;
  }
  return out.filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > dx * 2);
}

/* ---------------- Volatility helpers ---------------- */

export const TRADING_DAYS = 252;

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push(Math.log(closes[i] / closes[i - 1]));
  return out;
}

/** Sample standard deviation. */
export function stdev(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = xs.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
}

/** Annualized close-to-close realized volatility. */
export function realizedVol(closes: number[]): number {
  return stdev(logReturns(closes)) * Math.sqrt(TRADING_DAYS);
}

/** Rolling annualized realized vol; value i uses the `window` returns ending at close i. */
export function rollingVol(closes: number[], window: number): (number | null)[] {
  const r = logReturns(closes);
  return closes.map((_, i) => (i < window ? null : stdev(r.slice(i - window, i)) * Math.sqrt(TRADING_DAYS)));
}

/** One-standard-deviation move in price terms over `days` trading days. */
export function expectedMove(S: number, sigma: number, days: number): number {
  return S * sigma * Math.sqrt(days / TRADING_DAYS);
}
