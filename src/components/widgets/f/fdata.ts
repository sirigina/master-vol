/**
 * Module F helpers: parity, synthetics, boxes, early-exercise premium.
 * Everything reads the shared snapshot so the six lessons agree.
 */
import { snapshot, type ChainRow } from '../../../lib/snapshot';
import { binomial } from '../../../lib/position';
import { bs } from '../../../lib/pricing';

export const S0 = snapshot.spot;
export const R = snapshot.rate;
export const T1 = snapshot.chain.dte / 365;
export const T2 = snapshot.chain2.dte / 365;
/** SPY trades a penny wide; the snapshot stores only the close, so we assume this quote. */
export const STOCK_BID = Math.round((S0 - 0.01) * 100) / 100;
export const STOCK_ASK = Math.round((S0 + 0.01) * 100) / 100;
/** Assumed next SPY quarterly dividend (≈1.1%/yr), ex-date usually the third Friday of December. */
export const DIV = 2.1;

export type Expiry = 'nov' | 'dec';
export const chainOf = (e: Expiry) => (e === 'nov' ? snapshot.chain : snapshot.chain2);
export const tOf = (e: Expiry) => (e === 'nov' ? T1 : T2);

export interface Pair {
  K: number;
  call: ChainRow;
  put: ChainRow;
}
/** Strikes quoted for both a call and a put. */
export function pairs(e: Expiry): Pair[] {
  const c = chainOf(e);
  return c.calls
    .filter((x) => c.puts.some((p) => p.strike === x.strike))
    .map((x) => ({ K: x.strike, call: x, put: c.puts.find((p) => p.strike === x.strike)! }));
}
export const pairAt = (e: Expiry, K: number) => pairs(e).find((p) => p.K === K)!;

/** Financing rate implied by C − P = S − PV(div) − K·e^(−rT). */
export function impliedRate(cMinusP: number, K: number, T: number, S = S0, pvDiv = 0): number {
  const x = S - pvDiv - cMinusP;
  return -Math.log(x / K) / T;
}

/** Rate range a trader could actually lock in: best case and worst case after crossing spreads. */
export function rateBand(p: Pair, T: number, pvDiv = 0) {
  // Buying the synthetic (call at ask, put at bid) is cheapest-rate side; selling it the other.
  const hi = impliedRate(p.call.bid - p.put.ask, p.K, T, S0, pvDiv);
  const lo = impliedRate(p.call.ask - p.put.bid, p.K, T, S0, pvDiv);
  return { lo, hi };
}

/** Early-exercise premium of an American put (binomial American − binomial European). */
export function putEep(K: number, T: number, sigma: number, r = R, S = S0, steps = 300): number {
  const a = binomial('put', { S, K, T, r, sigma, steps, american: true }).price;
  const e = binomial('put', { S, K, T, r, sigma, steps }).price;
  return Math.max(a - e, 0);
}

/** Black-Scholes European put, used for comparisons. */
export const euroPut = (K: number, T: number, sigma: number, r = R, S = S0) => bs('put', { S, K, T, r, sigma }).price;

export const money = (v: number, d = 2) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const smoney = (v: number, d = 2) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;

/**
 * American/European option on a stock paying one known cash dividend D at time tD
 * (escrowed-dividend CRR tree: the tree runs on S minus the PV of the dividend).
 * Returns price and, for calls, whether exercising just before the ex-date is optimal at the root price path.
 */
export function divTree(
  right: 'call' | 'put',
  p: { S: number; K: number; T: number; r: number; sigma: number; D: number; tD: number; steps?: number; american?: boolean },
): number {
  const { S, K, T, r, sigma, D, tD, steps = 300, american = true } = p;
  const dt = T / steps;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const pu = (Math.exp(r * dt) - d) / (u - d);
  const disc = Math.exp(-r * dt);
  const hasDiv = D > 0 && tD < T && tD > 0;
  const Sstar = S - (hasDiv ? D * Math.exp(-r * tD) : 0);
  const spot = (i: number, j: number) => {
    const t = i * dt;
    const s = Sstar * u ** j * d ** (i - j);
    return hasDiv && t < tD - 1e-12 ? s + D * Math.exp(-r * (tD - t)) : s;
  };
  const iv = (s: number) => (right === 'call' ? Math.max(s - K, 0) : Math.max(K - s, 0));
  let v = Array.from({ length: steps + 1 }, (_, j) => iv(spot(steps, j)));
  for (let i = steps - 1; i >= 0; i--) {
    const nv = new Array(i + 1);
    for (let j = 0; j <= i; j++) {
      const cont = disc * (pu * v[j + 1] + (1 - pu) * v[j]);
      nv[j] = american ? Math.max(cont, iv(spot(i, j))) : cont;
    }
    v = nv;
  }
  return v[0];
}

/** Assumed December ex-date: Friday Dec 18 2026, before the open (≈51.5 days after the snapshot close). */
export const EX_T = 51.5 / 365;

/**
 * Financing rate at which an American model (CRR tree, cash dividend D going ex at tD)
 * reproduces the quoted C − P. Uses one volatility (the call/put average) for both legs.
 */
export function americanImpliedRate(cMinusP: number, K: number, T: number, sigma: number, D = 0, tD = EX_T, steps = 160): number {
  const f = (r: number) =>
    divTree('call', { S: S0, K, T, r, sigma, D, tD, steps }) - divTree('put', { S: S0, K, T, r, sigma, D, tD, steps }) - cMinusP;
  let lo = -0.05;
  let hi = 0.2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
