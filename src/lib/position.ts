/**
 * Multi-leg positions valued before expiry. Builds on pricing.ts so every
 * spread, hedge and risk widget agrees with the single-option widgets.
 */
import { bs, intrinsic, type Right } from './pricing';

export interface OptLeg {
  kind: 'option';
  right: Right;
  K: number;
  /** + long, - short (contracts or units, caller decides) */
  qty: number;
  /** price paid (+) or received for one unit */
  premium: number;
  /** years to this leg's expiry at time zero */
  T: number;
  /** implied vol used to value this leg */
  iv: number;
}
export interface StockLeg {
  kind: 'stock';
  qty: number;
  entry: number;
}
export type PLeg = OptLeg | StockLeg;

export interface ValueOpts {
  /** underlying price */
  S: number;
  /** years elapsed since time zero */
  elapsed?: number;
  r: number;
  /** shift added to every leg's iv (e.g. +0.02 for +2 vol points) */
  volShift?: number;
  q?: number;
}

/** Profit/loss of the position (per unit, before multiplier) at price S after `elapsed` years. */
export function positionPnl(legs: PLeg[], o: ValueOpts): number {
  const { S, elapsed = 0, r, volShift = 0, q = 0 } = o;
  let pnl = 0;
  for (const leg of legs) {
    if (leg.kind === 'stock') {
      pnl += leg.qty * (S - leg.entry);
      continue;
    }
    const t = leg.T - elapsed;
    const v = t <= 1e-9 ? intrinsic(leg.right, S, leg.K) : bs(leg.right, { S, K: leg.K, T: t, r, q, sigma: Math.max(leg.iv + volShift, 0.001) }).price;
    pnl += leg.qty * (v - leg.premium);
  }
  return pnl;
}

export interface PosGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

/** Aggregate Greeks (per unit, before multiplier). Stock contributes delta = qty. */
export function positionGreeks(legs: PLeg[], o: ValueOpts): PosGreeks {
  const { S, elapsed = 0, r, volShift = 0, q = 0 } = o;
  const g: PosGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  for (const leg of legs) {
    if (leg.kind === 'stock') {
      g.delta += leg.qty;
      continue;
    }
    const t = leg.T - elapsed;
    if (t <= 1e-9) {
      const itm = leg.right === 'call' ? S > leg.K : S < leg.K;
      g.delta += leg.qty * (itm ? (leg.right === 'call' ? 1 : -1) : 0);
      continue;
    }
    const x = bs(leg.right, { S, K: leg.K, T: t, r, q, sigma: Math.max(leg.iv + volShift, 0.001) });
    g.delta += leg.qty * x.delta;
    g.gamma += leg.qty * x.gamma;
    g.theta += leg.qty * x.theta;
    g.vega += leg.qty * x.vega;
    g.rho += leg.qty * x.rho;
  }
  return g;
}

/** Net premium paid (+) or received (-) per unit. */
export function netPremium(legs: PLeg[]): number {
  return legs.reduce((a, l) => (l.kind === 'option' ? a + l.qty * l.premium : a), 0);
}

/* ---------------- Binomial (Cox-Ross-Rubinstein) ---------------- */

export interface BinomialResult {
  price: number;
  /** tree[i][j] = underlying price at step i, node j (j up-moves) */
  stock: number[][];
  /** option value at each node */
  value: number[][];
  /** true where early exercise is optimal (American only) */
  exercised: boolean[][];
}

export function binomial(
  right: Right,
  p: { S: number; K: number; T: number; r: number; sigma: number; q?: number; steps: number; american?: boolean },
): BinomialResult {
  const { S, K, T, r, sigma, q = 0, steps, american = false } = p;
  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const pu = (Math.exp((r - q) * dt) - d) / (u - d);
  const disc = Math.exp(-r * dt);
  const stock: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    stock.push(Array.from({ length: i + 1 }, (_, j) => S * u ** j * d ** (i - j)));
  }
  const value: number[][] = stock.map((row) => row.map(() => 0));
  const exercised: boolean[][] = stock.map((row) => row.map(() => false));
  value[steps] = stock[steps].map((s) => intrinsic(right, s, K));
  exercised[steps] = value[steps].map((v) => v > 0);
  for (let i = steps - 1; i >= 0; i--) {
    for (let j = 0; j <= i; j++) {
      const cont = disc * (pu * value[i + 1][j + 1] + (1 - pu) * value[i + 1][j]);
      const ex = intrinsic(right, stock[i][j], K);
      if (american && ex > cont) {
        value[i][j] = ex;
        exercised[i][j] = true;
      } else value[i][j] = cont;
    }
  }
  return { price: value[0][0], stock, value, exercised };
}

/* ---------------- Random paths (deterministic, seeded) ---------------- */

/** Mulberry32: small fast seeded RNG so figures look identical on every load. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draws via Box-Muller. */
export function normalSampler(seed: number) {
  const u = rng(seed);
  return () => {
    let a = 0;
    while (a === 0) a = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
  };
}

/** Geometric Brownian motion path with `n` daily steps (252/yr). Returns n+1 prices. */
export function gbmPath(S0: number, sigma: number, n: number, seed: number, mu = 0): number[] {
  const z = normalSampler(seed);
  const dt = 1 / 252;
  const out = [S0];
  for (let i = 0; i < n; i++) out.push(out[i] * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z()));
  return out;
}

/** Lognormal density of S_T given S0, sigma, T (zero drift in log terms adjusted for convexity). */
export function lognormalPdf(x: number, S0: number, sigma: number, T: number, mu = 0): number {
  if (x <= 0) return 0;
  const m = Math.log(S0) + (mu - 0.5 * sigma * sigma) * T;
  const s = sigma * Math.sqrt(T);
  return Math.exp(-((Math.log(x) - m) ** 2) / (2 * s * s)) / (x * s * Math.sqrt(2 * Math.PI));
}
