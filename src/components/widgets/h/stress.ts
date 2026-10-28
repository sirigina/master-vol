/**
 * H4 stress replay: sell a 5% OTM strangle on a past date and reprice it on
 * each later close. IV for each strike = VIX-scaled copy of the snapshot smile
 * (sticky moneyness). Illustrative: VIX is a 30-day SPX index, not a quote.
 */
import { bs } from '../../../lib/pricing';
import { snapshot } from '../../../lib/snapshot';

const VIX0 = snapshot.index.VIX;
const S_SNAP = snapshot.spot;

/** Snapshot Nov smile as (moneyness K/S, IV/VIX) points using OTM options. */
const SMILE: [number, number][] = [
  ...snapshot.chain.puts.filter((p) => p.strike < S_SNAP).map((p) => [p.strike / S_SNAP, p.iv / (VIX0 / 100)] as [number, number]),
  ...snapshot.chain.calls.filter((c) => c.strike >= S_SNAP).map((c) => [c.strike / S_SNAP, c.iv / (VIX0 / 100)] as [number, number]),
].sort((a, b) => a[0] - b[0]);

export function smileRatio(m: number): number {
  if (m <= SMILE[0][0]) return SMILE[0][1];
  if (m >= SMILE[SMILE.length - 1][0]) return SMILE[SMILE.length - 1][1];
  for (let i = 1; i < SMILE.length; i++) {
    if (m <= SMILE[i][0]) {
      const [x0, y0] = SMILE[i - 1];
      const [x1, y1] = SMILE[i];
      return y0 + ((y1 - y0) * (m - x0)) / (x1 - x0);
    }
  }
  return 1;
}

export const ivFor = (K: number, S: number, vix: number) => (vix / 100) * smileRatio(K / S);

const vixMap = new Map(snapshot.vix.map(([d, v]) => [d, v]));
export const DAYS = snapshot.closes.map(([d, c]) => ({ d, date: new Date(d + 'T16:00:00'), S: c, vix: vixMap.get(d) ?? NaN })).filter((x) => !isNaN(x.vix));

const R = snapshot.rate;
const TENOR = 28;

export interface ReplayPoint {
  d: string;
  date: Date;
  S: number;
  vix: number;
  pnl: number;
  dte: number;
}

/** Short 1 put + 1 call, strikes `otm` away (rounded to $5), 28-day (four-week) tenor, $ per strangle. */
export function replay(entryIdx: number, otm = 0.05) {
  const e = DAYS[entryIdx];
  const Kp = Math.round((e.S * (1 - otm)) / 5) * 5;
  const Kc = Math.round((e.S * (1 + otm)) / 5) * 5;
  const t0 = e.date.getTime();
  const value = (S: number, vix: number, dte: number) => {
    const T = dte / 365;
    if (T <= 0) return Math.max(Kp - S, 0) + Math.max(S - Kc, 0);
    return bs('put', { S, K: Kp, T, r: R, sigma: ivFor(Kp, S, vix) }).price + bs('call', { S, K: Kc, T, r: R, sigma: ivFor(Kc, S, vix) }).price;
  };
  const credit = value(e.S, e.vix, TENOR);
  const pts: ReplayPoint[] = [];
  for (let i = entryIdx; i < DAYS.length; i++) {
    const x = DAYS[i];
    const dte = TENOR - Math.round((x.date.getTime() - t0) / 864e5);
    if (dte < 0) break;
    pts.push({ d: x.d, date: x.date, S: x.S, vix: x.vix, dte, pnl: (credit - value(x.S, x.vix, dte)) * 100 });
  }
  const worst = pts.reduce((a, b) => (b.pnl < a.pnl ? b : a), pts[0]);
  return { entry: e, Kp, Kc, credit: credit * 100, pts, worst, final: pts[pts.length - 1] };
}
