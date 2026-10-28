import { snapshot, type ChainRow } from '../../../lib/snapshot';

/** Module A helpers (local, not shared). */

export const S0 = snapshot.spot;
export const MULT = 100;

export const callStrikes = snapshot.chain.calls.map((c) => c.strike);
export const putStrikes = snapshot.chain.puts.map((p) => p.strike);
export const allStrikes = Array.from(new Set([...callStrikes, ...putStrikes])).sort((a, b) => a - b);
export const bothStrikes = callStrikes.filter((k) => putStrikes.includes(k));

export function quote(right: 'call' | 'put', k: number): ChainRow | undefined {
  return (right === 'call' ? snapshot.chain.calls : snapshot.chain.puts).find((r) => r.strike === k);
}

export function isItm(right: 'call' | 'put', k: number, s = S0) {
  return right === 'call' ? s > k : s < k;
}

/** Whole-dollar money with sign: +$1,234 / −$56 / $0. */
export function money0(v: number, signed = true) {
  const r = Math.round(v);
  const sign = r < 0 ? '−' : r > 0 && signed ? '+' : '';
  return `${sign}\u2060$${Math.abs(r).toLocaleString('en-US')}`;
}

/** Two-decimal money with optional sign. */
export function money2(v: number, signed = false) {
  const sign = v < -0.004 ? '−' : v > 0.004 && signed ? '+' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const selectCls =
  'rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-2 py-1 text-[0.82rem] text-(--sl-color-white)';

export const expiryLabel = 'Nov 27';
