import { describe, it, expect } from 'vitest';
import {
  coinWalks,
  spyWithinSd,
  vixVsForward,
  volCone,
  forwardVol,
  eventMove,
  fitEarnings,
  straddlePnl,
  skewMetrics,
  impliedDensity,
  tradingDaysBetween,
  msft,
  msftIv,
} from './volmath';
import { snapshot } from '../../../lib/snapshot';

describe('module C numbers quoted in the lessons', () => {
  it('coin walks are deterministic and spread like sqrt(n)', () => {
    const w = coinWalks(2000, 100, 7);
    expect(coinWalks(3, 10, 7)).toEqual(coinWalks(3, 10, 7));
    const ends = w.map((p) => p[100]);
    const m = ends.reduce((a, b) => a + b, 0) / ends.length;
    const sd = Math.sqrt(ends.reduce((a, b) => a + (b - m) ** 2, 0) / ends.length);
    expect(sd).toBeGreaterThan(9);
    expect(sd).toBeLessThan(11);
  });

  it('SPY 1/2/3 SD counts', () => {
    const [a, b, c] = spyWithinSd();
    expect(a.inside).toBe(192);
    expect(b.beyond).toBe(16);
    expect(c.beyond).toBe(3);
  });

  it('VIX vs forward realized', () => {
    const f = vixVsForward();
    const pos = f.filter((d) => d.prem > 0).length;
    expect(f.length).toBe(236);
    expect(pos).toBe(229);
    const meanPrem = f.reduce((a, d) => a + d.prem, 0) / f.length;
    expect(meanPrem).toBeCloseTo(5.63, 1);
  });

  it('vol cone', () => {
    const c = volCone();
    const c20 = c.find((x) => x.w === 20)!;
    expect(c20.cur).toBeCloseTo(9.98, 1);
    expect(c20.med).toBeCloseTo(12.1, 0);
  });

  it('term structure forward vol', () => {
    const ts = snapshot.termStructure;
    expect(forwardVol(ts[3].atmIv, 31, ts[4].atmIv, 52)).toBeCloseTo(0.1569, 3);
    expect(tradingDaysBetween('2026-10-27', '2026-11-27')).toBe(22);
  });

  it('MSFT earnings', () => {
    const e = msft.expiries[0];
    expect(msftIv(e)).toBeCloseTo(0.748, 3);
    expect(eventMove(msftIv(e), 3, 0.25)).toBeCloseTo(0.0652, 3);
    const fit = fitEarnings();
    expect(fit.normalVol).toBeCloseTo(0.2527, 2);
    expect(fit.move).toBeCloseTo(0.0642, 3);
    expect(straddlePnl(0, 0.3)).toBeCloseTo(-20.33, 1);
  });

  it('skew metrics', () => {
    const s = skewMetrics('nov');
    expect(s.rr25 * 100).toBeCloseTo(-4.6, 1);
    expect(s.put25 * 100).toBeCloseTo(16.75, 1);
    const s2 = skewMetrics('dec');
    expect(s2.rr25 * 100).toBeCloseTo(-5.69, 1);
  });

  it('implied density integrates to ~1', () => {
    const d = impliedDensity();
    const total = d.cdf(1e9, 'skew');
    expect(total).toBeGreaterThan(0.97);
    expect(total).toBeLessThan(1.02);
    expect(d.cdf(700, 'skew')).toBeGreaterThan(d.cdf(700, 'flat'));
  });
});
