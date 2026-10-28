import { bs, normCdf, type Right } from '../../../lib/pricing';
import { rowAt, smileIv, R, S0, T1, solvedIv } from './G6_helpers';

export type Dir = 'bull' | 'bear';

export interface Vertical {
  dir: Dir;
  right: Right;
  lo: number;
  hi: number;
  /** + debit paid, − credit received (per share) */
  net: number;
  maxGain: number;
  maxLoss: number;
  breakeven: number;
  /** risk-neutral probability of finishing beyond the breakeven on the profitable side */
  pProfit: number;
  /** price of the same vertical with both legs at the flat ATM IV */
  flatNet: number;
  legs: { right: Right; K: number; qty: number; premium: number; iv: number }[];
}

/** ATM IV used for the "no skew" comparison: the 770 call solved from its mid. */
export const FLAT_IV = solvedIv('call', 770);

/** Risk-neutral P(S_T > X) on the snapshot smile. */
export function probAbove(X: number): number {
  const s = smileIv(X);
  const d2 = (Math.log(S0 / X) + (R - (s * s) / 2) * T1) / (s * Math.sqrt(T1));
  return normCdf(d2);
}

/**
 * A vertical at expiry, ignoring financing of the premium (the convention on
 * trading screens). Bull = long the lower strike for calls, short the higher strike for puts.
 */
export function vertical(dir: Dir, right: Right, lo: number, hi: number): Vertical | null {
  const a = rowAt(right, lo);
  const b = rowAt(right, hi);
  if (!a || !b || hi <= lo) return null;
  const w = hi - lo;
  // bull call: +lo −hi ; bull put: +lo −hi as well (buy lower put, sell higher put)
  const sign = dir === 'bull' ? 1 : -1;
  const legs = [
    { right, K: lo, qty: sign, premium: a.mark, iv: a.iv },
    { right, K: hi, qty: -sign, premium: b.mark, iv: b.iv },
  ];
  const net = legs.reduce((s, l) => s + l.qty * l.premium, 0);
  const flat = legs.reduce((s, l) => s + l.qty * bs(right, { S: S0, K: l.K, T: T1, r: R, sigma: FLAT_IV }).price, 0);
  let maxGain: number;
  let maxLoss: number;
  let breakeven: number;
  if (net > 0) {
    maxLoss = net;
    maxGain = w - net;
  } else {
    maxGain = -net;
    maxLoss = w + net;
  }
  if (dir === 'bull') breakeven = right === 'call' ? lo + net : hi + net;
  else breakeven = right === 'call' ? lo - net : hi - net;
  const pAbove = probAbove(breakeven);
  return { dir, right, lo, hi, net, maxGain, maxLoss, breakeven, pProfit: dir === 'bull' ? pAbove : 1 - pAbove, flatNet: flat, legs };
}

/** Expiry P/L per share of a vertical at price S. */
export function verticalPnl(v: Vertical, S: number): number {
  return v.legs.reduce((s, l) => s + l.qty * (Math.max(l.right === 'call' ? S - l.K : l.K - S, 0) - l.premium), 0);
}
