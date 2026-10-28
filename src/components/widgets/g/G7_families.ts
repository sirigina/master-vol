import { positionPnl, positionGreeks, type OptLeg } from '../../../lib/position';
import { bs } from '../../../lib/pricing';
import { leg, net, R, S0, T1, solvedIv } from './G6_helpers';

export type Dir = 'down' | 'neutral' | 'up';

export interface Family {
  id: string;
  name: string;
  legs: OptLeg[];
  /** +1 long volatility, −1 short volatility, 0 mixed (calendars: gamma and vega of opposite sign) */
  vol: 1 | -1 | 0;
  limited: boolean;
  tilt: Dir;
  /** +1 if it buys downside (OTM put) skew, −1 if it sells it, 0 otherwise */
  putSkew: -1 | 0 | 1;
  /** gains from a jump (convex wings) */
  likesJumps: boolean;
  /** time spread: valued at the front expiry */
  calendar?: boolean;
  /** one-line description of the legs */
  build: string;
}

const L = leg;
export const FAMILIES: Family[] = [
  { id: 'lstrad', name: 'Long straddle', build: 'Buy 770 call + 770 put', legs: [L('call', 770, 1), L('put', 770, 1)], vol: 1, limited: true, tilt: 'neutral', putSkew: 0, likesJumps: true },
  { id: 'lstrang', name: 'Long strangle', build: 'Buy 750 put + 790 call', legs: [L('put', 750, 1), L('call', 790, 1)], vol: 1, limited: true, tilt: 'neutral', putSkew: 1, likesJumps: true },
  { id: 'cback', name: 'Call backspread', build: 'Sell 1× 770 call, buy 2× 790 calls', legs: [L('call', 770, -1), L('call', 790, 2)], vol: 1, limited: true, tilt: 'up', putSkew: 0, likesJumps: true },
  { id: 'pback', name: 'Put backspread', build: 'Sell 1× 770 put, buy 2× 750 puts', legs: [L('put', 770, -1), L('put', 750, 2)], vol: 1, limited: true, tilt: 'down', putSkew: 1, likesJumps: true },
  { id: 'lic', name: 'Long iron condor', build: 'Buy 750 put / 790 call, sell 740 put / 800 call', legs: [L('put', 750, 1), L('put', 740, -1), L('call', 790, 1), L('call', 800, -1)], vol: 1, limited: true, tilt: 'neutral', putSkew: 0, likesJumps: false },
  { id: 'scal', name: 'Short calendar', build: 'Buy Nov 27 770 call, sell Dec 18 770 call', legs: [L('call', 770, 1, 1), L('call', 770, -1, 2)], vol: 0, limited: true, tilt: 'neutral', putSkew: 0, likesJumps: false, calendar: true },
  { id: 'sstrad', name: 'Short straddle', build: 'Sell 770 call + 770 put', legs: [L('call', 770, -1), L('put', 770, -1)], vol: -1, limited: false, tilt: 'neutral', putSkew: 0, likesJumps: false },
  { id: 'sstrang', name: 'Short strangle', build: 'Sell 750 put + 790 call', legs: [L('put', 750, -1), L('call', 790, -1)], vol: -1, limited: false, tilt: 'neutral', putSkew: -1, likesJumps: false },
  { id: 'cratio', name: 'Call ratio spread', build: 'Buy 1× 770 call, sell 2× 790 calls', legs: [L('call', 770, 1), L('call', 790, -2)], vol: -1, limited: false, tilt: 'up', putSkew: 0, likesJumps: false },
  { id: 'pratio', name: 'Put ratio spread', build: 'Buy 1× 770 put, sell 2× 750 puts', legs: [L('put', 770, 1), L('put', 750, -2)], vol: -1, limited: false, tilt: 'down', putSkew: -1, likesJumps: false },
  { id: 'fly', name: 'Long butterfly', build: 'Buy 750 call, sell 2× 770 calls, buy 790 call', legs: [L('call', 750, 1), L('call', 770, -2), L('call', 790, 1)], vol: -1, limited: true, tilt: 'neutral', putSkew: 0, likesJumps: false },
  { id: 'ic', name: 'Short iron condor', build: 'Sell 750 put / 790 call, buy 740 put / 800 call', legs: [L('put', 750, -1), L('put', 740, 1), L('call', 790, -1), L('call', 800, 1)], vol: -1, limited: true, tilt: 'neutral', putSkew: -1, likesJumps: false },
  { id: 'lcal', name: 'Long calendar', build: 'Sell Nov 27 770 call, buy Dec 18 770 call', legs: [L('call', 770, -1, 1), L('call', 770, 1, 2)], vol: 0, limited: true, tilt: 'neutral', putSkew: 0, likesJumps: false, calendar: true },
];

/** The implied volatility the forecast is compared against: ATM, solved from the 770 call mid. */
export const IMPLIED = solvedIv('call', 770);
/** 1-SD move to Nov 27 at implied. */
export const SD = S0 * IMPLIED * Math.sqrt(T1);

/** Value at the horizon (front expiry) for a price, per share. */
export function horizonPnl(f: Family, S: number): number {
  return positionPnl(f.legs, { S, elapsed: T1, r: R });
}

/**
 * Theoretical edge per unit: value every leg at its own IV shifted by
 * (forecast − implied), keeping the skew, minus the market price.
 * For calendars only the front leg is realized over the horizon, but we
 * shift both: the simple "your forecast applies to every option" view.
 */
export function edge(f: Family, forecast: number): number {
  const sh = forecast - IMPLIED;
  return f.legs.reduce((a, l) => a + l.qty * (bs(l.right, { S: S0, K: l.K, T: l.T, r: R, sigma: Math.max(l.iv + sh, 0.01) }).price - l.premium), 0);
}

/** Worst P/L at the horizon for SPY within ±2 SD (per share). */
export function worst2sd(f: Family): number {
  let w = Infinity;
  for (let i = 0; i <= 200; i++) {
    const S = S0 - 2 * SD + (4 * SD * i) / 200;
    w = Math.min(w, horizonPnl(f, S));
  }
  return w;
}

export function greeks(f: Family) {
  return positionGreeks(f.legs, { S: S0, r: R });
}
export const netOf = (f: Family) => net(f.legs);

export interface Inputs {
  forecast: number;
  jumpy: boolean;
  dir: Dir;
  limitedOnly: boolean;
  skew: 'rich' | 'fair' | 'cheap';
  /** term-structure view: front month rich relative to back, back rich, or no view */
  term: 'none' | 'front' | 'back';
}

export interface Ranked {
  f: Family;
  score: number;
  why: string;
  excluded: boolean;
}

/** Rank families against the inputs. Pure heuristics that mirror the decision framework in the lesson. */
export function rank(inp: Inputs): Ranked[] {
  const gap = (inp.forecast - IMPLIED) * 100;
  const side: 1 | -1 | 0 = gap > 0.75 ? 1 : gap < -0.75 ? -1 : 0;
  return FAMILIES.map((f) => {
    let score = 0;
    const why: string[] = [];
    if (f.calendar) {
      // calendars: short gamma + long vega (long calendar) or the reverse
      const isLong = f.id === 'lcal';
      const want = isLong ? 'front' : 'back';
      if (inp.term === want) {
        score += 5;
        why.push(isLong ? 'sells the rich front month, owns the back' : 'sells the rich back month, owns the front');
      } else if (inp.term === 'none') score -= 1;
      else score -= 4;
      if (isLong && side < 0) {
        score += 1;
        why.push('a quiet market suits its short gamma');
      }
      if (!isLong && side > 0) {
        score += 1;
        why.push('a busy market suits its long front gamma');
      }
    } else if (side === 0) {
      score -= 1;
    } else if (f.vol === side) {
      score += 4 + Math.min(Math.abs(gap) / 2, 2);
      why.push(side > 0 ? 'long volatility, which your forecast favours' : 'short volatility, which your forecast favours');
    } else {
      score -= 4;
    }
    if (inp.dir === f.tilt) {
      score += inp.dir === 'neutral' ? 1 : 2;
      if (inp.dir !== 'neutral') why.push(`tilted ${inp.dir === 'up' ? 'upward' : 'downward'} like your bias`);
    } else if (inp.dir !== 'neutral' && f.tilt !== 'neutral') score -= 2;
    else if (inp.dir !== 'neutral') score -= 0.5;
    if (!f.limited) {
      if (inp.limitedOnly) score -= 6;
      else if (inp.jumpy) {
        score -= 1.5;
        why.push('but a jump hits the open-ended side');
      }
    } else if (inp.limitedOnly) why.push('risk capped');
    if (inp.jumpy && f.likesJumps) {
      score += 1.5;
      why.push('convex wings profit from a jump');
    }
    if (!inp.jumpy && f.vol === 1 && f.id === 'lstrad') score += 0.5;
    if (!inp.jumpy && f.vol === -1 && (f.id === 'sstrad' || f.id === 'fly')) score += 0.5;
    if (inp.skew === 'rich' && f.putSkew === -1) {
      score += 1.5;
      why.push('sells the rich downside puts');
    }
    if (inp.skew === 'rich' && f.putSkew === 1) score -= 1.5;
    if (inp.skew === 'cheap' && f.putSkew === 1) {
      score += 1.5;
      why.push('buys downside puts while they are cheap');
    }
    if (inp.skew === 'cheap' && f.putSkew === -1) score -= 1.5;
    if (f.calendar && inp.jumpy && f.id === 'lcal') score -= 1.5;
    if (side === 0 && !f.calendar) why.unshift('no clear volatility edge');
    const excluded = inp.limitedOnly && !f.limited;
    return { f, score, why: why.length ? why.join('; ') : 'no feature matches your inputs', excluded };
  }).sort((a, b) => b.score - a.score);
}
