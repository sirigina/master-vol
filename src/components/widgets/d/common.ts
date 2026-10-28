/** Module D helpers shared by the Greeks widgets. */
import { snapshot, atmIv } from '../../../lib/snapshot';
import { bs, type Right } from '../../../lib/pricing';

export const S0 = snapshot.spot;
export const R = snapshot.rate;
export const IV0 = Math.round(atmIv * 10000) / 10000; // 0.1406
export const K0 = 770;

/** Black-Scholes for the 770 strike (or any K) with snapshot rate. dte in calendar days. */
export function g(right: Right, S: number, K: number, dte: number, sigma: number, q = 0) {
  return bs(right, { S, K, T: Math.max(dte, 0) / 365, r: R, sigma, q });
}

export const usd0 = (v: number) => `${v < -0.5 ? '−' : v > 0.5 ? '+' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
export const usd2 = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
export const sgn = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

/** Short label for an ISO date, e.g. "Nov 27" or "Dec '27". */
export function expLabel(iso: string, withYear = false) {
  const d = new Date(iso + 'T12:00:00');
  const m = d.toLocaleString('en-US', { month: 'short' });
  return withYear || d.getFullYear() !== 2026 ? `${m} ${d.getDate()} '${String(d.getFullYear()).slice(2)}` : `${m} ${d.getDate()}`;
}

/** Default slider volatility in percent (the snapshot ATM IV, 14.06). Sliders use step 0.01 so this is reachable. */
export const VOL0 = Math.round(IV0 * 10000) / 100;
