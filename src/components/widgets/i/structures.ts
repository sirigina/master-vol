/** Module I: hedge structures on 100 SPY shares (Nov 27 chain). */
import { bs, positionPnlAtExpiry, type Leg } from '../../../lib/pricing';
import { snapshot, callAt, putAt, atmIv, T_EXPIRY } from '../../../lib/snapshot';

export const S0 = snapshot.spot;
export type StructKey = 'pp' | 'ps' | 'r12' | 'sg';
export const STRUCT_LABEL: Record<StructKey, string> = {
  pp: 'Protective put',
  ps: 'Put spread',
  r12: '1×2 put spread',
  sg: 'Seagull',
};
export const STRUCT_KEYS: StructKey[] = ['pp', 'ps', 'r12', 'sg'];

export interface Strikes {
  long: number;
  short: number;
  call: number;
}

/** Price an option at the market mark, or at a single flat (ATM) volatility to strip out skew. */
function prem(right: 'call' | 'put', k: number, flat: boolean) {
  if (flat) return bs(right, { S: S0, K: k, T: T_EXPIRY, r: snapshot.rate, sigma: atmIv }).price;
  return (right === 'call' ? callAt(k) : putAt(k))!.mark;
}

/** Option legs (per share) for a structure, excluding the 100 shares. */
export function optionLegs(key: StructKey, s: Strikes, flat = false): Leg[] {
  const P = (k: number, qty: number): Leg => ({ kind: 'option', right: 'put', K: k, qty, premium: prem('put', k, flat) });
  const C = (k: number, qty: number): Leg => ({ kind: 'option', right: 'call', K: k, qty, premium: prem('call', k, flat) });
  switch (key) {
    case 'pp':
      return [P(s.long, 1)];
    case 'ps':
      return [P(s.long, 1), P(s.short, -1)];
    case 'r12':
      return [P(s.long, 1), P(s.short, -2)];
    case 'sg':
      return [P(s.long, 1), P(s.short, -1), C(s.call, -1)];
  }
}

export const withStock = (legs: Leg[]): Leg[] => [{ kind: 'stock', qty: 1, entry: S0 }, ...legs];

/** Net premium for 100 shares: + paid, − received. */
export const cost100 = (legs: Leg[]) => legs.reduce((a, l) => (l.kind === 'option' ? a + l.qty * l.premium : a), 0) * 100;

/** P/L for 100 shares plus the hedge if SPY moves by `pct` (e.g. −0.10) by expiry. */
export const pnlAtMove = (legs: Leg[], pct: number) => positionPnlAtExpiry(withStock(legs), S0 * (1 + pct)) * 100;

export function describe(key: StructKey, s: Strikes) {
  switch (key) {
    case 'pp':
      return `Buy ${s.long} put`;
    case 'ps':
      return `Buy ${s.long} put, sell ${s.short} put`;
    case 'r12':
      return `Buy ${s.long} put, sell 2× ${s.short} put`;
    case 'sg':
      return `Buy ${s.long} put, sell ${s.short} put, sell ${s.call} call`;
  }
}

export const LONG_STRIKES = [740, 750, 760, 765];
export const SHORT_STRIKES = [680, 700, 720];
export const CALL_STRIKES = [780, 790, 800];
