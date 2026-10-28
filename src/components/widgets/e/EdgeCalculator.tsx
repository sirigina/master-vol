import { useMemo, useRef, useState } from 'react';
import { scaleBand, scaleLinear } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { fmt } from '../../../lib/snapshot';
import { EDGE_ROWS, STRADDLE_IV, theo } from './edgeData';

type Shape = 'flat' | 'skew';
const NARROW_LABELS = new Set(['650P', '700P', '740P', '770P', '780C', '800C', '840C']);
type Unit = 'vol' | 'usd';

/**
 * E1 edge calculator: theoretical value from the reader's volatility forecast
 * against the mid of every out-of-the-money Nov 27 option.
 */
export default function EdgeCalculator() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [forecast, setForecast] = useState(12.7);
  const [shape, setShape] = useState<Shape>('flat');
  const [unit, setUnit] = useState<Unit>('usd');
  const [hover, setHover] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      EDGE_ROWS.map((r) => {
        // flat: one vol for every strike; skew: keep the market's smile, shift its level
        const sigma = shape === 'flat' ? forecast / 100 : r.iv + (forecast / 100 - STRADDLE_IV);
        const g = theo(r.right, r.strike, Math.max(sigma, 0.01));
        const edge = g.price - r.mid;
        const verdict = g.price > r.ask ? 'cheap' : g.price < r.bid ? 'rich' : 'inside';
        return { ...r, sigma, theo: g.price, vega: g.vega, edge, edgeVol: (sigma - r.iv) * 100, verdict };
      }),
    [forecast, shape],
  );

  const val = (d: (typeof rows)[0]) => (unit === 'usd' ? d.edge * 100 : d.edgeVol);
  const narrow = width < 520;
  const m = { top: 26, right: 8, bottom: narrow ? 40 : 34, left: narrow ? 46 : 54 };
  const height = 300;
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = height - m.top - m.bottom;
  const x = scaleBand<string>().domain(rows.map((d) => d.key)).range([0, iw]).padding(0.22);
  const ext = Math.max(...rows.map((d) => Math.abs(val(d))), unit === 'usd' ? 50 : 2);
  const y = scaleLinear().domain([-ext, ext]).nice().range([ih, 0]);
  const hv = hover === null ? null : rows[hover];

  const cheap = rows.filter((d) => d.verdict === 'cheap').length;
  const rich = rows.filter((d) => d.verdict === 'rich').length;
  const fmtVal = (v: number) => (unit === 'usd' ? `${v < 0 ? '−' : '+'}$${Math.abs(v).toFixed(0)}` : `${fmt.signed(v, 1)} pts`);
  const fillFor = (d: (typeof rows)[0]) => (d.verdict === 'cheap' ? t.profit : d.verdict === 'rich' ? t.loss : t.muted);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Edge across the November 27 chain"
        sub="Theoretical value at your forecast minus the market mid, for each out-of-the-money option"
      />
      <Slider
          label="Your volatility forecast to Nov 27"
          value={forecast}
          min={8}
          max={24}
          step={0.1}
          onChange={setForecast}
          format={(v) => `${v.toFixed(1)}%`}
        />
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Forecast shape</div>
          <Segmented
            label="Forecast shape"
            value={shape}
            onChange={setShape}
            options={[
              { value: 'flat', label: 'One vol, all strikes' },
              { value: 'skew', label: 'Keep market skew' },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Measure edge in</div>
          <Segmented
            label="Edge units"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'usd', label: '$ / contract' },
              { value: 'vol', label: 'Vol points' },
            ]}
          />
        </div>
      </div>

      <div ref={wrap} className="relative mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label="Bar chart of theoretical edge per strike" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(6).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={v === 0 ? t.axis : t.grid} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {unit === 'usd' ? `${v < 0 ? '−' : ''}$${Math.abs(v)}` : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`}
                </text>
              </g>
            ))}
            <text x={-m.left + 2} y={-14} fontSize={10.5} fill={t.muted}>
              {unit === 'usd' ? 'edge $ per contract' : 'edge, vol points'}
            </text>
            {rows.map((d, i) => {
              const v = val(d);
              const x0 = x(d.key)!;
              return (
                <g key={d.key}>
                  {hover === i && <rect x={x0 - x.step() * 0.11} width={x.step()} y={0} height={ih} fill={t.grid} opacity={0.6} />}
                  <rect x={x0} width={x.bandwidth()} y={Math.min(y(v), y(0))} height={Math.max(Math.abs(y(v) - y(0)), 1)} rx={2} fill={fillFor(d)} />
                  {(!narrow || NARROW_LABELS.has(d.key)) && (
                    <text x={x0 + x.bandwidth() / 2} y={ih + 14} textAnchor="middle" fontSize={narrow ? 9.5 : 10.5} fill={t['ink-2']}>
                      {d.strike}
                    </text>
                  )}
                </g>
              );
            })}
            {/* put / call brackets */}
            {(['put', 'call'] as const).map((side) => {
              const ks = rows.filter((d) => d.right === side);
              const a = x(ks[0].key)!;
              const b = x(ks[ks.length - 1].key)! + x.bandwidth();
              return (
                <g key={side} transform={`translate(0,${ih + (narrow ? 24 : 22)})`}>
                  <line x1={a} x2={b} stroke={side === 'put' ? t.put : t.call} strokeWidth={2} />
                  <text x={(a + b) / 2} y={12} textAnchor="middle" fontSize={10.5} fill={side === 'put' ? t.put : t.call}>
                    {side === 'put' ? 'puts' : 'calls'}
                  </text>
                </g>
              );
            })}
            <rect
              width={iw}
              height={ih}
              fill="transparent"
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const i = Math.floor((e.clientX - r.left) / x.step());
                setHover(Math.max(0, Math.min(rows.length - 1, i)));
              }}
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHover(Math.max(0, Math.min(rows.length - 1, Math.floor((e.clientX - r.left) / x.step()))));
              }}
              onPointerLeave={() => setHover(null)}
            />
          </g>
        </svg>
        {hv && (
          <div className="viz-tip" style={{ left: Math.max(4, Math.min(m.left + x(hv.key)! - 60, width - 210)), top: 6 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              {hv.strike} {hv.right}, bid {hv.bid.toFixed(2)} / ask {hv.ask.toFixed(2)}
            </div>
            <div>
              Market mid <b>{fmt.usd(hv.mid)}</b> at IV <b>{fmt.pct(hv.iv)}</b>
            </div>
            <div>
              Theoretical <b>{fmt.usd(hv.theo)}</b> at {fmt.pct(hv.sigma)}
            </div>
            <div>
              Edge <b>{fmtVal(hv.edge * 100)}</b> per contract, <b>{fmt.signed(hv.edgeVol, 1)}</b> vol pts
            </div>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>
              {hv.verdict === 'cheap' ? 'Theoretically cheap: value above the ask' : hv.verdict === 'rich' ? 'Theoretically rich: value below the bid' : 'Edge smaller than the half-spread'}
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'Theoretically cheap (value above the ask)', color: t.profit, kind: 'box' },
          { label: 'Theoretically rich (value below the bid)', color: t.loss, kind: 'box' },
          { label: 'Inside the spread', color: t.muted, kind: 'box' },
        ]}
      />

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[0.78rem] tabular-nums" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              {(narrow ? ['Option', 'Mkt IV', 'Edge $', 'Edge vol', 'Reads as'] : ['Option', 'Bid / ask', 'Market IV', 'Your vol', 'Theo', 'Edge $', 'Edge vol', 'Reads as']).map((h) => (
                <th key={h} className="whitespace-nowrap border-b border-(--sl-color-hairline) px-2 py-1 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.key} style={hover === i ? { background: 'var(--sl-color-gray-6)' } : undefined}>
                <td className="whitespace-nowrap px-2 py-0.5">
                  {d.strike} {d.right}
                </td>
                {!narrow && (
                  <td className="whitespace-nowrap px-2 py-0.5">
                    {d.bid.toFixed(2)} / {d.ask.toFixed(2)}
                  </td>
                )}
                <td className="px-2 py-0.5">{fmt.pct(d.iv)}</td>
                {!narrow && <td className="px-2 py-0.5">{fmt.pct(d.sigma)}</td>}
                {!narrow && <td className="px-2 py-0.5">{d.theo.toFixed(2)}</td>}
                <td className="px-2 py-0.5" style={{ color: fillFor(d) }}>
                  {fmt.signed(d.edge * 100, 0)}
                </td>
                <td className="px-2 py-0.5">{fmt.signed(d.edgeVol, 1)}</td>
                <td className="whitespace-nowrap px-2 py-0.5" style={{ color: fillFor(d) }}>
                  {d.verdict === 'cheap' ? 'cheap' : d.verdict === 'rich' ? 'rich' : narrow ? 'inside' : 'inside spread'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        At {forecast.toFixed(1)}%: {cheap} theoretically cheap, {rich} theoretically rich, {rows.length - cheap - rich} inside the spread. Edge is per
        contract (100 shares) against the mid. A statement about the model, not a recommendation.
      </p>
    </div>
  );
}
