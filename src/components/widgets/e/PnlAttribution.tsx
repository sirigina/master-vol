import { useRef, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { fmt } from '../../../lib/snapshot';
import { ENTRY, IV, S0, T0, UNITS, straddle, usd0 } from './hedgeSim';

type Preset = 'custom' | 'calm' | 'selloff' | 'crush';
const PRESETS: Record<Exclude<Preset, 'custom'>, { move: number; dIv: number; days: number }> = {
  calm: { move: 4, dIv: 0, days: 5 },
  selloff: { move: -20, dIv: 5, days: 1 },
  crush: { move: 8, dIv: -2.5, days: 3 },
};

/**
 * E4: P/L attribution of a delta-hedged 770 straddle for a scenario, split
 * into gamma, theta, vega and the higher-order remainder.
 */
export default function PnlAttribution() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [side, setSide] = useState<'short' | 'long'>('short');
  const [move, setMove] = useState(-20);
  const [dIv, setDIv] = useState(5);
  const [days, setDays] = useState(1);
  const [preset, setPreset] = useState<Preset>('selloff');

  const sgn = side === 'long' ? 1 : -1;
  const u = sgn * UNITS;
  const tau = Math.max(T0 - days / 365, 1e-6);
  const full = u * (straddle(S0 + move, tau, IV + dIv / 100).price - ENTRY.price - ENTRY.delta * move);
  const gamma = u * 0.5 * ENTRY.gamma * move * move;
  const theta = u * ENTRY.theta * days;
  const vega = u * ENTRY.vega * dIv;
  const rest = full - gamma - theta - vega;
  const bars = [
    { key: 'Gamma', v: gamma, sub: '½ Γ × move²', c: t.call },
    { key: 'Theta', v: theta, sub: 'time decay', c: t.put },
    { key: 'Vega', v: vega, sub: 'vega × IV change', c: t.stock },
    { key: 'Other', v: rest, sub: 'higher-order', c: t.muted },
    { key: 'Total', v: full, sub: 'full reprice', c: full >= 0 ? t.profit : t.loss },
  ];

  const narrow = width < 520;
  const m = { top: 12, right: 12, bottom: 40, left: narrow ? 46 : 60 };
  const height = 260;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;
  const x = scaleBand<string>().domain(bars.map((b) => b.key)).range([0, iw]).padding(0.3);
  const ext = Math.max(...bars.map((b) => Math.abs(b.v)), 500);
  const y = scaleLinear().domain([-ext, ext]).nice(5).range([ih, 0]);

  const apply = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      setMove(PRESETS[p].move);
      setDIv(PRESETS[p].dIv);
      setDays(PRESETS[p].days);
    }
  };
  const k = (v: number) => (v === 0 ? '0' : `${v < 0 ? '−' : ''}${Math.abs(v) >= 1000 ? `${Math.abs(v / 1000)}k` : Math.abs(v)}`);

  return (
    <div className="viz-card not-content">
      <CardHead title="Where the P/L came from" sub={`Illustration: 10 Nov 27 770 straddles at ${fmt.pct(IV, 2)}, delta-hedged at ${S0}, not rehedged during the scenario`} />
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Position</div>
          <Segmented
            label="Position"
            value={side}
            onChange={setSide}
            options={[
              { value: 'short', label: 'Short straddle' },
              { value: 'long', label: 'Long straddle' },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Scenario</div>
          <Segmented
            label="Scenario"
            value={preset}
            onChange={apply}
            options={[
              { value: 'selloff', label: 'Selloff' },
              { value: 'crush', label: 'Rally, IV down' },
              { value: 'calm', label: 'Calm week' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </div>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Slider label="SPY move" value={move} min={-40} max={40} step={1} onChange={(v) => (setMove(v), setPreset('custom'))} format={(v) => `${fmt.signed(v, 0)} dollars`} />
        <Slider label="Implied vol change" value={dIv} min={-6} max={12} step={0.5} onChange={(v) => (setDIv(v), setPreset('custom'))} format={(v) => `${fmt.signed(v, 1)} pts`} />
        <Slider label="Days passed" value={days} min={0} max={20} step={1} onChange={(v) => (setDays(v), setPreset('custom'))} format={(v) => `${v} calendar`} />
      </div>
      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label="Bar chart of P/L by source: gamma, theta, vega, other, total" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(5).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={v === 0 ? t.axis : t.grid} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {k(v)}
                </text>
              </g>
            ))}
            {bars.map((b) => {
              const x0 = x(b.key)!;
              const top = Math.min(y(b.v), y(0));
              const h = Math.max(Math.abs(y(b.v) - y(0)), 1);
              const above = b.v >= 0;
              return (
                <g key={b.key}>
                  <rect x={x0} width={x.bandwidth()} y={top} height={h} rx={3} fill={b.c} opacity={b.key === 'Other' ? 0.6 : 1} />
                  <text x={x0 + x.bandwidth() / 2} y={above ? top - 5 : top + h + 13} textAnchor="middle" fontSize={11} fontWeight={600} fill={t.ink}>
                    {usd0(b.v)}
                  </text>
                  <text x={x0 + x.bandwidth() / 2} y={ih + 16} textAnchor="middle" fontSize={11} fontWeight={600} fill={t['ink-2']}>
                    {b.key}
                  </text>
                  {!narrow && (
                    <text x={x0 + x.bandwidth() / 2} y={ih + 30} textAnchor="middle" fontSize={10} fill={t.muted}>
                      {b.sub}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <StatGrid
        items={[
          ['Position vega', `${usd0(u * ENTRY.vega)} / pt`, 'per vol point'],
          ['Position gamma', `${(u * ENTRY.gamma).toFixed(1)} sh / $`, 'delta change per $1'],
          ['Theta', `${usd0(u * ENTRY.theta)} / day`, 'per calendar day'],
          ['Vega share of |P/L|', `${((100 * Math.abs(vega)) / (Math.abs(gamma) + Math.abs(theta) + Math.abs(vega) + Math.abs(rest) || 1)).toFixed(0)}%`, 'of the gross components'],
        ]}
      />
    </div>
  );
}
