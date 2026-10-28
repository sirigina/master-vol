import { positionPnlAtExpiry, breakevens, type Leg } from '../../../lib/pricing';
import { S0, quote } from './common';

export const call = (K: number, qty: number): Leg => ({ kind: 'option', right: 'call', K, qty, premium: quote('call', K)!.mark });
export const put = (K: number, qty: number): Leg => ({ kind: 'option', right: 'put', K, qty, premium: quote('put', K)!.mark });
export const stock = (qty = 1): Leg => ({ kind: 'stock', qty, entry: S0 });

export interface Stats {
  /** + paid, − collected, per contract */
  premium: number;
  maxP: number;
  maxL: number;
  be: number[];
}

/** Per-contract (×100) summary of an expiry payoff. */
export function stats(legs: Leg[]): Stats {
  const premium = legs.reduce((a, l) => (l.kind === 'option' ? a + l.qty * l.premium : a), 0) * 100;
  const grid = Array.from({ length: 4001 }, (_, i) => i * 0.5);
  const vals = grid.map((s) => positionPnlAtExpiry(legs, s) * 100);
  const slopeUp = positionPnlAtExpiry(legs, 5001) - positionPnlAtExpiry(legs, 5000);
  return {
    premium,
    maxP: slopeUp > 1e-9 ? Infinity : Math.max(...vals),
    maxL: Math.min(...vals),
    be: breakevens(legs, 1, 2000, 40000),
  };
}

export function moneyInf(v: number) {
  if (!isFinite(v)) return 'Unlimited';
  const r = Math.round(v);
  return `${r < 0 ? '−' : ''}$${Math.abs(r).toLocaleString('en-US')}`;
}
