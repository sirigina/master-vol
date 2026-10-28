import { useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { money0 } from './common';

const K = 770;
const N = 10;
const SH = N * 100;
const LO = 760;
const HI = 780;

/**
 * Pin risk: short 10 calls at 770 with SPY closing right at the strike. The
 * short can't know whether they'll be assigned, and the two outcomes leave
 * very different positions on Monday. Illustration, not market data.
 */
export default function PinRisk() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [close, setClose] = useState(770.03);
  const [ah, setAh] = useState(-0.6);
  const [hover, setHover] = useState<number | null>(null);

  const after = close + ah;
  const defaultEx = close - K >= 0.01 - 1e-9;
  const rational = after > K;
  const clear = Math.abs(close - K) > 1.5 && defaultEx === rational;
  const verdict = clear
    ? defaultEx
      ? 'Assignment is close to certain.'
      : 'Assignment is very unlikely.'
    : defaultEx === rational
      ? `Default and after-hours price agree (${defaultEx ? 'exercise' : 'expire'}), but SPY is close enough to the strike that some holders may still choose differently.`
      : `Default says ${defaultEx ? 'exercise' : 'expire'}, but the after-hours price says ${rational ? 'exercise' : 'don’t'}. Holders who act by 5:30 p.m. will override, others won't. You may be assigned on some, all, or none.`;

  const m = { top: 14, right: 14, bottom: 38, left: width < 520 ? 62 : 74 };
  const height = 280;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;
  const x = scaleLinear().domain([LO, HI]).range([0, iw]);
  const pl = (s: number) => (K - s) * SH; // short 1,000 shares at 770
  const y = scaleLinear().domain([pl(HI), pl(LO)]).nice().range([ih, 0]);
  const fmtY = (v: number) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}$${(Math.abs(v) / 1000).toFixed(0)}k`);

  const hv = hover;
  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(HI, Math.max(LO, x.invert(e.clientX - r.left))));
  }

  return (
    <div className="viz-card not-content">
      <CardHead title="Pin risk: short 10 SPY 770 calls into the close" sub="Illustration. Set Friday's close and an after-hours move; the chart shows Monday's P/L for each assignment outcome." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="SPY close on expiration day" value={close} min={768} max={772} step={0.01} onChange={setClose} format={(v) => v.toFixed(2)} />
        <Slider label="After-hours move by 5:30 p.m." value={ah} min={-3} max={3} step={0.05} onChange={setAh} format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} → ${(close + v).toFixed(2)}`} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-[0.82rem] sm:grid-cols-3">
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">OCC default at the close</div>
          <div className="font-semibold text-(--sl-color-white)">{defaultEx ? 'Exercise' : 'Expire'}</div>
          <div className="text-(--sl-color-gray-3)">
            {defaultEx ? 'in the money by' : 'short of the strike by'} ${Math.abs(close - K).toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">Holder looking at {after.toFixed(2)}</div>
          <div className="font-semibold text-(--sl-color-white)">{rational ? 'Wants to exercise' : 'Wants to let it go'}</div>
          <div className="text-(--sl-color-gray-3)">buying at 770 {rational ? 'beats' : 'is worse than'} the market</div>
        </div>
        <div className="rounded-lg border-2 px-3 py-2" style={{ borderColor: clear ? 'var(--sl-color-hairline-shade)' : 'var(--viz-loss)' }}>
          <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">For you, the short</div>
          <div className="text-(--sl-color-gray-2)">{verdict}</div>
        </div>
      </div>

      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label="Monday profit or loss if assigned versus not assigned" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(6).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={v === 0 ? t.axis : t.grid} strokeWidth={v === 0 ? 1.25 : 1} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {fmtY(v)}
                </text>
              </g>
            ))}
            {x.ticks(width < 520 ? 4 : 8).map((v) => (
              <text key={v} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              SPY at Monday's open
            </text>
            <line x1={x(K)} x2={x(K)} y2={ih} stroke={t.muted} strokeDasharray="3 3" />
            <text x={x(K) + 4} y={10} fontSize={10} fill={t.muted}>
              strike 770
            </text>
            {/* expected open = after-hours level */}
            <line x1={x(after)} x2={x(after)} y2={ih} stroke={t.stock} strokeWidth={1.5} />
            <text x={x(after) + (after > 776 ? -4 : 4)} y={ih - 6} textAnchor={after > 776 ? 'end' : 'start'} fontSize={10} fill={t.stock}>
              after-hours {after.toFixed(2)}
            </text>
            <line x1={0} x2={iw} y1={y(0)} y2={y(0)} stroke={t.aqua} strokeWidth={2.5} />
            <line x1={0} x2={iw} y1={y(pl(LO))} y2={y(pl(HI))} stroke={t.put} strokeWidth={2.5} />
            {hv !== null && (
              <g pointerEvents="none" transform={`translate(${x(hv)},0)`}>
                <line y2={ih} stroke={t['ink-2']} />
                <circle cy={y(pl(hv))} r={4} fill={t.put} stroke={t.surface} strokeWidth={2} />
                <circle cy={y(0)} r={4} fill={t.aqua} stroke={t.surface} strokeWidth={2} />
              </g>
            )}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hv !== null && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(hv) + 12, width - 210), top: m.top + 4 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>Monday open {hv.toFixed(2)}</div>
            <div>
              Assigned (short 1,000): <b>{money0(pl(hv))}</b>
            </div>
            <div>
              Not assigned: <b>$0</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'If assigned: short 1,000 SPY at 770', color: t.put },
          { label: 'If not assigned: flat', color: t.aqua },
          { label: 'After-hours price', color: t.stock },
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        P/L shown is on the shares only; the premium you collected is the same in both cases. A $5 gap on 1,000 unexpected shares is {money0(5 * SH, false)}.
      </p>
    </div>
  );
}
