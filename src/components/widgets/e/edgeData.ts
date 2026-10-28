/** Shared E1 helpers: the out-of-the-money Nov 27 chain with IVs recomputed from the mid. */
import { bs, impliedVol, type Right } from '../../../lib/pricing';
import { snapshot, T_EXPIRY } from '../../../lib/snapshot';

export interface EdgeRow {
  key: string;
  right: Right;
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  /** IV implied by the mid, our model (r from parity, q = 0) */
  iv: number;
}

const S = snapshot.spot;
const r = snapshot.rate;

/** OTM puts below 770, both 770s, OTM calls above. */
export const EDGE_ROWS: EdgeRow[] = [
  ...snapshot.chain.puts.filter((p) => p.strike <= 770).map((p) => ({ right: 'put' as const, row: p })),
  ...snapshot.chain.calls.filter((c) => c.strike >= 770).map((c) => ({ right: 'call' as const, row: c })),
].map(({ right, row }) => ({
  key: `${row.strike}${right === 'call' ? 'C' : 'P'}`,
  right,
  strike: row.strike,
  bid: row.bid,
  ask: row.ask,
  mid: row.mark,
  iv: impliedVol(right, row.mark, { S, K: row.strike, T: T_EXPIRY, r }),
}));

export const theo = (right: Right, K: number, sigma: number) => bs(right, { S, K, T: T_EXPIRY, r, sigma });

/** 770 straddle quoted at the mids, and the single vol that reprices it. */
export const STRADDLE_MKT = snapshot.chain.calls.find((c) => c.strike === 770)!.mark + snapshot.chain.puts.find((p) => p.strike === 770)!.mark;
export const straddleTheo = (sigma: number) => {
  const c = theo('call', 770, sigma);
  const p = theo('put', 770, sigma);
  return { price: c.price + p.price, vega: c.vega + p.vega };
};
export const STRADDLE_IV = (() => {
  let lo = 0.01;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (straddleTheo(m).price > STRADDLE_MKT) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
})();
