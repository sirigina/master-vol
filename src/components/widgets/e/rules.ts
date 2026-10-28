import type { Rule } from './hedgeSim';

export interface NamedRule {
  id: string;
  label: string;
  short: string;
  rule: Rule;
}

/** The four hedging rules compared in E3. Intraday rules are checked every half hour. */
export const RULES: NamedRule[] = [
  { id: 'weekly', label: 'Weekly (every 5th close)', short: 'Weekly', rule: { kind: 'every', steps: 65 } },
  { id: 'daily', label: 'Daily at the close', short: 'Daily', rule: { kind: 'every', steps: 13 } },
  { id: 'band', label: 'Delta band ±100 shares', short: 'Delta band', rule: { kind: 'band', shares: 100 } },
  { id: 'move', label: 'SPY moves $4 from last hedge', short: '$4 move', rule: { kind: 'move', dollars: 4 } },
];
