import raw from '../data/snapshot-2026-10-27.json';

export interface ChainRow {
  strike: number;
  bid: number;
  ask: number;
  mark: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export const snapshot = raw as {
  asOf: string;
  asOfLabel: string;
  source: string;
  symbol: string;
  spot: number;
  rate: number;
  rateNote: string;
  dividendYield: number;
  /** Nov 27, 2026 expiry (31 days) */
  chain: { expiry: string; dte: number; calls: ChainRow[]; puts: ChainRow[] };
  /** Dec 18, 2026 expiry (52 days), fewer strikes */
  chain2: { expiry: string; dte: number; calls: ChainRow[]; puts: ChainRow[] };
  closes: [string, number][];
  /** 770-strike call/put across expiries */
  termStructure: TermPoint[];
  index: { SPX: number; VIX: number };
  vix: [string, number][];
  earnings: {
    symbol: string;
    spot: number;
    strike: number;
    reportDate: string;
    timing: string;
    expiries: { expiry: string; dte: number; callMark: number; callIv: number; putMark: number; putIv: number; straddle: number }[];
  };
};

export interface TermPoint {
  expiry: string;
  dte: number;
  callMark: number;
  callIv: number;
  putMark: number;
  putIv: number;
  atmIv: number;
  straddle: number;
}

export const closes = snapshot.closes.map((c) => c[1]);
export const dates = snapshot.closes.map((c) => new Date(c[0] + 'T16:00:00'));
export const T_EXPIRY = snapshot.chain.dte / 365;

export const callAt = (k: number) => snapshot.chain.calls.find((c) => c.strike === k);
export const putAt = (k: number) => snapshot.chain.puts.find((c) => c.strike === k);

/** At-the-money IV: average of the call and put nearest spot. */
export const atmStrike = snapshot.chain.calls.reduce((best, c) =>
  Math.abs(c.strike - snapshot.spot) < Math.abs(best.strike - snapshot.spot) ? c : best,
).strike;
export const atmIv = (callAt(atmStrike)!.iv + putAt(atmStrike)!.iv) / 2;

export const fmt = {
  usd: (v: number, d = 2) => `$${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`,
  num: (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (v: number, d = 1) => `${(v * 100).toFixed(d)}%`,
  signed: (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`,
};

export const call2At = (k: number) => snapshot.chain2.calls.find((c) => c.strike === k);
export const put2At = (k: number) => snapshot.chain2.puts.find((c) => c.strike === k);
export const T_EXPIRY2 = snapshot.chain2.dte / 365;
export const vixDates = snapshot.vix.map((v) => new Date(v[0] + 'T16:00:00'));
export const vixValues = snapshot.vix.map((v) => v[1]);
