import { useMemo, useRef, useState } from 'react';
import { scaleLinear, scaleTime, line, area, timeFormat } from 'd3';
import { Slider } from '../ui/Slider';
import { useTokens, useWidth } from '../../lib/useViz';
import { snapshot, closes, dates, atmIv, callAt, putAt, fmt } from '../../lib/snapshot';

const HIST = 60;
const HOLIDAYS = new Set(['2026-11-26']);

/** NYSE trading days after the snapshot through expiry. */
function futureDays(): Date[] {
  const out: Date[] = [];
  const d = new Date(snapshot.asOf + 'T16:00:00');
  const end = new Date(snapshot.chain.expiry + 'T16:00:00');
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6 && !HOLIDAYS.has(iso)) out.push(new Date(d));
  }
  return out;
}

const FUT = futureDays();
/** Every calendar day from the snapshot to expiry, for a smooth cone. */
const CAL: Date[] = (() => {
  const out: Date[] = [];
  const d = new Date(snapshot.asOf + 'T16:00:00');
  const end = new Date(snapshot.chain.expiry + 'T16:00:00');
  while (d < end) {
    d.setDate(d.getDate() + 1);
    out.push(new Date(d));
  }
  return out;
})();
const S0 = snapshot.spot;
const straddle = callAt(770)!.mark + putAt(770)!.mark;

export default function ExpectedMoveCone() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [vol, setVol] = useState(Math.round(atmIv * 1000) / 10);
  const [hover, setHover] = useState<number | null>(null);

  const sigma = vol / 100;
  const hist = useMemo(() => closes.slice(-HIST).map((c, i) => ({ d: dates[dates.length - HIST + i], c })), []);
  // Spread the 22 trading days evenly over the 31 calendar days so the cone is smooth.
  const t0 = dates[dates.length - 1].getTime();
  const cone = CAL.map((d) => {
    const n = (FUT.length * (d.getTime() - t0)) / (CAL[CAL.length - 1].getTime() - t0);
    const s = sigma * Math.sqrt(n / 252);
    return { d, n, u1: S0 * Math.exp(s), l1: S0 * Math.exp(-s), u2: S0 * Math.exp(2 * s), l2: S0 * Math.exp(-2 * s) };
  });
  const coneWithStart = [{ d: dates[dates.length - 1], n: 0, u1: S0, l1: S0, u2: S0, l2: S0 }, ...cone];
  const last = cone[cone.length - 1];

  const m = { top: 18, right: width < 520 ? 52 : 92, bottom: 30, left: 50 };
  const height = 340;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;

  const x = scaleTime().domain([hist[0].d, FUT[FUT.length - 1]]).range([0, iw]);
  const yLo = Math.min(...hist.map((h) => h.c), cone[cone.length - 1].l2);
  const yHi = Math.max(...hist.map((h) => h.c), cone[cone.length - 1].u2);
  const y = scaleLinear().domain([yLo - 5, yHi + 5]).nice().range([ih, 0]);

  const histPath = line<(typeof hist)[0]>().x((d) => x(d.d)).y((d) => y(d.c))(hist) ?? '';
  type C = (typeof coneWithStart)[0];
  const band2 = area<C>().x((d) => x(d.d)).y0((d) => y(d.l2)).y1((d) => y(d.u2))(coneWithStart) ?? '';
  const band1 = area<C>().x((d) => x(d.d)).y0((d) => y(d.l1)).y1((d) => y(d.u1))(coneWithStart) ?? '';
  const fmtD = timeFormat('%b %-d');

  const all = [...hist.map((h) => ({ d: h.d, kind: 'hist' as const, h })), ...cone.map((c) => ({ d: c.d, kind: 'cone' as const, c }))];
  const hv = hover === null ? null : all[hover];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = x.invert(e.clientX - r.left).getTime();
    let best = 0;
    all.forEach((p, i) => {
      if (Math.abs(p.d.getTime() - dx) < Math.abs(all[best].d.getTime() - dx)) best = i;
    });
    setHover(best);
  }

  return (
    <div className="viz-card not-content">
      <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="text-[0.95rem] font-semibold text-(--sl-color-white)">Where could SPY be by {fmtD(FUT[FUT.length - 1])}?</div>
          <div className="text-[0.8rem] text-(--sl-color-gray-3)">
            Last {HIST} sessions, then the range implied by the volatility you choose ({FUT.length} trading days ahead)
          </div>
        </div>
        <Slider
          className="sm:w-64"
          label="Volatility (annualized)"
          value={vol}
          min={5}
          max={45}
          step={0.5}
          onChange={setVol}
          format={(v) => `${v.toFixed(1)}%${Math.abs(v - atmIv * 100) < 0.3 ? ' (market IV)' : ''}`}
        />
      </div>

      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label="SPY price history with a forward cone of one and two standard deviation ranges" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(6).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {v}
                </text>
              </g>
            ))}
            {x.ticks(width < 520 ? 4 : 7).map((d) => (
              <text key={+d} x={x(d)} y={ih + 20} textAnchor="middle" fontSize={11} fill={t.muted}>
                {fmtD(d)}
              </text>
            ))}
            <path d={band2} fill={t['band-2']} />
            <path d={band1} fill={t['band-1']} />
            <line x1={x(dates[dates.length - 1])} x2={x(dates[dates.length - 1])} y2={ih} stroke={t.muted} strokeDasharray="3 3" />
            <text x={x(dates[dates.length - 1]) - 4} y={-6} textAnchor="end" fontSize={10} fill={t.muted}>
              snapshot
            </text>
            <path d={histPath} fill="none" stroke={t.ink} strokeWidth={2} />

            {/* right-edge labels */}
            {[
              ['+2 SD', last.u2],
              ['+1 SD', last.u1],
              ['−1 SD', last.l1],
              ['−2 SD', last.l2],
            ].map(([lbl, v]) => (
              <text key={lbl as string} x={iw + 6} y={y(v as number)} dy="0.32em" fontSize={10.5} fill={t['ink-2']}>
                {width < 520 ? (v as number).toFixed(0) : `${lbl} ${(v as number).toFixed(0)}`}
              </text>
            ))}

            {/* straddle-implied move bracket at expiry */}
            <g transform={`translate(${x(FUT[FUT.length - 1]) - 2},0)`}>
              <line y1={y(S0 + straddle)} y2={y(S0 - straddle)} stroke={t.put} strokeWidth={2.5} />
              <line x1={-5} x2={5} y1={y(S0 + straddle)} y2={y(S0 + straddle)} stroke={t.put} strokeWidth={2.5} />
              <line x1={-5} x2={5} y1={y(S0 - straddle)} y2={y(S0 - straddle)} stroke={t.put} strokeWidth={2.5} />
            </g>

            {hv && (
              <g pointerEvents="none" transform={`translate(${x(hv.d)},0)`}>
                <line y2={ih} stroke={t['ink-2']} />
                {hv.kind === 'hist' && <circle cy={y(hv.h.c)} r={4} fill={t.ink} stroke={t.surface} strokeWidth={2} />}
              </g>
            )}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hv && (
          <div className="viz-tip" style={{ left: Math.min(m.left + x(hv.d) + 12, width - 200), top: m.top + 6 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>{fmtD(hv.d)}</div>
            {hv.kind === 'hist' ? (
              <div>
                Close: <b>{fmt.usd(hv.h.c)}</b>
              </div>
            ) : (
              <>
                <div>
                  68% range: <b>{hv.c.l1.toFixed(0)}–{hv.c.u1.toFixed(0)}</b>
                </div>
                <div>
                  95% range: <b>{hv.c.l2.toFixed(0)}–{hv.c.u2.toFixed(0)}</b>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">1 SD by expiry (≈68%)</div>
          <div className="text-[0.95rem] font-semibold tabular-nums">
            {last.l1.toFixed(0)} – {last.u1.toFixed(0)} <span className="font-normal text-(--sl-color-gray-3)">(±{fmt.usd(S0 * sigma * Math.sqrt(FUT.length / 252), 0)})</span>
          </div>
        </div>
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2">
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">2 SD by expiry (≈95%)</div>
          <div className="text-[0.95rem] font-semibold tabular-nums">
            {last.l2.toFixed(0)} – {last.u2.toFixed(0)}
          </div>
        </div>
        <div className="rounded-lg border border-(--sl-color-hairline) px-3 py-2" style={{ borderColor: t.put }}>
          <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">770 straddle price</div>
          <div className="text-[0.95rem] font-semibold tabular-nums">
            ±{fmt.usd(straddle)} <span className="font-normal text-(--sl-color-gray-3)">orange bracket</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 text-[0.78rem] text-(--sl-color-gray-3)">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: t['band-1'] }} /> ±1 SD
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: t['band-2'] }} /> ±2 SD
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="8"><line x1="0" y1="4" x2="22" y2="4" stroke={t.ink} strokeWidth="2" /></svg> SPY close
        </span>
      </div>
    </div>
  );
}
