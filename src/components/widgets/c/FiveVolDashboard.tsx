import { useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import { CardHead } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, closes, atmIv } from '../../../lib/snapshot';
import { realizedVol, rollingVol } from '../../../lib/pricing';
import { volCone } from './volmath';

const hv1y = realizedVol(closes) * 100;
const hv20 = rollingVol(closes, 20).at(-1)! * 100;
const iv = atmIv * 100;
const vix = snapshot.index.VIX;
const forecast = (hv1y + hv20 + iv) / 3;
const c20 = volCone().find((c) => c.w === 20)!;

type Key = 'future' | 'hist' | 'forecast' | 'implied' | 'seasonal';

const INFO: Record<Key, { name: string; q: string; body: string }> = {
  future: {
    name: 'Future',
    q: 'How much will SPY actually move from now to expiry?',
    body: `Unknown until it happens, and the only volatility that decides whether an option was cheap or dear. The band shows where 20-day realized vol landed half the time over the past year (${c20.p25.toFixed(1)}% to ${c20.p75.toFixed(1)}%).`,
  },
  hist: {
    name: 'Historical',
    q: 'How much did SPY move over a past window?',
    body: `Measured from closes. ${hv20.toFixed(1)}% over the last 20 sessions, ${hv1y.toFixed(1)}% over the full year. Precise, but it describes the past.`,
  },
  forecast: {
    name: 'Forecast',
    q: 'What is my own best guess of future volatility?',
    body: `Here a simple equal-weight blend of 1-year realized, 20-day realized and implied: ${forecast.toFixed(1)}%. Lesson C6 builds better ones.`,
  },
  implied: {
    name: 'Implied',
    q: 'What volatility makes the model match option prices?',
    body: `The 770 strike for Nov 27 implies ${iv.toFixed(2)}%. VIX, a 30-day blend across SPX strikes, reads ${vix.toFixed(2)}, higher because it includes the pricier downside puts (lessons C5, C8).`,
  },
  seasonal: {
    name: 'Seasonal',
    q: 'Does volatility rise and fall on a calendar?',
    body: 'Matters for crops, natural gas and power, and for single stocks around earnings (lesson C7). For SPY over a month it is a small effect, so it is not plotted.',
  },
};

/** The five volatilities on one scale, for the snapshot date. */
export default function FiveVolDashboard() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [sel, setSel] = useState<Key>('future');

  const narrow = width < 520;
  const m = { left: 12, right: 12, top: 12, bottom: 28 };
  const rowH = 30;
  const rows: { k: Key; label: string; v?: number; band?: [number, number]; color: string; extra?: { v: number; label: string } }[] = [
    { k: 'future', label: 'Future (unknown)', band: [c20.p25, c20.p75], color: t.muted },
    { k: 'hist', label: 'Historical', v: hv20, color: t.aqua, extra: { v: hv1y, label: '1y' } },
    { k: 'forecast', label: 'Forecast', v: forecast, color: t.stock },
    { k: 'implied', label: 'Implied', v: iv, color: t.call, extra: { v: vix, label: 'VIX' } },
  ];
  const labelW = narrow ? 0 : 130;
  const iw = Math.max(width - m.left - m.right - labelW, 60);
  const height = m.top + rows.length * (narrow ? rowH + 16 : rowH) + m.bottom;
  const x = scaleLinear().domain([0, 22]).range([0, iw]);

  return (
    <div className="viz-card not-content">
      <CardHead title="Five volatilities for SPY on October 27, 2026" sub="Tap a row (or a card below) to see what each one answers" />
      <div ref={wrap} className="w-full">
        <svg width={width} height={height} role="img" aria-label="Historical, forecast and implied volatility of SPY on one scale, with the range of future volatility" style={{ display: 'block' }}>
          <g transform={`translate(${m.left + labelW},${m.top})`}>
            {x.ticks(narrow ? 5 : 11).map((v) => (
              <g key={v} transform={`translate(${x(v)},0)`}>
                <line y2={height - m.top - m.bottom} stroke={t.grid} />
                <text y={height - m.top - m.bottom + 16} textAnchor="middle" fontSize={11} fill={t.muted}>
                  {v}%
                </text>
              </g>
            ))}
            {rows.map((r, i) => {
              const yy = i * (narrow ? rowH + 16 : rowH) + (narrow ? 16 : 0);
              const active = sel === r.k;
              return (
                <g key={r.k} transform={`translate(0,${yy})`} style={{ cursor: 'pointer' }} onClick={() => setSel(r.k)}>
                  <rect x={-labelW} y={-2} width={iw + labelW} height={rowH} fill={active ? t['band-2'] : 'transparent'} rx={6} />
                  <text x={narrow ? 0 : -labelW + 8} y={narrow ? -4 : rowH / 2} dy="0.32em" fontSize={12} fontWeight={active ? 700 : 500} fill={t.ink}>
                    {r.label}
                  </text>
                  {r.band && (
                    <>
                      <rect x={x(r.band[0])} y={rowH / 2 - 7} width={x(r.band[1]) - x(r.band[0])} height={14} rx={7} fill={t.muted} fillOpacity={0.3} stroke={t.muted} strokeDasharray="3 3" />
                      <text x={(x(r.band[0]) + x(r.band[1])) / 2} y={rowH / 2} dy="0.32em" textAnchor="middle" fontSize={13} fontWeight={700} fill={t['ink-2']}>
                        ?
                      </text>
                    </>
                  )}
                  {r.extra && (
                    <g>
                      <line x1={x(Math.min(r.v!, r.extra.v))} x2={x(Math.max(r.v!, r.extra.v))} y1={rowH / 2} y2={rowH / 2} stroke={r.color} strokeOpacity={0.4} strokeWidth={2} />
                      <circle cx={x(r.extra.v)} cy={rowH / 2} r={5.5} fill={t.surface} stroke={r.color} strokeWidth={2} />
                      <text x={x(r.extra.v) + (r.extra.v > r.v! ? 9 : -9)} y={rowH / 2} dy="0.32em" textAnchor={r.extra.v > r.v! ? 'start' : 'end'} fontSize={11} fill={t['ink-2']}>
                        {r.extra.label} {r.extra.v.toFixed(1)}
                      </text>
                    </g>
                  )}
                  {r.v !== undefined && (
                    <g>
                      <circle cx={x(r.v)} cy={rowH / 2} r={6} fill={r.color} stroke={t.surface} strokeWidth={2} />
                      <text x={x(r.v) + (r.extra && r.extra.v > r.v ? -10 : 10)} y={rowH / 2} dy="0.32em" textAnchor={r.extra && r.extra.v > r.v ? 'end' : 'start'} fontSize={11} fontWeight={600} fill={t.ink}>
                        {r.k === 'hist' ? '20d ' : r.k === 'implied' ? 'ATM ' : ''}
                        {r.v.toFixed(1)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(Object.keys(INFO) as Key[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSel(k)}
            aria-pressed={sel === k}
            className="cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-[0.8rem] font-semibold text-(--sl-color-white)"
            style={{ borderColor: sel === k ? 'var(--sl-color-accent)' : 'var(--sl-color-hairline)', background: sel === k ? 'var(--sl-color-gray-6)' : 'transparent' }}
          >
            {INFO[k].name}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-(--sl-color-hairline) px-3 py-2.5 text-[0.85rem]">
        <div className="font-semibold text-(--sl-color-white)">{INFO[sel].q}</div>
        <div className="mt-1 text-(--sl-color-gray-2)">{INFO[sel].body}</div>
      </div>
    </div>
  );
}
