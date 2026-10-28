import { useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, callAt, putAt, T_EXPIRY, fmt } from '../../../lib/snapshot';
import { YAxis, XAxis, Tile, fmtSigned } from './kit';

const S0 = snapshot.spot;
const STRIKES = snapshot.chain.calls.map((c) => c.strike).filter((k) => putAt(k));
const rows = STRIKES.map((k) => {
  const c = callAt(k)!;
  const p = putAt(k)!;
  return { k, cp: c.mark - p.mark, spread: c.ask - c.bid + (p.ask - p.bid) };
});

/** Call minus put across the real chain against the parity line S − K·e^{−rT}. */
export default function ParityChain() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [rate, setRate] = useState(4.6);
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<'level' | 'gap'>('level');
  const r = rate / 100;
  const theo = (k: number) => S0 - k * Math.exp(-r * T_EXPIRY);
  const lineData = Array.from({ length: 151 }, (_, i) => 695 + i);
  const r770 = -Math.log((S0 - (callAt(770)!.mark - putAt(770)!.mark)) / 770) / T_EXPIRY;

  const h = 300;
  const m = { top: 14, right: 16, bottom: 40, left: 46 };
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = h - m.top - m.bottom;
  const x = scaleLinear().domain([695, 805]).range([0, iw]);
  const gapView = view === 'gap';
  const val = (k: number, cp: number) => (gapView ? cp - theo(k) : cp);
  const gMax = Math.max(1.2, ...rows.map((d) => Math.abs(d.cp - theo(d.k)))) * 1.1;
  const y = gapView ? scaleLinear().domain([-gMax, gMax]).nice().range([ih, 0]) : scaleLinear().domain([-32, 78]).range([ih, 0]);
  const path = gapView ? `M0,${y(0)}H${iw}` : line<number>().x((k) => x(k)).y((k) => y(theo(k)))(lineData.filter((k) => k <= 805)) ?? '';
  const hv = hover === null ? null : rows[hover];

  return (
    <div className="viz-card not-content">
      <CardHead title="Call minus put, strike by strike" sub="November 27 chain mid prices. The line is what put-call parity says the gap should be at the rate you choose" />
      <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Slider className="sm:max-w-72" label="Financing rate in the parity line" value={rate} min={0} max={8} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} />
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'level', label: 'Call − put' },
            { value: 'gap', label: 'Gap to parity' },
          ]}
        />
      </div>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={h} role="img" aria-label="Call minus put prices across strikes against the parity line" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            <YAxis y={y} width={iw} t={t} ticks={6} format={(v) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}`)} />
            <defs>
              <clipPath id="parity-clip">
                <rect width={iw} height={ih} />
              </clipPath>
            </defs>
            <XAxis x={x} height={ih} width={iw} t={t} ticks={width < 420 ? 4 : 7} label="strike" />
            <line x2={iw} y1={y(0)} y2={y(0)} stroke={t.axis} strokeWidth={1.5} />
            <path d={path} fill="none" stroke={t.call} strokeWidth={2} clipPath="url(#parity-clip)" />
            {rows.map((d, i) => (
              <g key={d.k}>
                <circle
                  cx={x(d.k)}
                  cy={y(val(d.k, d.cp))}
                  r={hover === i ? 7 : 5}
                  fill={t.put}
                  stroke={t.surface}
                  strokeWidth={1.5}
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            ))}
          </g>
        </svg>
        {hv && (
          <div className="viz-tip" style={{ left: Math.max(4, Math.min(m.left + x(hv.k) + 12, width - 220)), top: m.top + 8 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>Strike {hv.k}</div>
            <div>
              Call − put (market): <b>{fmtSigned(hv.cp)}</b>
            </div>
            <div>
              S − PV(K) at {rate.toFixed(1)}%: <b>{fmtSigned(theo(hv.k))}</b>
            </div>
            <div>
              Gap: <b>{fmtSigned(hv.cp - theo(hv.k))}</b> (bid/ask widths {hv.spread.toFixed(2)})
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: gapView ? 'Market (call − put) minus parity' : 'Market: call mid − put mid', color: t.put, kind: 'dot' },
          { label: gapView ? 'Zero: exactly on parity' : 'Parity: S − K·e^(−rT)', color: t.call },
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="770 call − 770 put" value={fmtSigned(callAt(770)!.mark - putAt(770)!.mark)} sub={`${fmt.usd(callAt(770)!.mark)} − ${fmt.usd(putAt(770)!.mark)}`} />
        <Tile label="Rate it implies" value={fmt.pct(r770, 2)} sub="solve S − K·e^(−rT) = C − P" accent={t.call} />
        <Tile label="Parity gap at 770" value={fmtSigned(callAt(770)!.mark - putAt(770)!.mark - theo(770))} sub={`at ${rate.toFixed(1)}%`} />
      </div>
    </div>
  );
}
