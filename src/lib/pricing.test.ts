import { describe, it, expect } from 'vitest';
import snap from '../data/snapshot-2026-10-27.json';
import {
  bs, normCdf, impliedVol, positionPnlAtExpiry, breakevens, realizedVol, expectedMove, type Leg,
} from './pricing';

describe('normal distribution', () => {
  it('matches known values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 12);
    expect(normCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normCdf(-1)).toBeCloseTo(0.1586553, 6);
  });
});

describe('Black-Scholes', () => {
  // Hull, textbook example: S=42 K=40 T=0.5 r=10% vol=20% -> call 4.76, put 0.81
  const inp = { S: 42, K: 40, T: 0.5, r: 0.1, sigma: 0.2 };
  it('prices the textbook example', () => {
    expect(bs('call', inp).price).toBeCloseTo(4.7594, 3);
    expect(bs('put', inp).price).toBeCloseTo(0.8086, 3);
  });
  it('satisfies put-call parity', () => {
    const c = bs('call', inp).price;
    const p = bs('put', inp).price;
    expect(c - p).toBeCloseTo(42 - 40 * Math.exp(-0.1 * 0.5), 10);
  });
  it('greeks agree with finite differences', () => {
    const h = 1e-3;
    const up = bs('call', { ...inp, S: inp.S + h }).price;
    const dn = bs('call', { ...inp, S: inp.S - h }).price;
    const g = bs('call', inp);
    expect(g.delta).toBeCloseTo((up - dn) / (2 * h), 5);
    expect(g.gamma).toBeCloseTo((up - 2 * g.price + dn) / (h * h), 3);
    const vUp = bs('call', { ...inp, sigma: 0.21 }).price;
    expect(g.vega).toBeCloseTo(vUp - g.price, 2);
  });
  it('round-trips implied volatility', () => {
    const p = bs('put', { ...inp, sigma: 0.37 }).price;
    expect(impliedVol('put', p, inp)).toBeCloseTo(0.37, 6);
  });
});

describe('snapshot consistency', () => {
  const T = snap.chain.dte / 365;
  it('reprices the ATM call within the bid/ask using its own IV', () => {
    const c = snap.chain.calls.find((x) => x.strike === 770)!;
    const model = bs('call', { S: snap.spot, K: 770, T, r: snap.rate, sigma: c.iv });
    expect(model.price).toBeGreaterThan(c.bid - 0.4);
    expect(model.price).toBeLessThan(c.ask + 0.4);
    expect(model.delta).toBeCloseTo(c.delta, 1);
  });
  it('has a sensible realized vol', () => {
    const rv = realizedVol(snap.closes.map((c) => c[1] as number));
    expect(rv).toBeGreaterThan(0.08);
    expect(rv).toBeLessThan(0.25);
  });
});

describe('payoffs', () => {
  it('long call breakeven = strike + premium', () => {
    const legs: Leg[] = [{ kind: 'option', right: 'call', K: 100, qty: 1, premium: 5 }];
    expect(positionPnlAtExpiry(legs, 90)).toBe(-5);
    expect(positionPnlAtExpiry(legs, 120)).toBe(15);
    expect(breakevens(legs, 50, 150)[0]).toBeCloseTo(105, 1);
  });
  it('straddle has two breakevens', () => {
    const legs: Leg[] = [
      { kind: 'option', right: 'call', K: 100, qty: 1, premium: 4 },
      { kind: 'option', right: 'put', K: 100, qty: 1, premium: 4 },
    ];
    const b = breakevens(legs, 50, 150);
    expect(b).toHaveLength(2);
    expect(b[0]).toBeCloseTo(92, 1);
    expect(b[1]).toBeCloseTo(108, 1);
  });
  it('expected move scales with sqrt(time)', () => {
    expect(expectedMove(100, 0.16, 1)).toBeCloseTo(1.008, 2);
    expect(expectedMove(100, 0.16, 252)).toBeCloseTo(16, 6);
  });
});
