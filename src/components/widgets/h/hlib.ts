/**
 * Module H helpers: books of legs across the two real chains plus stock,
 * valued in dollars (options x100, stock per share).
 */
import { bs, type Right } from '../../../lib/pricing';
import { snapshot, callAt, putAt, call2At, put2At, T_EXPIRY, T_EXPIRY2, type ChainRow } from '../../../lib/snapshot';

export const S0 = snapshot.spot;
export const R = snapshot.rate;
export const MULT = 100;

export type Exp = 'nov' | 'dec';
export type BookLeg =
  | { kind: 'option'; exp: Exp; right: Right; K: number; qty: number }
  | { kind: 'stock'; qty: number };

export const EXP_LABEL: Record<Exp, string> = { nov: 'Nov 27', dec: 'Dec 18' };
export const EXP_T: Record<Exp, number> = { nov: T_EXPIRY, dec: T_EXPIRY2 };

export function quote(exp: Exp, right: Right, K: number): ChainRow | undefined {
  if (exp === 'nov') return right === 'call' ? callAt(K) : putAt(K);
  return right === 'call' ? call2At(K) : put2At(K);
}

export function strikesFor(exp: Exp, right: Right): number[] {
  const c = exp === 'nov' ? snapshot.chain : snapshot.chain2;
  return (right === 'call' ? c.calls : c.puts).map((r) => r.strike);
}

export interface ValOpts {
  S: number;
  /** calendar days elapsed */
  days?: number;
  /** vol points added to every leg's IV (e.g. 2 = +2 points) */
  volPts?: number;
  /** multiply every leg's IV (applied before volPts) */
  volMult?: number;
  /** override IV per leg */
  ivFn?: (leg: Extract<BookLeg, { kind: 'option' }>, S: number) => number;
}

function legIv(leg: Extract<BookLeg, { kind: 'option' }>, o: ValOpts): number {
  const base = o.ivFn ? o.ivFn(leg, o.S) : quote(leg.exp, leg.right, leg.K)!.iv;
  return Math.max(base * (o.volMult ?? 1) + (o.volPts ?? 0) / 100, 0.005);
}

/** Dollar value of one leg (sign included). */
export function legValue(leg: BookLeg, o: ValOpts): number {
  if (leg.kind === 'stock') return leg.qty * o.S;
  const T = EXP_T[leg.exp] - (o.days ?? 0) / 365;
  const p = T <= 1e-9 ? Math.max(leg.right === 'call' ? o.S - leg.K : leg.K - o.S, 0) : bs(leg.right, { S: o.S, K: leg.K, T, r: R, sigma: legIv(leg, o) }).price;
  return leg.qty * MULT * p;
}

export const bookValue = (legs: BookLeg[], o: ValOpts) => legs.reduce((a, l) => a + legValue(l, o), 0);

/** Revaluation P/L in dollars versus the model value at the snapshot. */
export function bookPnl(legs: BookLeg[], o: ValOpts): number {
  return bookValue(legs, o) - bookValue(legs, { S: S0 });
}

/** P/L in dollars for a book entered at the quoted marks (stock at spot). */
export function bookPnlFromMarks(legs: BookLeg[], o: ValOpts): number {
  return bookValue(legs, o) - bookCost(legs);
}

export interface DollarGreeks {
  /** shares */
  delta: number;
  /** change in share-delta per $1 move */
  gamma: number;
  /** $ per calendar day */
  theta: number;
  /** $ per vol point */
  vega: number;
  /** $ per rate point */
  rho: number;
}

export function legGreeks(leg: BookLeg, o: ValOpts = { S: S0 }): DollarGreeks {
  if (leg.kind === 'stock') return { delta: leg.qty, gamma: 0, theta: 0, vega: 0, rho: 0 };
  const T = EXP_T[leg.exp] - (o.days ?? 0) / 365;
  if (T <= 1e-9) return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  const g = bs(leg.right, { S: o.S, K: leg.K, T, r: R, sigma: legIv(leg, o) });
  const m = leg.qty * MULT;
  return { delta: m * g.delta, gamma: m * g.gamma, theta: m * g.theta, vega: m * g.vega, rho: m * g.rho };
}

export function bookGreeks(legs: BookLeg[], o: ValOpts = { S: S0 }): DollarGreeks {
  const out = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  for (const l of legs) {
    const g = legGreeks(l, o);
    out.delta += g.delta;
    out.gamma += g.gamma;
    out.theta += g.theta;
    out.vega += g.vega;
    out.rho += g.rho;
  }
  return out;
}

/** Entry cost in dollars at the quoted marks (+ paid, − received). Stock at spot. */
export function bookCost(legs: BookLeg[]): number {
  return legs.reduce((a, l) => (l.kind === 'stock' ? a + l.qty * S0 : a + l.qty * MULT * quote(l.exp, l.right, l.K)!.mark), 0);
}

export function legLabel(l: BookLeg): string {
  if (l.kind === 'stock') return `${l.qty > 0 ? 'Long' : 'Short'} ${Math.abs(l.qty)} SPY`;
  return `${l.qty > 0 ? '+' : '−'}${Math.abs(l.qty)} ${EXP_LABEL[l.exp]} ${l.K} ${l.right}${Math.abs(l.qty) > 1 ? 's' : ''}`;
}

/* ---- preset books used across H2–H4 ---- */
export const BOOKS: Record<string, { label: string; legs: BookLeg[]; note: string }> = {
  shortStrangle: {
    label: 'Short strangle',
    note: 'Sell the Nov 750 put and 790 call: collect premium, short gamma and vega.',
    legs: [
      { kind: 'option', exp: 'nov', right: 'put', K: 750, qty: -1 },
      { kind: 'option', exp: 'nov', right: 'call', K: 790, qty: -1 },
    ],
  },
  ironCondor: {
    label: 'Iron condor',
    note: 'Short the 750/790 strangle, long the 720 put and 820 call as wings: same idea, capped tails.',
    legs: [
      { kind: 'option', exp: 'nov', right: 'put', K: 720, qty: 1 },
      { kind: 'option', exp: 'nov', right: 'put', K: 750, qty: -1 },
      { kind: 'option', exp: 'nov', right: 'call', K: 790, qty: -1 },
      { kind: 'option', exp: 'nov', right: 'call', K: 820, qty: 1 },
    ],
  },
  longStraddle: {
    label: 'Long straddle',
    note: 'Buy the Nov 770 call and put: long gamma and vega, pays theta.',
    legs: [
      { kind: 'option', exp: 'nov', right: 'call', K: 770, qty: 1 },
      { kind: 'option', exp: 'nov', right: 'put', K: 770, qty: 1 },
    ],
  },
  calendar: {
    label: 'Calendar',
    note: 'Sell the Nov 770 call, buy the Dec 770 call: short gamma, long vega, collects theta.',
    legs: [
      { kind: 'option', exp: 'nov', right: 'call', K: 770, qty: -1 },
      { kind: 'option', exp: 'dec', right: 'call', K: 770, qty: 1 },
    ],
  },
  shortPut: {
    label: 'Short 700 put',
    note: 'Sell one Nov 700 put, 9% out of the money: small credit, a tail that grows as SPY falls toward the strike.',
    legs: [{ kind: 'option', exp: 'nov', right: 'put', K: 700, qty: -1 }],
  },
  coveredCall: {
    label: 'Covered call',
    note: 'Own 100 SPY and sell the Nov 790 call: mostly stock delta, a little short vega.',
    legs: [
      { kind: 'stock', qty: 100 },
      { kind: 'option', exp: 'nov', right: 'call', K: 790, qty: -1 },
    ],
  },
};

export const usd0 = (v: number) => `${v < -0.5 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
export const sgn0 = (v: number) => `${v > 0.5 ? '+' : v < -0.5 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
export const sgnN = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
