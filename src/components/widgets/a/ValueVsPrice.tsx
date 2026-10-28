import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line, area } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { bs, intrinsic } from '../../../lib/pricing';
import { snapshot, atmIv } from '../../../lib/snapshot';
import { S0 } from './common';

const K = 770;
const LO = 700;
const HI = 840;
const NPTS = 281;

/**
 * Model value of the 770 option against SPY, with the intrinsic floor and the
 * time value between them. Days-to-expiry slider shows the decay.
 */
export default function ValueVsPrice() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [right, setRight] = useState<'call' | 'put'>('call');
  const [dte, setDte] = useState(31);
  const [hover, setHover] = useState<number | null>(null);
  const sigma = atmIv;
  const r = snapshot.rate;

  const data = useMemo(
    () =>
      Array.from({ length: NPTS }, (_, i) => {
        const s = LO + ((HI - LO) * i) / (NPTS - 1);
        const v = dte === 0 ? intrinsic(right, s, K) : bs(right, { S: s, K, T: dte / 365, r, sigma }).price;
        return { s, v, iv: intrinsic(right, s, K) };
      }),
    [right, dte],
  );
  const v90 = useMemo(() => Array.from({ length: NPTS }, (_, i) => {
    const s = LO + ((HI - LO) * i) / (NPTS - 1);
    return { s, v: bs(right, { S: s, K, T: 90 / 365, r, sigma }).price };
  }), [right]);

  const m = { top: 14, right: 14, bottom: 38, left: 46 };
  const height = 300;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;
  const x = scaleLinear().domain([LO, HI]).range([0, iw]);
  const yTop = Math.max(...data.map((d) => d.v), ...v90.map((d) => d.v)) * 1.04;
  const y = scaleLinear().domain([0, yTop]).nice().range([ih, 0]);

  type D = (typeof data)[0];
  const intrPath = line<D>().x((d) => x(d.s)).y((d) => y(d.iv))(data) ?? '';
  const valPath = line<D>().x((d) => x(d.s)).y((d) => y(d.v))(data) ?? '';
  const ref90 = line<{ s: number; v: number }>().x((d) => x(d.s)).y((d) => y(d.v))(v90) ?? '';
  const tvArea = area<D>().x((d) => x(d.s)).y0((d) => y(d.iv)).y1((d) => y(Math.max(d.v, d.iv)))(data) ?? '';

  const at = (s: number) => {
    const v = dte === 0 ? intrinsic(right, s, K) : bs(right, { S: s, K, T: dte / 365, r, sigma }).price;
    return { v, iv: intrinsic(right, s, K) };
  };
  const now = at(S0);
  const atmTheta = dte === 0 ? 0 : bs(right, { S: K, K, T: dte / 365, r, sigma }).theta;
  const atm = at(K);
  const hv = hover === null ? null : { s: hover, ...at(hover) };
  const col = right === 'call' ? t.call : t.put;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rr = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(HI, Math.max(LO, x.invert(e.clientX - rr.left))));
  }

  return (
    <div className="viz-card not-content">
      <CardHead title={`Model value of the 770 ${right} vs SPY`} sub={`Black-Scholes at ${(sigma * 100).toFixed(1)}% volatility and ${(r * 100).toFixed(1)}% rate. Drag days to expiry.`} />
      <div className="mb-3 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <Segmented
          label="Option type"
          value={right}
          onChange={setRight}
          options={[
            { value: 'call', label: '770 call' },
            { value: 'put', label: '770 put' },
          ]}
        />
        <Slider label="Days to expiry" value={dte} min={0} max={90} step={1} onChange={setDte} format={(v) => (v === 0 ? 'expiration' : `${v} days`)} />
      </div>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label="Option value against the underlying price, with intrinsic value floor" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(6).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={v === 0 ? t.axis : t.grid} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {v}
                </text>
              </g>
            ))}
            {x.ticks(width < 520 ? 4 : 8).map((v) => (
              <text key={v} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <text x={iw / 2} y={ih + 34} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              SPY price
            </text>
            <line x1={x(K)} x2={x(K)} y2={ih} stroke={t.muted} strokeDasharray="3 3" />
            <text x={x(K) + 4} y={10} fontSize={10} fill={t.muted}>
              strike 770
            </text>
            <path d={tvArea} fill={t['band-1']} />
            {dte !== 90 && <path d={ref90} fill="none" stroke={t.muted} strokeWidth={1.25} strokeDasharray="2 3" />}
            <path d={intrPath} fill="none" stroke={t.aqua} strokeWidth={2} />
            <path d={valPath} fill="none" stroke={col} strokeWidth={2.5} />
            <circle cx={x(S0)} cy={y(now.v)} r={4.5} fill={t.ink} stroke={t.surface} strokeWidth={2} />
            {hv && (
              <g pointerEvents="none" transform={`translate(${x(hv.s)},0)`}>
                <line y2={ih} stroke={t['ink-2']} />
                <circle cy={y(hv.v)} r={4} fill={col} stroke={t.surface} strokeWidth={2} />
                <circle cy={y(hv.iv)} r={4} fill={t.aqua} stroke={t.surface} strokeWidth={2} />
              </g>
            )}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hv && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(hv.s) + 12, width - 170), top: m.top + 4 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>SPY {hv.s.toFixed(2)}</div>
            <div>
              Value: <b>{hv.v.toFixed(2)}</b>
            </div>
            <div>
              Intrinsic: <b>{hv.iv.toFixed(2)}</b>
            </div>
            <div>
              Time value: <b>{(hv.v - hv.iv).toFixed(2)}</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'Option value', color: col },
          { label: 'Intrinsic value (floor at expiry)', color: t.aqua },
          { label: 'Time value', color: t['band-1'], kind: 'box' },
          { label: '90 days, for reference', color: t.muted, kind: 'dash' },
        ]}
      />
      <StatGrid
        cols={3}
        items={[
          [`At SPY ${S0}`, now.v.toFixed(2), `intrinsic ${now.iv.toFixed(2)}, time ${(now.v - now.iv).toFixed(2)}`],
          ['At the strike (SPY 770)', atm.v.toFixed(2), 'all of it time value'],
          ['Decay per day at the strike', dte === 0 ? 'Expired' : atmTheta.toFixed(2), dte === 0 ? 'only intrinsic remains' : `with ${dte} days left (theta)`],
        ]}
      />
    </div>
  );
}
