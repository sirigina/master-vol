/**
 * Module G (part 2) helpers: option legs priced from the real snapshot.
 * Each listed leg is valued at the IV solved from its own mid price, so a
 * fresh position shows exactly zero P/L at the snapshot. Unlisted strikes
 * (rolls, wings) use a smile interpolated from out-of-the-money options.
 */
import { impliedVol, bs, type Right } from '../../../lib/pricing';
import type { OptLeg, PLeg } from '../../../lib/position';
import { snapshot, T_EXPIRY, T_EXPIRY2, type ChainRow } from '../../../lib/snapshot';

export const S0 = snapshot.spot;
export const R = snapshot.rate;
export const T1 = T_EXPIRY;
export const T2 = T_EXPIRY2;
export type Exp = 1 | 2;

const chainOf = (e: Exp) => (e === 1 ? snapshot.chain : snapshot.chain2);
export const rowAt = (right: Right, K: number, e: Exp = 1): ChainRow | undefined =>
  (right === 'call' ? chainOf(e).calls : chainOf(e).puts).find((r) => r.strike === K);
export const strikesOf = (right: Right, e: Exp = 1) => (right === 'call' ? chainOf(e).calls : chainOf(e).puts).map((r) => r.strike);
export const Tof = (e: Exp) => (e === 1 ? T1 : T2);

const ivCache = new Map<string, number>();
/** IV that reproduces the quoted mid with lib/pricing (European, q = 0). */
export function solvedIv(right: Right, K: number, e: Exp = 1): number {
  const key = `${right}${K}${e}`;
  const hit = ivCache.get(key);
  if (hit !== undefined) return hit;
  const row = rowAt(right, K, e);
  if (!row) throw new Error(`no ${right} ${K} in chain ${e}`);
  const v = impliedVol(right, row.mark, { S: S0, K, T: Tof(e), r: R });
  ivCache.set(key, v);
  return v;
}

/** Out-of-the-money smile for an expiry: puts at or below 770, calls above. */
function smilePoints(e: Exp): [number, number][] {
  const c = chainOf(e);
  const pts: [number, number][] = [];
  for (const p of c.puts) if (p.strike <= 770) pts.push([p.strike, solvedIv('put', p.strike, e)]);
  for (const cl of c.calls) if (cl.strike > 770) pts.push([cl.strike, solvedIv('call', cl.strike, e)]);
  return pts.sort((a, b) => a[0] - b[0]);
}
const smileCache = new Map<Exp, [number, number][]>();
/** Smile IV at any strike (linear interpolation, flat beyond the ends). */
export function smileIv(K: number, e: Exp = 1): number {
  let pts = smileCache.get(e);
  if (!pts) {
    pts = smilePoints(e);
    smileCache.set(e, pts);
  }
  if (K <= pts[0][0]) return pts[0][1];
  if (K >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (K <= pts[i][0]) {
      const [k0, v0] = pts[i - 1];
      const [k1, v1] = pts[i];
      return v0 + ((v1 - v0) * (K - k0)) / (k1 - k0);
    }
  }
  return pts[pts.length - 1][1];
}

/** A listed leg at its mid price. qty > 0 long, < 0 short. */
export function leg(right: Right, K: number, qty: number, e: Exp = 1): OptLeg {
  const row = rowAt(right, K, e)!;
  return { kind: 'option', right, K, qty, premium: row.mark, T: Tof(e), iv: solvedIv(right, K, e) };
}

/** Model value of an option on the snapshot smile (sticky strike) at spot S with t years left. */
export function modelPrice(right: Right, K: number, S: number, t: number, e: Exp = 1, volShift = 0): number {
  if (t <= 1e-9) return Math.max(right === 'call' ? S - K : K - S, 0);
  return bs(right, { S, K, T: t, r: R, sigma: Math.max(smileIv(K, e) + volShift, 0.01) }).price;
}

/** Net premium (debit +, credit −) of option legs. */
export const net = (legs: PLeg[]) => legs.reduce((a, l) => (l.kind === 'option' ? a + l.qty * l.premium : a), 0);

export const money = (v: number, d = 0) =>
  `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
export const num = (v: number, d = 2) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;
/** Unsigned dollar amount. */
export const usd = (v: number, d = 0) => `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
