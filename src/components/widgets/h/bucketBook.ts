/** H4 sample book spread across expiries, valued with Black-Scholes at quoted IVs. */
import { bs, type Right } from '../../../lib/pricing';
import { snapshot, callAt, putAt, call2At, put2At } from '../../../lib/snapshot';

const S0 = snapshot.spot;
const R = snapshot.rate;

export interface BLeg {
  expiry: string;
  dte: number;
  right: Right;
  K: number;
  qty: number;
  iv: number;
}

const ts = (exp: string) => snapshot.termStructure.find((p) => p.expiry === exp)!;
const straddle = (exp: string, qty: number): BLeg[] => {
  const p = ts(exp);
  return [
    { expiry: exp, dte: p.dte, right: 'call', K: 770, qty, iv: p.callIv },
    { expiry: exp, dte: p.dte, right: 'put', K: 770, qty, iv: p.putIv },
  ];
};

export const SAMPLE_BOOK: { label: string; legs: BLeg[] }[] = [
  { label: 'Short 10 Nov 6 770 straddles', legs: straddle('2026-11-06', -10) },
  { label: 'Short 6 Nov 13 770 straddles', legs: straddle('2026-11-13', -6) },
  {
    label: 'Short 10 Nov 27 750/790 strangles',
    legs: [
      { expiry: '2026-11-27', dte: 31, right: 'put', K: 750, qty: -10, iv: putAt(750)!.iv },
      { expiry: '2026-11-27', dte: 31, right: 'call', K: 790, qty: -10, iv: callAt(790)!.iv },
    ],
  },
  {
    label: 'Long 6 Dec 18 770 straddles',
    legs: [
      { expiry: '2026-12-18', dte: 52, right: 'call', K: 770, qty: 6, iv: call2At(770)!.iv },
      { expiry: '2026-12-18', dte: 52, right: 'put', K: 770, qty: 6, iv: put2At(770)!.iv },
    ],
  },
  { label: 'Long 4 Mar 19 770 straddles', legs: straddle('2027-03-19', 4) },
];

export interface Bucket {
  expiry: string;
  label: string;
  dte: number;
  gamma: number;
  vega: number;
  theta: number;
  /** vega scaled by sqrt(30/dte): short-dated vol moves more */
  wvega: number;
}

export function buckets(): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const pos of SAMPLE_BOOK)
    for (const l of pos.legs) {
      const g = bs(l.right, { S: S0, K: l.K, T: l.dte / 365, r: R, sigma: l.iv });
      const b =
        map.get(l.expiry) ??
        ({ expiry: l.expiry, label: new Date(l.expiry + 'T16:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), dte: l.dte, gamma: 0, vega: 0, theta: 0, wvega: 0 } as Bucket);
      const m = l.qty * 100;
      b.gamma += m * g.gamma;
      b.vega += m * g.vega;
      b.theta += m * g.theta;
      b.wvega += m * g.vega * Math.sqrt(30 / l.dte);
      map.set(l.expiry, b);
    }
  return [...map.values()].sort((a, b) => a.dte - b.dte);
}
