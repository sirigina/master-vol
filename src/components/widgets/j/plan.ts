/** J4 capstone: strategy families on the snapshot and the numbers a trade plan needs. */
import { positionGreeks, positionPnl, type OptLeg, type PosGreeks } from '../../../lib/position';
import { bs, realizedVol } from '../../../lib/pricing';
import { snapshot, callAt, putAt, call2At, put2At, closes, atmIv, T_EXPIRY, T_EXPIRY2 } from '../../../lib/snapshot';

export const S0 = snapshot.spot;
export const R = snapshot.rate;

export type Family = 'condor' | 'fly' | 'straddle' | 'strangle' | 'calendar' | 'bullcall' | 'bearput';
export type VolView = 'short' | 'long' | 'neutral';

export interface FamilyDef {
  label: string;
  view: VolView;
  dir: 'neutral' | 'up' | 'down';
  legs: () => OptLeg[];
  blurb: string;
}

const opt = (right: 'call' | 'put', K: number, qty: number, exp: 'nov' | 'dec' = 'nov'): OptLeg => {
  const q = exp === 'nov' ? (right === 'call' ? callAt(K) : putAt(K)) : right === 'call' ? call2At(K) : put2At(K);
  if (!q) throw new Error(`missing ${exp} ${right} ${K}`);
  return { kind: 'option', right, K, qty, premium: q.mark, T: exp === 'nov' ? T_EXPIRY : T_EXPIRY2, iv: q.iv };
};

export const FAMILIES: Record<Family, FamilyDef> = {
  condor: {
    label: 'Iron condor 720/750/790/820',
    view: 'short',
    dir: 'neutral',
    legs: () => [opt('put', 720, 1), opt('put', 750, -1), opt('call', 790, -1), opt('call', 820, 1)],
    blurb: 'Sell the 750 put and 790 call, buy the 720 put and 820 call as wings. Short volatility with capped risk.',
  },
  fly: {
    label: 'Iron butterfly 740/770/800',
    view: 'short',
    dir: 'neutral',
    legs: () => [opt('put', 740, 1), opt('put', 770, -1), opt('call', 770, -1), opt('call', 800, 1)],
    blurb: 'Sell the 770 straddle, buy the 740 put and 800 call. Short volatility, most profit if SPY pins near 770.',
  },
  straddle: {
    label: 'Long straddle 770',
    view: 'long',
    dir: 'neutral',
    legs: () => [opt('call', 770, 1), opt('put', 770, 1)],
    blurb: 'Buy the 770 call and put. Long volatility: needs SPY to move more than the 25.14 premium.',
  },
  strangle: {
    label: 'Long strangle 750/790',
    view: 'long',
    dir: 'neutral',
    legs: () => [opt('put', 750, 1), opt('call', 790, 1)],
    blurb: 'Buy the 750 put and 790 call. Cheaper long volatility, needs a bigger move.',
  },
  calendar: {
    label: 'Calendar 770 (sell Nov, buy Dec)',
    view: 'neutral',
    dir: 'neutral',
    legs: () => [opt('call', 770, -1, 'nov'), opt('call', 770, 1, 'dec')],
    blurb: 'Sell the Nov 27 770 call, buy the Dec 18 770 call. Short gamma, long vega: a term-structure trade.',
  },
  bullcall: {
    label: 'Bull call spread 770/790',
    view: 'neutral',
    dir: 'up',
    legs: () => [opt('call', 770, 1), opt('call', 790, -1)],
    blurb: 'Buy the 770 call, sell the 790 call. A directional view with a capped cost.',
  },
  bearput: {
    label: 'Bear put spread 770/740',
    view: 'neutral',
    dir: 'down',
    legs: () => [opt('put', 770, 1), opt('put', 740, -1)],
    blurb: 'Buy the 770 put, sell the 740 put. A directional view on a decline, partly paid by rich downside skew.',
  },
};

export const FAMILY_KEYS = Object.keys(FAMILIES) as Family[];

/* ---------- Step 1: market read ---------- */
export const marketRead = (() => {
  const rv20 = realizedVol(closes.slice(-21));
  const rv1y = realizedVol(closes);
  const ts = snapshot.termStructure;
  const p740 = putAt(740)!;
  const c800 = callAt(800)!;
  return {
    spot: S0,
    rv20,
    rv1y,
    atmIv,
    vix: snapshot.index.VIX,
    front: ts[0],
    back: ts[ts.length - 1],
    skew: { put: p740, call: c800 },
  };
})();

/* ---------- Steps 2–5 ---------- */
export interface Analysis {
  legs: OptLeg[];
  /** net premium per share: + paid, − received */
  net: number;
  /** model value minus market price, per share, at the forecast (surface shifted in parallel) */
  edge: number;
  /** max loss per share over the grid, at the first expiry (negative number) */
  maxLoss: number;
  maxGain: number;
  greeks: PosGreeks;
}

const firstT = (legs: OptLeg[]) => Math.min(...legs.map((l) => l.T));

/** Shift every leg's IV by (forecast − ATM implied), keeping the skew shape. */
export function analyze(fam: Family, forecast: number): Analysis {
  const legs = FAMILIES[fam].legs();
  const shift = forecast - atmIv;
  const net = legs.reduce((a, l) => a + l.qty * l.premium, 0);
  const theo = legs.reduce((a, l) => a + l.qty * bs(l.right, { S: S0, K: l.K, T: l.T, r: R, sigma: Math.max(l.iv + shift, 0.01) }).price, 0);
  const t1 = firstT(legs);
  let maxLoss = Infinity;
  let maxGain = -Infinity;
  for (let s = 550; s <= 1000; s += 0.5) {
    const v = positionPnl(legs, { S: s, elapsed: t1, r: R });
    maxLoss = Math.min(maxLoss, v);
    maxGain = Math.max(maxGain, v);
  }
  const greeks = positionGreeks(legs, { S: S0, r: R });
  return { legs, net, edge: theo - net, maxLoss, maxGain, greeks };
}

export const MOVES = [-0.05, -0.02, 0, 0.02, 0.05];
export const VOL_SHIFTS = [-0.03, 0, 0.03];

/** P/L per share after `days` calendar days for an SPY move and a parallel vol shift. */
export function scenario(legs: OptLeg[], move: number, volShift: number, days: number) {
  return positionPnl(legs, { S: S0 * (1 + move), elapsed: days / 365, r: R, volShift });
}

export const DTE_FRONT = snapshot.chain.dte;
