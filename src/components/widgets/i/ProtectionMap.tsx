import { useRef, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { moneySigned } from './LineChart';
import { S0, STRUCT_KEYS, STRUCT_LABEL, optionLegs, pnlAtMove, cost100, type StructKey } from './structures';

const MOVES = [-0.05, -0.1, -0.2];
const ROWS: ('naked' | StructKey)[] = ['naked', ...STRUCT_KEYS];

/** I2: loss at −5%, −10%, −20% for each structure (100 shares, default strikes). */
export default function ProtectionMap() {
  const t = useTokens();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const [preset, setPreset] = useState<'a' | 'b'>('a');
  const s = preset === 'a' ? { long: 750, short: 700, call: 790 } : { long: 750, short: 720, call: 790 };
  const narrow = width < 520;

  const data = ROWS.map((k) => {
    const legs = k === 'naked' ? [] : optionLegs(k, s);
    return { k, label: k === 'naked' ? 'Unhedged' : STRUCT_LABEL[k], cost: cost100(legs), vals: MOVES.map((m) => pnlAtMove(legs, m)) };
  });
  const minV = Math.min(...data.flatMap((d) => d.vals));

  const m = { top: 8, right: 14, bottom: 26, left: narrow ? 96 : 120 };
  const rowH = narrow ? 52 : 46;
  const height = m.top + m.bottom + rowH * ROWS.length;
  const iw = Math.max(width - m.left - m.right, 80);
  const y = scaleBand<string>().domain(ROWS).range([0, rowH * ROWS.length]).paddingInner(0.25);
  const sub = scaleBand<string>().domain(MOVES.map(String)).range([0, y.bandwidth()]).paddingInner(0.12);
  const x = scaleLinear().domain([minV * 1.05, 0]).range([0, iw]).nice();
  const fills = [t.put, t.loss, t.ink];

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Protection map: what each hedge saves you"
        sub="P/L of 100 shares plus hedge if SPY falls 5%, 10% or 20% by Nov 27 (net of premium)"
        right={
          <Segmented
            label="Short put strike"
            value={preset}
            onChange={setPreset}
            options={[
              { value: 'a', label: '750 / 700' },
              { value: 'b', label: '750 / 720' },
            ]}
          />
        }
      />
      <div ref={wrap} className="w-full">
        <svg width={width} height={height} role="img" aria-label="Bar chart of losses at three market declines for each hedge structure" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {x.ticks(narrow ? 4 : 6).map((v) => (
              <g key={v} transform={`translate(${x(v)},0)`}>
                <line y2={rowH * ROWS.length} stroke={v === 0 ? t.axis : t.grid} />
                <text y={rowH * ROWS.length + 16} textAnchor="middle" fontSize={10.5} fill={t.muted}>
                  {v === 0 ? '$0' : `−$${Math.abs(v / 1000)}k`}
                </text>
              </g>
            ))}
            {data.map((d) => (
              <g key={d.k} transform={`translate(0,${y(d.k)})`}>
                <text x={-8} y={y.bandwidth() / 2 - 6} textAnchor="end" fontSize={11.5} fontWeight={600} fill={t.ink}>
                  {d.label}
                </text>
                <text x={-8} y={y.bandwidth() / 2 + 9} textAnchor="end" fontSize={10} fill={t.muted}>
                  {d.k === 'naked' ? 'no cost' : Math.abs(d.cost) < 0.5 ? 'zero cost' : d.cost > 0 ? `costs $${Math.round(d.cost)}` : `credit $${Math.round(-d.cost)}`}
                </text>
                {d.vals.map((v, i) => {
                  const w = x(0) - x(Math.min(v, 0));
                  const yy = sub(String(MOVES[i]))!;
                  // label outside (left of the bar) when there is room; inside only for the longest bars
                  const inside = x(Math.min(v, 0)) < 62 && w > 70;
                  return (
                    <g key={i}>
                      <rect x={x(Math.min(v, 0))} y={yy} width={Math.max(w, 1)} height={sub.bandwidth()} fill={fills[i]} opacity={0.85} rx={2} />
                      <text
                        x={inside ? x(Math.min(v, 0)) + 4 : x(Math.min(v, 0)) - 4}
                        y={yy + sub.bandwidth() / 2}
                        dy="0.34em"
                        textAnchor={inside ? 'start' : 'end'}
                        fontSize={9.5}
                        fontWeight={600}
                        fill={inside ? t.surface : t['ink-2']}
                      >
                        {moneySigned(v)}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <Legend
        items={[
          { label: `SPY −5% (${(S0 * 0.95).toFixed(0)})`, color: fills[0], kind: 'box' },
          { label: `SPY −10% (${(S0 * 0.9).toFixed(0)})`, color: fills[1], kind: 'box' },
          { label: `SPY −20% (${(S0 * 0.8).toFixed(0)})`, color: fills[2], kind: 'box' },
        ]}
      />
    </div>
  );
}
