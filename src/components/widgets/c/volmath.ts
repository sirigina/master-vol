/**
 * Module C (volatility) helpers. Everything here is pure and deterministic so
 * the numbers quoted in the lessons can be checked in c.test.ts.
 */
import { snapshot, closes, dates } from '../../../lib/snapshot';
import { bs, logReturns, stdev, normCdf, TRADING_DAYS } from '../../../lib/pricing';
import { rng } from '../../../lib/position';

/* ---------------- C1: random walks ---------------- */

/** `paths` coin-flip walks of `steps` steps (+1 / -1). Each walk is steps+1 positions starting at 0. */
export function coinWalks(paths: number, steps: number, seed: number): number[][] {
  const u = rng(seed);
  const out: number[][] = [];
  for (let p = 0; p < paths; p++) {
    const w = [0];
    for (let i = 0; i < steps; i++) w.push(w[i] + (u() < 0.5 ? -1 : 1));
    out.push(w);
  }
  return out;
}

/** Share of SPY daily log returns within k standard deviations of the mean. */
export function spyWithinSd() {
  const r = logReturns(closes);
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const s = stdev(r);
  return [1, 2, 3].map((k) => {
    const inside = r.filter((x) => Math.abs(x - m) <= k * s).length;
    const normal = normCdf(k) - normCdf(-k);
    return { k, inside, beyond: r.length - inside, n: r.length, share: inside / r.length, normal, normalBeyond: r.length * (1 - normal) };
  });
}

/* ---------------- C4/C6: realized volatility ---------------- */

export const RET = logReturns(closes);

/** Annualized vol of the `w` returns starting at return index i (closes i..i+w). */
export const windowVol = (i: number, w: number) => stdev(RET.slice(i, i + w)) * Math.sqrt(TRADING_DAYS);

/** VIX keyed by ISO date. */
export const vixMap = new Map(snapshot.vix);

/**
 * For each date with a VIX close and 21 trading days of closes after it: VIX
 * and the SPY volatility actually realized over those next 21 sessions.
 */
export function vixVsForward(h = 21) {
  const out: { date: Date; iso: string; vix: number; fwd: number; prem: number }[] = [];
  snapshot.closes.forEach(([iso], i) => {
    const v = vixMap.get(iso);
    if (v === undefined || i + h >= closes.length) return;
    const fwd = windowVol(i, h) * 100;
    out.push({ date: dates[i], iso, vix: v, fwd, prem: v - fwd });
  });
  return out;
}

export const CONE_WINDOWS = [10, 20, 30, 60, 90, 120];

function quantile(sorted: number[], p: number) {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Volatility cone: distribution of every overlapping w-day realized vol in the sample (in %). */
export function volCone() {
  return CONE_WINDOWS.map((w) => {
    const vals: number[] = [];
    for (let i = 0; i + w <= RET.length; i++) vals.push(windowVol(i, w) * 100);
    const s = [...vals].sort((a, b) => a - b);
    return {
      w,
      n: vals.length,
      min: s[0],
      p25: quantile(s, 0.25),
      med: quantile(s, 0.5),
      p75: quantile(s, 0.75),
      max: s[s.length - 1],
      cur: windowVol(RET.length - w, w) * 100,
    };
  });
}

/* ---------------- calendar ---------------- */

const HOLIDAYS = new Set(['2026-11-26', '2026-12-25', '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24']);

/** NYSE sessions after `from` up to and including `to` (ISO dates). */
export function tradingDaysBetween(from: string, to: string): number {
  const d = new Date(from + 'T12:00:00Z');
  const end = new Date(to + 'T12:00:00Z');
  let n = 0;
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6 && !HOLIDAYS.has(d.toISOString().slice(0, 10))) n++;
  }
  return n;
}

/* ---------------- C7: term structure ---------------- */

/** Forward vol between two expiries from total variance, calendar-day convention (matches the quoted IVs). */
export function forwardVol(iv1: number, d1: number, iv2: number, d2: number): number {
  const fv = (iv2 * iv2 * d2 - iv1 * iv1 * d1) / (d2 - d1);
  return fv > 0 ? Math.sqrt(fv) : NaN;
}

export const msft = snapshot.earnings;
export const msftIv = (e: (typeof msft.expiries)[0]) => (e.callIv + e.putIv) / 2;

/**
 * Event-day move implied by an expiry, given a normal-day vol. The expiry's
 * total variance is split into (dte − 1) ordinary days plus one event day.
 * Returns the event-day standard deviation as a fraction (NaN if negative).
 */
export function eventMove(iv: number, dte: number, normalVol: number): number {
  const v = (iv * iv * dte) / 365 - (normalVol * normalVol * (dte - 1)) / 365;
  return v > 0 ? Math.sqrt(v) : NaN;
}

/** Least-squares fit of total variance = normalVar·(dte−1)/365 + eventVar across all MSFT expiries. */
export function fitEarnings() {
  const xs = msft.expiries.map((e) => (e.dte - 1) / 365);
  const ys = msft.expiries.map((e) => (msftIv(e) ** 2 * e.dte) / 365);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
  });
  const slope = sxy / sxx;
  const icpt = my - slope * mx;
  return { normalVol: Math.sqrt(slope), move: Math.sqrt(Math.max(icpt, 0)) };
}

/** Long Oct 30 530 straddle P/L per share at the close the day after earnings (1 day left). */
export function straddlePnl(movePct: number, postIv: number, daysLeft = 1) {
  const e = msft.expiries[0];
  const S = msft.spot * (1 + movePct / 100);
  const T = daysLeft / 365;
  const p = { S, K: msft.strike, T, r: snapshot.rate, sigma: postIv };
  return bs('call', p).price + bs('put', p).price - e.straddle;
}

/* ---------------- C8: smile ---------------- */

export interface SmilePt {
  strike: number;
  iv: number;
  /** Black-Scholes call delta at this IV */
  delta: number;
  side: 'put' | 'call' | 'atm';
}

/** OTM puts below 770, the 770 average, OTM calls above. */
export function smile(which: 'nov' | 'dec'): SmilePt[] {
  const ch = which === 'nov' ? snapshot.chain : snapshot.chain2;
  const T = ch.dte / 365;
  const S = snapshot.spot;
  const r = snapshot.rate;
  const mk = (strike: number, iv: number, side: SmilePt['side']): SmilePt => ({ strike, iv, side, delta: bs('call', { S, K: strike, T, r, sigma: iv }).delta });
  const c770 = ch.calls.find((c) => c.strike === 770)!.iv;
  const p770 = ch.puts.find((c) => c.strike === 770)!.iv;
  return [
    ...ch.puts.filter((p) => p.strike < 770).map((p) => mk(p.strike, p.iv, 'put')),
    mk(770, (c770 + p770) / 2, 'atm'),
    ...ch.calls.filter((c) => c.strike > 770).map((c) => mk(c.strike, c.iv, 'call')),
  ];
}

/** Linear interpolation of IV at a call delta (NaN outside the quoted range). */
export function ivAtDelta(pts: SmilePt[], d: number): number {
  const s = [...pts].sort((a, b) => a.delta - b.delta);
  if (d < s[0].delta || d > s[s.length - 1].delta) return NaN;
  for (let i = 1; i < s.length; i++) {
    if (d <= s[i].delta) {
      const a = s[i - 1];
      const b = s[i];
      return a.iv + ((b.iv - a.iv) * (d - a.delta)) / (b.delta - a.delta);
    }
  }
  return s[s.length - 1].iv;
}

/** Linear interpolation of IV at a strike. */
export function ivAtStrike(pts: SmilePt[], k: number): number {
  if (k < pts[0].strike || k > pts[pts.length - 1].strike) return NaN;
  for (let i = 1; i < pts.length; i++) {
    if (k <= pts[i].strike) {
      const a = pts[i - 1];
      const b = pts[i];
      return a.iv + ((b.iv - a.iv) * (k - a.strike)) / (b.strike - a.strike);
    }
  }
  return pts[pts.length - 1].iv;
}

export function skewMetrics(which: 'nov' | 'dec') {
  const pts = smile(which);
  const atm = ivAtDelta(pts, 0.5);
  const put25 = ivAtDelta(pts, 0.75);
  const call25 = ivAtDelta(pts, 0.25);
  const put10 = ivAtDelta(pts, 0.9);
  const S = snapshot.spot;
  return {
    atm,
    put25,
    call25,
    put10,
    rr25: call25 - put25,
    putWing: put25 - atm,
    fly25: (put25 + call25) / 2 - atm,
    m95: ivAtStrike(pts, 0.95 * S),
    m100: ivAtStrike(pts, S),
  };
}

/** Least squares polynomial fit (normal equations; fine for degree ≤ 4 and a handful of points). */
function polyfit(xs: number[], ys: number[], deg: number): number[] {
  const m = deg + 1;
  const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  xs.forEach((x, i) => {
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) A[r][c] += x ** (r + c);
      A[r][m] += ys[i] * x ** r;
    }
  });
  for (let c = 0; c < m; c++) {
    let p = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((row, i) => row[m] / row[i]); // coefficients c0 + c1 x + ...
}

/**
 * Risk-neutral density implied by the Nov 27 smile (Breeden-Litzenberger):
 * fit IV as a cubic in log-moneyness, price calls on a fine grid, take the
 * second difference. IV continues linearly beyond the quoted strikes. Illustrative only.
 */
export function impliedDensity(lo = 560, hi = 920, n = 600) {
  const pts = smile('nov');
  const T = snapshot.chain.dte / 365;
  const r = snapshot.rate;
  const S = snapshot.spot;
  const F = S * Math.exp(r * T);
  const ks = pts.map((p) => Math.log(p.strike / F));
  const co = polyfit(ks, pts.map((p) => p.iv), 3);
  const kmin = Math.min(...ks);
  const kmax = Math.max(...ks);
  const poly = (k: number) => co.reduce((a, c, i) => a + c * k ** i, 0);
  const slope = (k: number) => co.reduce((a, c, i) => (i === 0 ? a : a + i * c * k ** (i - 1)), 0);
  // Inside the quotes: the cubic. Outside: continue in a straight line (no wiggles), clamped to a sane range.
  const volAt = (K: number) => {
    const k = Math.log(K / F);
    const v = k < kmin ? poly(kmin) + (k - kmin) * slope(kmin) : k > kmax ? poly(kmax) + (k - kmax) * slope(kmax) : poly(k);
    return Math.min(Math.max(v, 0.05), 0.8);
  };
  const h = (hi - lo) / n;
  const grid = Array.from({ length: n + 1 }, (_, i) => lo + i * h);
  const C = grid.map((K) => bs('call', { S, K, T, r, sigma: volAt(K) }).price);
  const out: { x: number; skew: number; flat: number; vol: number }[] = [];
  const atm = skewMetrics('nov').m100;
  const s = atm * Math.sqrt(T);
  const mu = Math.log(F) - 0.5 * s * s;
  const raw = grid.map((_, i) => (i === 0 || i === n ? 0 : Math.max((Math.exp(r * T) * (C[i + 1] - 2 * C[i] + C[i - 1])) / (h * h), 0)));
  // Light moving-average smoothing (about ±$6) hides the small kinks where the fit meets its linear extension.
  const W = 10;
  for (let i = 1; i < n; i++) {
    const K = grid[i];
    let acc = 0;
    let cnt = 0;
    for (let j = Math.max(1, i - W); j <= Math.min(n - 1, i + W); j++) {
      acc += raw[j];
      cnt++;
    }
    const flat = Math.exp(-((Math.log(K) - mu) ** 2) / (2 * s * s)) / (K * s * Math.sqrt(2 * Math.PI));
    out.push({ x: K, skew: acc / cnt, flat, vol: volAt(K) });
  }
  const cdf = (X: number, key: 'skew' | 'flat') => out.filter((d) => d.x < X).reduce((a, d) => a + d[key] * h, 0);
  return { pts: out, F, atm, cdf, volAt };
}
