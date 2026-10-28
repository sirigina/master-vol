import { useMemo, useRef, useState } from 'react';
import { scaleLinear, area, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, callAt, T_EXPIRY, fmt } from '../../../lib/snapshot';
import { Tile, lnPdf, ivSafe, fmtSigned } from './kit';

const K = 770;
const S0 = snapshot.spot;
const r = snapshot.rate;
const MARKET = callAt(K)!.mark;
const LO = 560;
const HI = 1200;
const DX = 0.25;

/** Fair value of the 770 call as a probability-weighted payoff, integrated live. */
export default function ExpectedValueCall() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [vol, setVol] = useState(14);
  const [drift, setDrift] = useState<'rn' | 'zero'>('rn');
  const [hover, setHover] = useState<number | null>(null);

  const sigma = vol / 100;
  const mu = drift === 'rn' ? r : 0;
  const { pts, ev, pItm, fair } = useMemo(() => {
    const pts: { s: number; f: number; pay: number }[] = [];
    let ev = 0;
    let pItm = 0;
    for (let s = LO; s <= HI; s += DX) {
      const f = lnPdf(s, S0, sigma, T_EXPIRY, mu);
      const pay = Math.max(s - K, 0);
      pts.push({ s, f, pay });
      ev += pay * f * DX;
      if (s > K) pItm += f * DX;
    }
    return { pts, ev, pItm, fair: ev * Math.exp(-r * T_EXPIRY) };
  }, [sigma, mu]);

  // the vol at which the discounted risk-neutral expectation equals the market price
  const matchVol = useMemo(() => ivSafe('call', MARKET, { S: S0, K, T: T_EXPIRY, r }), []);

  const h = 320;
  const m = { top: 24, right: 48, bottom: 40, left: 16 };
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = h - m.top - m.bottom;
  const x = scaleLinear().domain([680, 860]).range([0, iw]);
  const peak = Math.max(...pts.map((p) => p.f));
  const fMax = Math.max(lnPdf(S0, S0, 0.06, T_EXPIRY, 0) * 0.62, peak * 1.05);
  const yf = scaleLinear().domain([0, fMax]).range([ih, 0]);
  const yp = scaleLinear().domain([0, 90]).range([ih, 0]);
  const vis = pts.filter((p) => p.s >= 680 && p.s <= 860);
  // payoff x probability, scaled so the area reads against the density
  const maxContrib = Math.max(...vis.map((p) => p.pay * p.f));
  const contribScale = maxContrib > 0 ? (fMax * 0.55) / maxContrib : 0;

  const densArea = area<(typeof vis)[0]>().x((d) => x(d.s)).y0(ih).y1((d) => yf(Math.min(d.f, fMax)))(vis) ?? '';
  const itmArea = area<(typeof vis)[0]>().x((d) => x(d.s)).y0(ih).y1((d) => yf(Math.min(d.pay * d.f * contribScale, fMax)))(vis.filter((p) => p.s >= K)) ?? '';
  const payLine = line<(typeof vis)[0]>().x((d) => x(d.s)).y((d) => yp(Math.min(d.pay, 90)))(vis) ?? '';
  const hv = hover === null ? null : vis[hover];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rc = e.currentTarget.getBoundingClientRect();
    const s = x.invert(e.clientX - rc.left);
    setHover(Math.max(0, Math.min(vis.length - 1, Math.round((s - 680) / DX))));
  }

  const diff = fair - MARKET;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="The 770 call as an expected value"
        sub={`Where SPY could finish on November 27 (lognormal, ${snapshot.chain.dte} days), the call's payoff, and the average payoff weighted by probability`}
      />
      <div className="mb-3 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Slider label="Volatility used for the distribution" value={vol} min={6} max={30} step={0.1} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
        <Segmented
          label="Drift"
          value={drift}
          onChange={setDrift}
          options={[
            { value: 'rn', label: 'Grows at 4.6% rate' },
            { value: 'zero', label: 'Zero drift' },
          ]}
        />
      </div>

      <div ref={wrap} className="relative w-full">
        <svg width={width} height={h} role="img" aria-label="Lognormal distribution of SPY at expiry with the 770 call payoff overlaid" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {yp.ticks(4).map((v) => (
              <g key={v} transform={`translate(0,${yp(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={iw + 6} dy="0.32em" fontSize={11} fill={t.muted}>
                  ${v}
                </text>
              </g>
            ))}
            <text x={iw + 6} y={-10} fontSize={10.5} fill={t['ink-2']} textAnchor="end">
              payoff
            </text>
            {x.ticks(width < 420 ? 4 : 8).map((v) => (
              <text key={v} x={x(v)} y={ih + 17} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <text x={iw} y={ih + 34} textAnchor="end" fontSize={11} fill={t['ink-2']}>
              SPY on Nov 27
            </text>
            <path d={densArea} fill={t['band-2']} stroke={t.call} strokeOpacity={0.5} />
            <path d={itmArea} fill={t.aqua} fillOpacity={0.45} />
            <path d={payLine} fill="none" stroke={t.put} strokeWidth={2.2} />
            <line x1={x(S0)} x2={x(S0)} y2={ih} stroke={t.ink} strokeDasharray="3 3" />
            <text x={x(S0) - 4} y={-8} textAnchor="end" fontSize={10.5} fill={t['ink-2']}>
              SPY {S0}
            </text>
            <line x1={x(K)} x2={x(K)} y2={ih} stroke={t.muted} strokeDasharray="2 4" />
            <text x={x(K) + 4} y={-8} fontSize={10.5} fill={t.muted}>
              strike 770
            </text>
            {hv && (
              <g pointerEvents="none">
                <line x1={x(hv.s)} x2={x(hv.s)} y2={ih} stroke={t['ink-2']} />
                <circle cx={x(hv.s)} cy={yp(Math.min(hv.pay, 90))} r={4} fill={t.put} stroke={t.surface} strokeWidth={2} />
              </g>
            )}
            <rect width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {hv && (
          <div className="viz-tip" style={{ left: Math.max(4, Math.min(m.left + x(hv.s) + 12, width - 200)), top: m.top + 8 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>SPY finishes at {hv.s.toFixed(0)}</div>
            <div>
              Chance, ±$0.50 of here: <b>{(hv.f * 100).toFixed(2)}%</b>
            </div>
            <div>
              Call pays: <b>{fmt.usd(hv.pay)}</b>
            </div>
            <div>
              Payoff × chance: <b>{(hv.pay * hv.f).toFixed(3)}</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'Probability of each finishing price', color: t['band-1'], kind: 'box' },
          { label: 'Call payoff (right axis)', color: t.put },
          { label: 'Payoff × probability, rescaled to fit (what the average adds up)', color: t.aqua, kind: 'box' },
        ]}
      />

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Average payoff" value={fmt.usd(ev)} sub={`chance it pays: ${fmt.pct(pItm)}`} />
        <Tile label="Fair value today" value={fmt.usd(fair)} sub="average payoff, discounted" accent={t.aqua} />
        <Tile label="Market price" value={fmt.usd(MARKET)} sub={`model − market ${fmtSigned(diff)}`} accent={t.put} />
        <Tile label="Vol that matches" value={fmt.pct(matchVol, 2)} sub="with 4.6% drift (lesson B6)" />
      </div>
    </div>
  );
}
