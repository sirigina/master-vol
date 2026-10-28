/** H1: three volatility spreads valued at a forecast volatility. */
import { bs, type Right } from '../../../lib/pricing';
import { normalSampler } from '../../../lib/position';
import { snapshot, callAt, putAt, atmIv, T_EXPIRY } from '../../../lib/snapshot';

export type SLeg = [right: Right, K: number, qty: number];
export interface Spread {
  id: string;
  label: string;
  short: string;
  legs: SLeg[];
}

export const SPREADS: Spread[] = [
  { id: 'straddle', label: 'Long 770 straddle', short: 'Straddle', legs: [['call', 770, 1], ['put', 770, 1]] },
  { id: 'strangle', label: 'Long 750/790 strangle', short: 'Strangle', legs: [['put', 750, 1], ['call', 790, 1]] },
  { id: 'backspread', label: '1×2 call backspread 770/790', short: 'Backspread', legs: [['call', 770, -1], ['call', 790, 2]] },
];

const S0 = snapshot.spot;
const r = snapshot.rate;
const T = T_EXPIRY;
const q = (right: Right, K: number) => (right === 'call' ? callAt(K)! : putAt(K)!);

/** Entry cost per share at marks (+ debit, − credit). */
export const spreadCost = (s: Spread) => s.legs.reduce((a, [rt, K, n]) => a + n * q(rt, K).mark, 0);

export type VolMode = 'flat' | 'skew';
/** IV used for a leg under a forecast: flat = one vol for every strike; skew = market IV shifted in parallel. */
export function legVol(mode: VolMode, forecast: number, right: Right, K: number): number {
  return mode === 'flat' ? forecast : Math.max(q(right, K).iv + (forecast - atmIv), 0.005);
}

export function spreadModel(s: Spread, forecast: number, mode: VolMode = 'flat') {
  const out = { value: 0, delta: 0, gamma: 0, theta: 0, vega: 0 };
  for (const [rt, K, n] of s.legs) {
    const g = bs(rt, { S: S0, K, T, r, sigma: legVol(mode, forecast, rt, K) });
    out.value += n * g.price;
    out.delta += n * g.delta;
    out.gamma += n * g.gamma;
    out.theta += n * g.theta;
    out.vega += n * g.vega;
  }
  return { ...out, edge: out.value - spreadCost(s) };
}

/**
 * Forecast volatility above which edge stays positive: the last − to + crossing
 * on a 4%–60% scan. NaN when edge is positive across the whole scan.
 */
export function breakevenVol(s: Spread, mode: VolMode = 'flat'): number {
  const f = (v: number) => spreadModel(s, v, mode).edge;
  let found = NaN;
  let prev = f(0.04);
  for (let v = 0.045; v <= 0.6 + 1e-9; v += 0.005) {
    const cur = f(v);
    if (prev < 0 && cur >= 0) {
      let lo = v - 0.005;
      let hi = v;
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        if (f(m) >= 0) hi = m;
        else lo = m;
      }
      found = (lo + hi) / 2;
    }
    prev = cur;
  }
  return found;
}

export const payoffAt = (s: Spread, ST: number) =>
  s.legs.reduce((a, [rt, K, n]) => a + n * (rt === 'call' ? Math.max(ST - K, 0) : Math.max(K - ST, 0)), 0) - spreadCost(s);

/** Max loss at expiry per contract (scan of expiry prices). */
export function maxLoss(s: Spread): number {
  let m = Infinity;
  for (let x = 500; x <= 1100; x += 0.5) m = Math.min(m, payoffAt(s, x));
  return m * 100;
}

/** Seeded standard normal draws, antithetic pairs (z, −z) to cut sampling noise. */
const Z: number[] = (() => {
  const z = normalSampler(7);
  const out: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const v = z();
    out.push(v, -v);
  }
  return out;
})();

/** Lognormal (drift r) expiry prices at the forecast vol; same draws for every spread and forecast. */
export function simulate(forecast: number): number[] {
  const m = (r - 0.5 * forecast * forecast) * T;
  const sd = forecast * Math.sqrt(T);
  return Z.map((z) => S0 * Math.exp(m + sd * z));
}

export function distStats(pl: number[]) {
  const s = [...pl].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  return {
    mean,
    pWin: s.filter((x) => x > 0).length / n,
    p5: s[Math.floor(n * 0.05)],
    p50: s[Math.floor(n * 0.5)],
    p95: s[Math.floor(n * 0.95)],
  };
}
