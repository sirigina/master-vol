/** Module I helpers: option quotes by expiry, built on the shared snapshot. */
import { snapshot, callAt, putAt, call2At, put2At } from '../../../lib/snapshot';
import type { ChainRow } from '../../../lib/snapshot';

export type Expiry = 'nov' | 'dec';
export const S0 = snapshot.spot;
export const DTE: Record<Expiry, number> = { nov: snapshot.chain.dte, dec: snapshot.chain2.dte };
export const EXP_LABEL: Record<Expiry, string> = { nov: 'Nov 27', dec: 'Dec 18' };

export function quote(exp: Expiry, right: 'call' | 'put', k: number): ChainRow | undefined {
  if (exp === 'nov') return right === 'call' ? callAt(k) : putAt(k);
  return right === 'call' ? call2At(k) : put2At(k);
}

export function strikes(exp: Expiry, right: 'call' | 'put'): number[] {
  const c = exp === 'nov' ? snapshot.chain : snapshot.chain2;
  return (right === 'call' ? c.calls : c.puts).map((r) => r.strike);
}

/** SPX / SPY ratio at the snapshot (about 10.03). */
export const SPX_RATIO = snapshot.index.SPX / snapshot.spot;
