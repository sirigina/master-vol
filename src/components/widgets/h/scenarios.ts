/** H3/H4 named stress scenarios (instantaneous unless days > 0). */
export interface Scenario {
  id: string;
  label: string;
  move: number; // % SPY
  vol: number; // vol points, parallel
  days: number;
}
export const SCENARIOS: Scenario[] = [
  { id: 'crash', label: 'Crash: −10%, vol +10', move: -10, vol: 10, days: 0 },
  { id: 'selloff', label: 'Sell-off: −5%, vol +5', move: -5, vol: 5, days: 0 },
  { id: 'dip', label: 'Bad day: −2%, vol +2', move: -2, vol: 2, days: 0 },
  { id: 'quiet', label: 'Two quiet weeks: flat, vol −1', move: 0, vol: -1, days: 14 },
  { id: 'crush', label: 'Vol crush: flat, vol −3', move: 0, vol: -3, days: 0 },
  { id: 'rally', label: 'Rally: +5%, vol −2', move: 5, vol: -2, days: 0 },
  { id: 'gapup', label: 'Gap up with fear: +3%, vol +3', move: 3, vol: 3, days: 0 },
];
