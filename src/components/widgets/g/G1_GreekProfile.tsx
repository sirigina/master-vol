import { useMemo, useRef, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { greeksAt, contractGreeks, net } from './G1_kit';
import { STRUCTS } from './G1_SpreadCompare';

const GREEKS = [
  { key: 'delta', label: 'Delta', unit: 'shares' },
  { key: 'gamma', label: 'Gamma', unit: 'shares per $1' },
  { key: 'theta', label: 'Theta', unit: '$ per day' },
  { key: 'vega', label: 'Vega', unit: '$ per vol point' },
] as const;

/** G1: Greeks per contract vs per $1,000 of premium, one panel per Greek with its own scale. */
export default function G1GreekProfile() {
  const [mode, setMode] = useState<'per1k' | 'contract'>('per1k');
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hover, setHover] = useState<string | null>(null);

  const vals = useMemo(
    () =>
      STRUCTS.map((s) => {
        const g = contractGreeks(greeksAt(s.legs));
        const scale = mode === 'per1k' ? 1000 / (net(s.legs) * 100) : 1;
        return { ...s, v: { delta: g.delta * scale, gamma: g.gamma * scale, theta: g.theta * scale, vega: g.vega * scale } };
      }),
    [mode],
  );
  const colorOf = (k: string) => (k === 'call' ? t.call : k === 'vert' ? t.stock : t.put);

  const cols = width < 560 ? 2 : 4;
  const gap = 14;
  const pw = (width - gap * (cols - 1)) / cols;
  const ph = 190;
  const m = { top: 30, bottom: 16, left: 6, right: 6 };
  const fmtV = (v: number) => {
    const a = Math.abs(v);
    const s = a < 0.995 ? a.toFixed(2) : a < 10 ? a.toFixed(1) : a.toFixed(0);
    return `${v < 0 ? '−' : ''}${s}`;
  };

  return (
    <div className="viz-card not-content">
      <CardHead
        title="What each structure is really exposed to"
        sub={mode === 'per1k' ? 'Greeks for every $1,000 of premium paid. Each panel has its own scale.' : 'Greeks for one contract of each. Each panel has its own scale.'}
        right={
          <Segmented
            label="Scale"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'per1k', label: 'Per $1,000 premium' },
              { value: 'contract', label: 'Per contract' },
            ]}
          />
        }
      />
      <div ref={wrap} className="relative w-full">
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
          {GREEKS.map((gk) => {
            const vs = vals.map((s) => s.v[gk.key]);
            const ext = Math.max(...vs.map(Math.abs)) * 1.25 || 1;
            const lo = Math.min(0, ...vs) < 0 ? -ext : 0;
            const hi = Math.max(0, ...vs) > 0 ? ext : 0;
            const y = scaleLinear().domain([lo === 0 && hi === 0 ? -1 : lo, hi === 0 && lo === 0 ? 1 : hi]).range([ph - m.top - m.bottom, 0]);
            const x = scaleBand().domain(vals.map((s) => s.key)).range([m.left, pw - m.right]).padding(0.25);
            return (
              <svg key={gk.key} width={pw} height={ph} role="img" aria-label={`${gk.label} by structure`} style={{ display: 'block' }}>
                <text x={0} y={13} fontSize={12} fontWeight={600} fill={t.ink}>
                  {gk.label}
                </text>
                <text x={0} y={25} fontSize={10} fill={t.muted}>
                  {gk.unit}
                </text>
                <g transform={`translate(0,${m.top})`}>
                  <line x1={0} x2={pw} y1={y(0)} y2={y(0)} stroke={t.axis} />
                  {vals.map((s) => {
                    const v = s.v[gk.key];
                    const y0 = y(Math.max(v, 0));
                    const h = Math.abs(y(v) - y(0));
                    const on = hover === null || hover === s.key;
                    return (
                      <g key={s.key} onPointerEnter={() => setHover(s.key)} onPointerLeave={() => setHover(null)}>
                        <rect x={x(s.key)} y={y0} width={x.bandwidth()} height={Math.max(h, 1)} fill={colorOf(s.key)} opacity={on ? 1 : 0.3} rx={2} />
                        <text
                          x={x(s.key)! + x.bandwidth() / 2}
                          y={v >= 0 ? y(v) - 4 : y(v) + 11}
                          textAnchor="middle"
                          fontSize={10}
                          fill={t['ink-2']}
                          opacity={on ? 1 : 0.4}
                        >
                          {fmtV(v)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            );
          })}
        </div>
      </div>
      <Legend items={STRUCTS.map((s) => ({ label: s.label, color: colorOf(s.key), kind: 'box' as const }))} />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Model Greeks at the snapshot (SPY 769.66, each strike at its own IV). Premiums per contract: call $1,390, vertical $946, butterfly $166.
      </p>
    </div>
  );
}
