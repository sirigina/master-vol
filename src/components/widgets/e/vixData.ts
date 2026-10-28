/** VIX vs subsequent SPY realized volatility, shared by E1 and E4. */
import { snapshot, closes, atmIv } from '../../../lib/snapshot';
import { bs, logReturns, stdev } from '../../../lib/pricing';

export const FWD_H = 21;
const VIX = new Map(snapshot.vix);
export const LAST_VIX = snapshot.vix[snapshot.vix.length - 1][1];
/** Today's gap between VIX (which includes the put skew) and the ATM SPY implied vol. */
export const SKEW_GAP = LAST_VIX - atmIv * 100;

/** For each day: VIX that day vs SPY realized over the next FWD_H sessions. */
export const VIX_FWD = (() => {
  const out: { date: Date; iso: string; vix: number; rv: number }[] = [];
  for (let i = 0; i + FWD_H < closes.length; i++) {
    const iso = snapshot.closes[i][0];
    const v = VIX.get(iso);
    if (v === undefined) continue;
    const rv = stdev(logReturns(closes.slice(i, i + FWD_H + 1))) * Math.sqrt(252) * 100;
    out.push({ date: new Date(iso + 'T16:00:00'), iso, vix: v, rv });
  }
  return out;
})();

/** SPY drawdown from its running peak, in %, for every close. */
export const DRAWDOWN = (() => {
  let peak = 0;
  return snapshot.closes.map(([iso, c]) => {
    peak = Math.max(peak, c);
    return { date: new Date(iso + 'T16:00:00'), iso, close: c, dd: (c / peak - 1) * 100 };
  });
})();

export const VIX_SERIES = snapshot.vix.map(([iso, v]) => ({ date: new Date(iso + 'T16:00:00'), iso, vix: v }));

/**
 * Backtest: on each start date, sell a 21-session ATM SPY straddle priced at
 * (VIX − shift) and delta-hedge it at every close with r = 0. Returns P/L per
 * straddle (100 shares) and in vol points (P/L ÷ starting vega).
 */
export function shortVolBacktest(shift: number) {
  const out: { date: Date; iso: string; iv: number; pnl: number; volPts: number }[] = [];
  const T = FWD_H / 252;
  for (let i = 0; i + FWD_H < closes.length; i++) {
    const iso = snapshot.closes[i][0];
    const v = VIX.get(iso);
    if (v === undefined) continue;
    const iv = (v - shift) / 100;
    const K = closes[i];
    const val = (S: number, t: number) => {
      const c = bs('call', { S, K, T: t, r: 0, sigma: iv });
      const p = bs('put', { S, K, T: t, r: 0, sigma: iv });
      return { price: c.price + p.price, delta: c.delta + p.delta, vega: c.vega + p.vega };
    };
    const v0 = val(K, T);
    let h = v0.delta;
    let hedge = 0;
    for (let j = 1; j <= FWD_H; j++) {
      hedge += h * (closes[i + j] - closes[i + j - 1]);
      if (j < FWD_H) h = val(closes[i + j], T - j / 252).delta;
    }
    const payoff = Math.abs(closes[i + FWD_H] - K);
    // short straddle: keep the premium, pay the payoff, and the hedge (long delta shares) is the mirror of the long's
    const pnl = -(payoff - v0.price - hedge) * 100;
    out.push({ date: new Date(iso + 'T16:00:00'), iso, iv: iv * 100, pnl, volPts: pnl / (v0.vega * 100) });
  }
  return out;
}
