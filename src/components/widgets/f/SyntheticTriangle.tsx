import { useState } from 'react';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { pairAt, S0, money } from './fdata';

type Node = 'stock' | 'call' | 'put';

const pos: Record<Node, [number, number]> = { stock: [180, 34], call: [52, 214], put: [308, 214] };

/**
 * Stock, call and put at one strike: any two build the third. Click a corner
 * to see the recipe with snapshot prices.
 */
export default function SyntheticTriangle() {
  const t = useTokens();
  const [target, setTarget] = useState<Node>('stock');
  const { call, put } = pairAt('nov', 770);
  const C = call.mark;
  const P = put.mark;

  const color: Record<Node, string> = { stock: t.stock, call: t.call, put: t.put };
  const recipe: Record<Node, { long: string; short: string; eq: string; cost: string }> = {
    stock: {
      long: 'Long call + short put',
      short: 'Short call + long put',
      eq: 'Stock ≈ Call − Put (+ the strike, paid later)',
      cost: `${money(C)} − ${money(P)} = ${money(C - P)} today, then 770 at expiry, versus ${money(S0)} for SPY now`,
    },
    call: {
      long: 'Long stock + long put',
      short: 'Short stock + short put',
      eq: 'Call ≈ Stock + Put (− the strike, received later)',
      cost: `${money(S0)} + ${money(P)} = ${money(S0 + P)} today, you get 770 back if SPY ends below the strike`,
    },
    put: {
      long: 'Short stock + long call',
      short: 'Long stock + short call',
      eq: 'Put ≈ Call − Stock (+ the strike, paid later)',
      cost: `${money(C)} − ${money(S0)} = −${money(S0 - C)} today (a credit), offset by the 770 strike at expiry`,
    },
  };
  const others = (['stock', 'call', 'put'] as Node[]).filter((n) => n !== target);
  const r = recipe[target];

  return (
    <div className="viz-card not-content">
      <CardHead title="The synthetic triangle" sub="Click a corner. The other two corners, at the same strike and expiry, rebuild it." />
      <div className="grid items-center gap-4 sm:grid-cols-[360px_1fr]">
        <svg viewBox="0 0 360 252" width="100%" style={{ maxWidth: 360, display: 'block' }} role="img" aria-label="Triangle linking stock, call and put">
          {(
            [
              ['stock', 'call'],
              ['call', 'put'],
              ['put', 'stock'],
            ] as [Node, Node][]
          ).map(([a, b]) => {
            const active = a !== target && b !== target;
            return (
              <line
                key={a + b}
                x1={pos[a][0]}
                y1={pos[a][1]}
                x2={pos[b][0]}
                y2={pos[b][1]}
                stroke={active ? t.ink : t.grid}
                strokeWidth={active ? 3 : 2}
                strokeDasharray={active ? undefined : '4 4'}
              />
            );
          })}
          {others.map((n) => (
            <path
              key={'arr' + n}
              d={`M${pos[n][0] + (pos[target][0] - pos[n][0]) * 0.22},${pos[n][1] + (pos[target][1] - pos[n][1]) * 0.22} L${pos[n][0] + (pos[target][0] - pos[n][0]) * 0.7},${pos[n][1] + (pos[target][1] - pos[n][1]) * 0.7}`}
              stroke={color[target]}
              strokeWidth={2}
              markerEnd="url(#tri-arrow)"
              fill="none"
            />
          ))}
          <defs>
            <marker id="tri-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={color[target]} />
            </marker>
          </defs>
          {(Object.keys(pos) as Node[]).map((n) => {
            const on = n === target;
            return (
              <g key={n} transform={`translate(${pos[n][0]},${pos[n][1]})`} style={{ cursor: 'pointer' }} onClick={() => setTarget(n)} role="button" aria-label={`Build ${n}`}>
                <circle r={30} fill={on ? color[n] : t.surface} stroke={color[n]} strokeWidth={3} />
                <text textAnchor="middle" dy="0.35em" fontSize={14} fontWeight={600} fill={on ? t.surface : t.ink}>
                  {n === 'stock' ? 'Stock' : n === 'call' ? 'Call' : 'Put'}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="grid gap-2 text-[0.88rem]">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Build the {target}</div>
          <div className="text-[1rem] font-semibold">{r.eq}</div>
          <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
            <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Long {target}</div>
            <div className="font-medium">{r.long}</div>
          </div>
          <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
            <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Short {target}</div>
            <div className="font-medium">{r.short}</div>
          </div>
          <div className="text-[0.8rem] text-(--sl-color-gray-3)">770 strike, Nov 27: {r.cost}.</div>
        </div>
      </div>
    </div>
  );
}
