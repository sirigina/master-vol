import { scaleLinear, line, area } from 'd3';
import { useTokens } from '../../../lib/useViz';
import { horizonPnl, SD, type Family } from './G7_families';
import { S0 } from './G6_helpers';

const N = 61;

/** Small payoff thumbnail at the Nov 27 horizon, SPY within ±2 SD. */
export default function Thumb({ f, w = 120, h = 48 }: { f: Family; w?: number; h?: number }) {
  const t = useTokens();
  const xs = Array.from({ length: N }, (_, i) => S0 - 2 * SD + (4 * SD * i) / (N - 1));
  const ys = xs.map((s) => horizonPnl(f, s));
  const lo = Math.min(0, ...ys);
  const hi = Math.max(0, ...ys);
  const x = scaleLinear().domain([xs[0], xs[N - 1]]).range([2, w - 2]);
  const y = scaleLinear().domain([lo, hi]).range([h - 3, 3]);
  const idx = xs.map((_, i) => i);
  return (
    <svg width={w} height={h} role="img" aria-label={`${f.name} payoff at Nov 27`} style={{ display: 'block', flex: 'none' }}>
      <path d={area<number>().x((i) => x(xs[i])).y0(y(0)).y1((i) => y(Math.max(ys[i], 0)))(idx) ?? ''} fill={t['profit-wash']} />
      <path d={area<number>().x((i) => x(xs[i])).y0(y(0)).y1((i) => y(Math.min(ys[i], 0)))(idx) ?? ''} fill={t['loss-wash']} />
      <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={t.axis} />
      <line x1={x(S0)} x2={x(S0)} y1={0} y2={h} stroke={t.muted} strokeDasharray="2 2" />
      <path d={line<number>().x((i) => x(xs[i])).y((i) => y(ys[i]))(idx) ?? ''} fill="none" stroke={t.ink} strokeWidth={1.6} />
    </svg>
  );
}
