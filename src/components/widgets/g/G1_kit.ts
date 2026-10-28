/**
 * Module G helpers shared by G1–G5 widgets: legs priced from the snapshot,
 * expiry statistics and money formatting. Builds on lib/position.ts.
 */
import { positionPnl, positionGreeks, type OptLeg, type PosGreeks } from '../../../lib/position';
import { snapshot, callAt, putAt, call2At, put2At, T_EXPIRY, T_EXPIRY2, atmIv } from '../../../lib/snapshot';
import type { Right } from '../../../lib/pricing';

export const S0 = snapshot.spot;
export const R = snapshot.rate;
export { T_EXPIRY, T_EXPIRY2, atmIv };
export const DTE = snapshot.chain.dte;

export const CALL_STRIKES = snapshot.chain.calls.map((c) => c.strike);
export const PUT_STRIKES = snapshot.chain.puts.map((c) => c.strike);
export const has = (right: Right, K: number) => (right === 'call' ? !!callAt(K) : !!putAt(K));

/** One Nov 27 option leg at its real mark and IV. Optional flat IV for model pricing. */
export function leg(right: Right, K: number, qty: number): OptLeg {
  const q = right === 'call' ? callAt(K) : putAt(K);
  if (!q) throw new Error(`No ${right} at ${K}`);
  return { kind: 'option', right, K, qty, premium: q.mark, T: T_EXPIRY, iv: q.iv };
}
/** One Dec 18 option leg. */
export function leg2(right: Right, K: number, qty: number): OptLeg {
  const q = right === 'call' ? call2At(K) : put2At(K);
  if (!q) throw new Error(`No Dec ${right} at ${K}`);
  return { kind: 'option', right, K, qty, premium: q.mark, T: T_EXPIRY2, iv: q.iv };
}

export const net = (legs: OptLeg[]) => legs.reduce((a, l) => a + l.qty * l.premium, 0);

/** P/L per share at the front expiry (or after `days` calendar days). */
export function pnlAt(legs: OptLeg[], S: number, days = DTE, volShift = 0) {
  return positionPnl(legs, { S, r: R, elapsed: Math.min(days, DTE) / 365, volShift });
}
export function greeksAt(legs: OptLeg[], S = S0, days = 0, volShift = 0): PosGreeks {
  return positionGreeks(legs, { S, r: R, elapsed: days / 365, volShift });
}

export interface ExpiryStats {
  cost: number;
  maxGain: number;
  maxLoss: number;
  be: number[];
}
/** Expiry stats per share. Infinite if the payoff keeps sloping beyond the grid. */
export function expiryStats(legs: OptLeg[], lo = 400, hi = 1200): ExpiryStats {
  const step = 0.05;
  let maxG = -Infinity;
  let maxL = Infinity;
  const be: number[] = [];
  let prevS = lo;
  let prev = pnlAt(legs, lo);
  for (let s = lo; s <= hi + 1e-9; s += step) {
    const v = pnlAt(legs, s);
    if (v > maxG) maxG = v;
    if (v < maxL) maxL = v;
    if (s > lo && prev * v < 0) be.push(prevS + (step * Math.abs(prev)) / (Math.abs(prev) + Math.abs(v)));
    else if (s > lo && v === 0 && prev !== 0) be.push(s);
    prev = v;
    prevS = s;
  }
  const slopeHi = pnlAt(legs, hi + 1) - pnlAt(legs, hi);
  const slopeLo = pnlAt(legs, lo - 1) - pnlAt(legs, lo);
  if (slopeHi > 1e-6) maxG = Infinity;
  if (slopeHi < -1e-6) maxL = -Infinity;
  // On the downside, losses/gains are bounded by S = 0; report the value at the floor.
  if (slopeLo > 1e-6) maxG = Math.max(maxG, pnlAt(legs, 0));
  if (slopeLo < -1e-6) maxL = Math.min(maxL, pnlAt(legs, 0));
  return { cost: net(legs), maxGain: maxG, maxLoss: maxL, be };
}

/** "$1,234" / "−$1,234" per contract (x100), or "Unlimited". */
export function money(v: number, mult = 100, signed = false) {
  if (!Number.isFinite(v)) return 'Unlimited';
  const x = Math.round(v * mult);
  const s = `$${Math.abs(x).toLocaleString('en-US')}`;
  return x < 0 ? `−${s}` : signed && x > 0 ? `+${s}` : s;
}
/** "Pay $946" / "Collect $64" for a net premium per share. */
export function costLabel(c: number) {
  return c >= 0 ? `Pay ${money(c)}` : `Collect ${money(-c)}`;
}
export const sgn = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

/** Greeks per contract (x100) for display: delta in shares, gamma in shares per $1, theta/vega in $. */
export function contractGreeks(g: PosGreeks) {
  return { delta: g.delta * 100, gamma: g.gamma * 100, theta: g.theta * 100, vega: g.vega * 100 };
}

export const selCls =
  'rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-2 py-1 text-[0.82rem] text-(--sl-color-white)';
