/**
 * Module E simulation engine: a delta-hedged 770 straddle on seeded GBM paths.
 * Pure functions, shared by the E2/E3/E4 widgets so their numbers agree.
 *
 * Simplifications (stated in the widgets): interest rate and dividends are set
 * to zero so volatility is the only source of P/L; the 31 calendar days to the
 * Nov 27 expiry are spread evenly over 22 trading sessions; each session is
 * split into 13 half-hour steps so intraday hedging rules can be compared.
 */
import { bs, intrinsic } from '../../../lib/pricing';
import { normalSampler } from '../../../lib/position';
import { snapshot, T_EXPIRY, atmIv } from '../../../lib/snapshot';

export const S0 = snapshot.spot;
export const K = 770;
export const T0 = T_EXPIRY;
export const DAYS = 22;
export const SPD = 13; // half-hour steps per session
export const IV = atmIv;
export const CONTRACTS = 10;
export const UNITS = CONTRACTS * 100; // shares per straddle unit
export const STEPS = DAYS * SPD;
const DT = T0 / STEPS;

export interface StraddleVal {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // per calendar day
  vega: number; // per vol point
}

/** Straddle value with r = q = 0. */
export function straddle(S: number, tau: number, sigma: number, k = K): StraddleVal {
  if (tau <= 1e-10) {
    return { price: intrinsic('call', S, k) + intrinsic('put', S, k), delta: S > k ? 1 : S < k ? -1 : 0, gamma: 0, theta: 0, vega: 0 };
  }
  const c = bs('call', { S, K: k, T: tau, r: 0, sigma });
  const p = bs('put', { S, K: k, T: tau, r: 0, sigma });
  return { price: c.price + p.price, delta: c.delta + p.delta, gamma: c.gamma + p.gamma, theta: c.theta + p.theta, vega: c.vega + p.vega };
}

/** Fine (half-hour) GBM path, zero drift, STEPS+1 prices. Same seed -> same shocks at any vol. */
export function finePath(seed: number, sigma: number, s0 = S0): number[] {
  const z = normalSampler(seed * 7919 + 17);
  const out = [s0];
  const sd = sigma * Math.sqrt(DT);
  for (let i = 0; i < STEPS; i++) out.push(out[i] * Math.exp(-0.5 * sd * sd + sd * z()));
  return out;
}

/** Realized vol of a path, zero-mean, annualized on the option's own clock. */
export function pathVol(path: number[]): number {
  let ss = 0;
  for (let i = 1; i < path.length; i++) ss += Math.log(path[i] / path[i - 1]) ** 2;
  // the whole path spans T0 years
  return Math.sqrt(ss / T0);
}

export type Rule =
  | { kind: 'every'; steps: number } // rehedge every N fine steps (1 = half-hour, 13 = daily, 65 = weekly)
  | { kind: 'band'; shares: number } // rehedge when |net delta| exceeds the band (checked every half hour)
  | { kind: 'move'; dollars: number }; // rehedge when SPY has moved this far since the last hedge (a gamma-scaled band)

export interface HedgeTrade {
  step: number;
  day: number;
  S: number;
  optDelta: number; // position option delta, shares
  traded: number; // shares bought (+) / sold (-)
  hedge: number; // stock position after trade
  cumPnl: number;
}

export interface HedgeResult {
  /** per fine step */
  S: number[];
  hedge: number[];
  optPnl: number[];
  hedgePnl: number[];
  cost: number[];
  total: number[];
  trades: HedgeTrade[];
  final: number;
  finalCost: number;
  sharesTraded: number;
  realized: number;
  /** ½ Σ Γ S² (σr² − σi²) dt along the path, using per-step realized variance */
  gammaEstimate: number;
}

/**
 * Delta-hedge `side` (+1 long, -1 short) CONTRACTS straddles bought/sold at
 * `iv`, marked at `iv` throughout, hedged with whole shares by `rule`.
 * The path may be fine (STEPS+1 points) or daily (DAYS+1 points); it always spans T0.
 */
export function runHedge(path: number[], side: 1 | -1, rule: Rule, opts: { iv?: number; costPerShare?: number } = {}): HedgeResult {
  const iv = opts.iv ?? IV;
  const c = opts.costPerShare ?? 0;
  const n = path.length - 1;
  const dt = T0 / n;
  const units = side * UNITS;
  const v0 = straddle(path[0], T0, iv);
  let h = -Math.round(units * v0.delta);
  let cost = Math.abs(h) * c;
  let hp = 0;
  let shares = Math.abs(h);
  let gEst = 0;
  const res: HedgeResult = {
    S: [path[0]], hedge: [h], optPnl: [0], hedgePnl: [0], cost: [cost], total: [-cost], trades: [],
    final: 0, finalCost: 0, sharesTraded: 0, realized: 0, gammaEstimate: 0,
  };
  res.trades.push({ step: 0, day: 0, S: path[0], optDelta: units * v0.delta, traded: h, hedge: h, cumPnl: -cost });
  let prev = v0;
  let lastHedgeS = path[0];
  for (let i = 1; i <= n; i++) {
    const S = path[i];
    const tau = Math.max(T0 - i * dt, 0);
    const v = straddle(S, tau, iv);
    hp += h * (S - path[i - 1]);
    const r = Math.log(S / path[i - 1]);
    gEst += units * 0.5 * prev.gamma * path[i - 1] ** 2 * (r * r - iv * iv * dt);
    const optPnl = units * (v.price - v0.price);
    if (i < n) {
      const net = units * v.delta + h;
      const due =
        rule.kind === 'every' ? i % rule.steps === 0 : rule.kind === 'band' ? Math.abs(net) > rule.shares : Math.abs(S - lastHedgeS) >= rule.dollars;
      if (due) {
        const target = -Math.round(units * v.delta);
        const tr = target - h;
        if (tr !== 0) {
          cost += Math.abs(tr) * c;
          shares += Math.abs(tr);
          h = target;
          lastHedgeS = S;
          res.trades.push({ step: i, day: (i * DAYS) / n, S, optDelta: units * v.delta, traded: tr, hedge: h, cumPnl: optPnl + hp - cost });
        }
      }
    }
    res.S.push(S);
    res.hedge.push(h);
    res.optPnl.push(optPnl);
    res.hedgePnl.push(hp);
    res.cost.push(cost);
    res.total.push(optPnl + hp - cost);
    prev = v;
  }
  res.final = res.total[n];
  res.finalCost = cost;
  res.sharesTraded = shares;
  res.realized = pathVol(path);
  res.gammaEstimate = gEst;
  return res;
}

/** Sample a fine path down to session closes (DAYS+1 prices). */
export function dailyCloses(path: number[]): number[] {
  const out: number[] = [];
  for (let d = 0; d <= DAYS; d++) out.push(path[d * SPD]);
  return out;
}

/** Straddle at the snapshot, r = 0, at the ATM implied vol. */
export const ENTRY = straddle(S0, T0, IV);

export const usd0 = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
