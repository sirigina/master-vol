import { describe, it, expect } from 'vitest';
import { bs } from './pricing';
import { binomial, positionPnl, positionGreeks, gbmPath, lognormalPdf, type PLeg } from './position';

describe('binomial', () => {
  it('converges to Black-Scholes for European options', () => {
    const p = { S: 100, K: 100, T: 0.5, r: 0.05, sigma: 0.25 };
    expect(binomial('call', { ...p, steps: 400 }).price).toBeCloseTo(bs('call', p).price, 1);
    expect(binomial('put', { ...p, steps: 400 }).price).toBeCloseTo(bs('put', p).price, 1);
  });
  it('American put is worth at least the European put', () => {
    const p = { S: 100, K: 110, T: 1, r: 0.08, sigma: 0.2, steps: 200 };
    expect(binomial('put', { ...p, american: true }).price).toBeGreaterThan(binomial('put', p).price);
  });
});

describe('positions', () => {
  const legs: PLeg[] = [
    { kind: 'option', right: 'call', K: 100, qty: 1, premium: 5, T: 0.25, iv: 0.2 },
    { kind: 'stock', qty: -0.5, entry: 100 },
  ];
  it('values at expiry equal intrinsic minus premium', () => {
    expect(positionPnl(legs, { S: 110, elapsed: 0.25, r: 0 })).toBeCloseTo(10 - 5 - 5, 8);
  });
  it('aggregates delta including stock', () => {
    const g = positionGreeks(legs, { S: 100, r: 0 });
    expect(g.delta).toBeCloseTo(bs('call', { S: 100, K: 100, T: 0.25, r: 0, sigma: 0.2 }).delta - 0.5, 8);
  });
});

describe('random paths', () => {
  it('are deterministic per seed', () => {
    expect(gbmPath(100, 0.2, 10, 7)).toEqual(gbmPath(100, 0.2, 10, 7));
  });
  it('lognormal density integrates to ~1', () => {
    let s = 0;
    for (let x = 1; x < 400; x += 0.1) s += lognormalPdf(x, 100, 0.3, 1) * 0.1;
    expect(s).toBeCloseTo(1, 2);
  });
});
