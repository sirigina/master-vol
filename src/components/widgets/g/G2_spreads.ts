import type { OptLeg } from '../../../lib/position';
import { leg, leg2 } from './G1_kit';

export type Family = 'long' | 'short' | 'mixed';
export interface SpreadDef {
  key: string;
  label: string;
  short: string;
  family: Family;
  desc: string;
  legs: OptLeg[];
}

/** The G2 catalogue. All Nov 27 at real marks, except the calendar's long leg (Dec 18). */
export const SPREADS: SpreadDef[] = [
  { key: 'lstrad', label: 'Long straddle', short: 'Long straddle', family: 'long', desc: 'Buy 770 call + buy 770 put', legs: [leg('call', 770, 1), leg('put', 770, 1)] },
  { key: 'lstrang', label: 'Long strangle', short: 'Long strangle', family: 'long', desc: 'Buy 750 put + buy 790 call', legs: [leg('put', 750, 1), leg('call', 790, 1)] },
  { key: 'cback', label: 'Call backspread', short: 'Call backsp.', family: 'long', desc: 'Sell 1 770 call, buy 2 790 calls', legs: [leg('call', 770, -1), leg('call', 790, 2)] },
  { key: 'pback', label: 'Put backspread', short: 'Put backsp.', family: 'long', desc: 'Sell 1 770 put, buy 2 750 puts', legs: [leg('put', 770, -1), leg('put', 750, 2)] },
  { key: 'sfly', label: 'Short butterfly', short: 'Short fly', family: 'long', desc: 'Sell 750 call, buy 2 770 calls, sell 790 call', legs: [leg('call', 750, -1), leg('call', 770, 2), leg('call', 790, -1)] },
  { key: 'sstrad', label: 'Short straddle', short: 'Short straddle', family: 'short', desc: 'Sell 770 call + sell 770 put', legs: [leg('call', 770, -1), leg('put', 770, -1)] },
  { key: 'sstrang', label: 'Short strangle', short: 'Short strangle', family: 'short', desc: 'Sell 750 put + sell 790 call', legs: [leg('put', 750, -1), leg('call', 790, -1)] },
  { key: 'cratio', label: 'Call ratio spread', short: 'Call ratio', family: 'short', desc: 'Buy 1 770 call, sell 2 790 calls', legs: [leg('call', 770, 1), leg('call', 790, -2)] },
  { key: 'pratio', label: 'Put ratio spread', short: 'Put ratio', family: 'short', desc: 'Buy 1 770 put, sell 2 750 puts', legs: [leg('put', 770, 1), leg('put', 750, -2)] },
  { key: 'lfly', label: 'Long butterfly', short: 'Long fly', family: 'short', desc: 'Buy 750 call, sell 2 770 calls, buy 790 call', legs: [leg('call', 750, 1), leg('call', 770, -2), leg('call', 790, 1)] },
  { key: 'cal', label: 'Long calendar', short: 'Calendar', family: 'mixed', desc: 'Sell Nov 27 770 call, buy Dec 18 770 call', legs: [leg('call', 770, -1), leg2('call', 770, 1)] },
];

export const FAMILY_LABEL: Record<Family, string> = {
  long: 'Long volatility',
  short: 'Short volatility',
  mixed: 'The exception',
};
