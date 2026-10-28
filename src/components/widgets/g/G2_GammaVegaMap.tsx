import { useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { SPREADS } from './G2_spreads';
import { greeksAt, contractGreeks, S0, DTE } from './G1_kit';

/** G2: every spread placed by gamma (x) and vega (y). Slide time forward to watch them move. */
export default function G2GammaVegaMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [days, setDays] = useState(0);
  const [hover, setHover] = useState<string | null>(null);

  const pts = useMemo(
    () =>
      SPREADS.map((s) => {
        const g = contractGreeks(greeksAt(s.legs, S0, days));
        return { ...s, gamma: g.gamma, vega: g.vega, theta: g.theta };
      }),
    [days],
  );
  // Fixed axes so motion is visible as days pass.
  const narrow = width < 520;
  const height = narrow ? 400 : 420;
  const m = { top: 16, right: 16, bottom: 42, left: narrow ? 46 : 60 };
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = height - m.top - m.bottom;
  const x = scaleLinear().domain([-9, 9]).range([0, iw]);
  const y = scaleLinear().domain([-250, 250]).range([ih, 0]);
  const colorOf = (f: string) => (f === 'long' ? t.aqua : f === 'short' ? t.put : t.stock);
  const clampX = (v: number) => Math.max(-9, Math.min(9, v));
  const clampY = (v: number) => Math.max(-250, Math.min(250, v));

  // Label placement: alternate sides to reduce collisions between mirror pairs.
  const labelOff: Record<string, [number, number, 'start' | 'end' | 'middle']> = {
    lstrad: [8, -6, 'start'],
    lstrang: [-8, -6, 'end'],
    cback: [8, 12, 'start'],
    pback: [-8, -8, 'end'],
    sfly: [8, 4, 'start'],
    sstrad: [-8, 12, 'end'],
    sstrang: [8, 10, 'start'],
    cratio: [-8, 8, 'end'],
    pratio: [8, 10, 'start'],
    lfly: [-8, -4, 'end'],
    cal: [-8, -8, 'end'],
  };
  const hp = hover ? pts.find((p) => p.key === hover) : null;

  return (
    <div className="viz-card not-content">
      <CardHead title="Where each spread sits on the gamma-vega map" sub="Per spread, 100 shares per contract. Slide time forward and watch the points move." />
      <Slider
        className="mb-3 sm:w-80"
        label="Days from the snapshot"
        value={days}
        min={0}
        max={DTE - 3}
        step={1}
        onChange={setDays}
        format={(v) => `${v} (${DTE - v} days left on Nov 27)`}
      />
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label="Scatter of spreads by gamma and vega" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            <rect x={x(0)} y={0} width={iw - x(0)} height={y(0)} fill={t.aqua} opacity={0.07} />
            <rect x={0} y={y(0)} width={x(0)} height={ih - y(0)} fill={t.put} opacity={0.07} />
            <rect x={0} y={0} width={x(0)} height={y(0)} fill={t.stock} opacity={0.05} />
            {[-9, -6, -3, 0, 3, 6, 9].map((v) => (
              <g key={`x${v}`}>
                <line x1={x(v)} x2={x(v)} y2={ih} stroke={v === 0 ? t.axis : t.grid} strokeWidth={v === 0 ? 1.25 : 1} />
                <text x={x(v)} y={ih + 16} textAnchor="middle" fontSize={10.5} fill={t.muted}>
                  {v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}
                </text>
              </g>
            ))}
            {[-200, -100, 0, 100, 200].map((v) => (
              <g key={`y${v}`}>
                <line x2={iw} y1={y(v)} y2={y(v)} stroke={v === 0 ? t.axis : t.grid} strokeWidth={v === 0 ? 1.25 : 1} />
                <text x={-6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10.5} fill={t.muted}>
                  {v > 0 ? `+$${v}` : v < 0 ? `−$${-v}` : '$0'}
                </text>
              </g>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              Gamma (shares of delta per $1 move)
            </text>
            {!narrow && (
              <text transform={`translate(${-48},${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
                Vega ($ per vol point)
              </text>
            )}
            <text x={iw - 6} y={14} textAnchor="end" fontSize={11} fontWeight={600} fill={t.aqua}>
              Long volatility
            </text>
            <text x={6} y={ih - 8} fontSize={11} fontWeight={600} fill={t.put}>
              Short volatility
            </text>
            <text x={6} y={14} fontSize={11} fontWeight={600} fill={t.stock}>
              Long vega, short gamma
            </text>
            <text x={iw - 6} y={ih - 8} textAnchor="end" fontSize={11} fontWeight={600} fill={t.muted}>
              Short vega, long gamma
            </text>
            {(() => {
              // Greedy label placement: skip a label that would collide with one already placed (hover identifies it).
              const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
              const fs = narrow ? 9.5 : 10.5;
              return pts.map((p) => {
                const [dx, dy, anchor] = labelOff[p.key];
                const cx = x(clampX(p.gamma));
                const cy = y(clampY(p.vega));
                const txt = narrow ? p.short : p.label;
                const w = txt.length * fs * 0.55;
                const lx = cx + dx;
                const x0 = anchor === 'end' ? lx - w : anchor === 'middle' ? lx - w / 2 : lx;
                const box = { x0, x1: x0 + w, y0: cy + dy - fs / 2 - 1, y1: cy + dy + fs / 2 + 1 };
                const clash = placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1);
                const showLabel = !clash || hover === p.key;
                if (showLabel) placed.push(box);
                const dim = hover !== null && hover !== p.key;
                return (
                  <g key={p.key} opacity={dim ? 0.35 : 1} onPointerEnter={() => setHover(p.key)} onPointerLeave={() => setHover(null)}>
                    <circle cx={cx} cy={cy} r={12} fill="transparent" />
                    <circle cx={cx} cy={cy} r={5.5} fill={colorOf(p.family)} stroke={t.surface} strokeWidth={1.5} />
                    {showLabel && (
                      <text x={lx} y={cy + dy} textAnchor={anchor} dy="0.32em" fontSize={fs} fill={t['ink-2']} stroke={t.surface} strokeWidth={3} paintOrder="stroke">
                        {txt}
                      </text>
                    )}
                  </g>
                );
              });
            })()}
          </g>
        </svg>
        {hp && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(clampX(hp.gamma)) + 14, width - 210), top: Math.max(m.top + y(clampY(hp.vega)) - 70, 0) }}>
            <div>
              <b>{hp.label}</b>
            </div>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>{hp.desc}</div>
            <div>Gamma: {hp.gamma.toFixed(2)} sh per $1</div>
            <div>Vega: ${hp.vega.toFixed(0)} per vol pt</div>
            <div>Theta: ${hp.theta.toFixed(0)} per day</div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'Long volatility family', color: t.aqua, kind: 'dot' },
          { label: 'Short volatility family', color: t.put, kind: 'dot' },
          { label: 'Calendar', color: t.stock, kind: 'dot' },
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        SPY held at {S0} and every IV unchanged; only time moves. Points beyond the axes are pinned to the edge; hover a point to identify it when labels crowd.
      </p>
    </div>
  );
}
