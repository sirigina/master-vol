import { bs, type Right } from '../../../lib/pricing';
import { positionGreeks, positionPnl, type OptLeg, type PLeg } from '../../../lib/position';
import { leg, smileIv, rowAt, R, T1, T2, type Exp } from './G6_helpers';

export type Adj = 'none' | 'roll' | 'out' | 'wings' | 'hedge';

export const STRANGLE: OptLeg[] = [leg('put', 750, -1, 1), leg('call', 790, -1, 1)];
export const CREDIT = -STRANGLE.reduce((a, l) => a + l.qty * l.premium, 0);

/** Original legs with the IV change applied (sticky strike + parallel shift). */
export function shifted(legs: OptLeg[], shift: number): OptLeg[] {
  return legs.map((l) => ({ ...l, iv: l.iv + shift }));
}

/** Half the quoted bid/ask at a listed strike, per share; 0.03 for strikes not in the chain. */
export function halfSpread(right: Right, K: number, e: Exp = 1): number {
  const row = rowAt(right, K, e);
  return row ? (row.ask - row.bid) / 2 : 0.03;
}

/** A leg opened at elapsed time `el`, priced on the smile (plus shift) at that moment. */
function openAt(right: Right, K: number, qty: number, S: number, el: number, shift: number, e: Exp = 1): OptLeg {
  const T = e === 1 ? T1 : T2;
  const iv = smileIv(K, e) + shift;
  const p = bs(right, { S, K, T: T - el, r: R, sigma: iv }).price;
  return { kind: 'option', right, K, qty, premium: p, T, iv };
}
/** Closing trade for an existing leg at the current model value. */
function closeAt(l: OptLeg, S: number, el: number): OptLeg {
  const p = l.T - el <= 1e-9 ? Math.max(l.right === 'call' ? S - l.K : l.K - S, 0) : bs(l.right, { S, K: l.K, T: l.T - el, r: R, sigma: l.iv }).price;
  return { ...l, qty: -l.qty, premium: p };
}

/** Strike (5-point grid) whose model |delta| is closest to target. */
function strikeForDelta(right: Right, S: number, el: number, shift: number, target: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let K = 680; K <= 860; K += 5) {
    if (right === 'call' && K <= S) continue;
    if (right === 'put' && K >= S) continue;
    const d = Math.abs(bs(right, { S, K, T: T1 - el, r: R, sigma: smileIv(K) + shift }).delta);
    if (Math.abs(d - target) < bestD) {
      bestD = Math.abs(d - target);
      best = K;
    }
  }
  return best;
}

export interface Adjusted {
  legs: PLeg[];
  /** human description of the trades done */
  trades: string[];
  /** net premium of the adjustment trades (+ paid, − received) per share */
  cash: number;
  /** estimated bid/ask cost per share */
  slippage: number;
}

export function adjust(adj: Adj, S: number, day: number, shift: number): Adjusted {
  const el = day / 365;
  const base = shifted(STRANGLE, shift);
  const [put, call] = base;
  if (adj === 'none' || day >= 31) return { legs: base, trades: ['Hold the strangle'], cash: 0, slippage: 0 };
  if (adj === 'roll') {
    const tested = S >= 770 ? call : put;
    const target = Math.abs(bs(tested.right, { S: 769.66, K: tested.K, T: T1, r: R, sigma: tested.iv - shift }).delta);
    const K = strikeForDelta(tested.right, S, el, shift, target);
    const c = closeAt(tested, S, el);
    const o = openAt(tested.right, K, -1, S, el, shift);
    if (K === tested.K) return { legs: base, trades: ['Tested side is already at the target delta: no roll'], cash: 0, slippage: 0 };
    return {
      legs: [...base, c, o],
      trades: [`Buy back ${tested.K} ${tested.right} at ${c.premium.toFixed(2)}`, `Sell ${K} ${tested.right} at ${o.premium.toFixed(2)}`],
      cash: c.premium - o.premium,
      slippage: halfSpread(tested.right, tested.K) + halfSpread(tested.right, K),
    };
  }
  if (adj === 'out') {
    const cp = closeAt(put, S, el);
    const cc = closeAt(call, S, el);
    const np = openAt('put', 750, -1, S, el, shift, 2);
    const nc = openAt('call', 790, -1, S, el, shift, 2);
    return {
      legs: [...base, cp, cc, np, nc],
      trades: [
        `Buy back Nov 750 put / 790 call for ${(cp.premium + cc.premium).toFixed(2)}`,
        `Sell Dec 18 750 put / 790 call for ${(np.premium + nc.premium).toFixed(2)}`,
      ],
      cash: cp.premium + cc.premium - np.premium - nc.premium,
      slippage: halfSpread('put', 750) + halfSpread('call', 790) + halfSpread('put', 750, 2) + halfSpread('call', 790, 2),
    };
  }
  if (adj === 'wings') {
    const wp = openAt('put', 730, 1, S, el, shift);
    const wc = openAt('call', 810, 1, S, el, shift);
    return {
      legs: [...base, wp, wc],
      trades: [`Buy 730 put at ${wp.premium.toFixed(2)}`, `Buy 810 call at ${wc.premium.toFixed(2)}`],
      cash: wp.premium + wc.premium,
      slippage: halfSpread('put', 730) + halfSpread('call', 810),
    };
  }
  // delta hedge with shares
  const g = positionGreeks(base, { S, elapsed: el, r: R });
  const sh = -g.delta;
  return {
    legs: [...base, { kind: 'stock', qty: sh, entry: S }],
    trades: [`${sh >= 0 ? 'Buy' : 'Sell'} ${Math.abs(Math.round(sh * 100))} SPY shares at ${S.toFixed(2)}`],
    cash: 0,
    slippage: Math.abs(sh) * 0.005,
  };
}

export const pnlAt = (legs: PLeg[], S: number, el: number) => positionPnl(legs, { S, elapsed: el, r: R });
export const greeksAt = (legs: PLeg[], S: number, el: number) => positionGreeks(legs, { S, elapsed: el, r: R });
