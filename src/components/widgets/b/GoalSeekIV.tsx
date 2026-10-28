import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot, T_EXPIRY, fmt } from '../../../lib/snapshot';
import { bs, impliedVol, type Right } from '../../../lib/pricing';
import { Tile, Btn, YAxis, XAxis, fmtSigned } from './kit';

const S0 = snapshot.spot;
const ivTxt = (v: number) => (Number.isFinite(v) ? fmt.pct(v, 2) : 'n/a');
const r = snapshot.rate;

/** Model price as a function of volatility; the market price as a horizontal line; IV where they cross. */
export default function GoalSeekIV() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [right, setRight] = useState<Right>('call');
  const chain = right === 'call' ? snapshot.chain.calls : snapshot.chain.puts;
  const [ki, setKi] = useState(() => chain.findIndex((c) => c.strike === 770));
  const row = chain[Math.min(ki, chain.length - 1)];
  const K = row.strike;
  const [vol, setVol] = useState(25);
  const [steps, setSteps] = useState<{ v: number; p: number }[]>([]);

  const inp = { S: S0, K, T: T_EXPIRY, r };
  const iv = impliedVol(right, row.mark, inp);
  const curve = useMemo(() => Array.from({ length: 116 }, (_, i) => {
    const v = 0.03 + i * 0.004;
    return { v, p: bs(right, { ...inp, sigma: v }).price };
  }), [right, K]);
  const model = bs(right, { ...inp, sigma: vol / 100 }).price;
  const vega = bs(right, { ...inp, sigma: vol / 100 }).vega;

  function newtonStep() {
    const g = bs(right, { ...inp, sigma: vol / 100 });
    const next = Math.max(3, Math.min(48, vol - ((g.price - row.mark) / g.vega)));
    setSteps((s) => [...s, { v: vol, p: g.price }].slice(-6));
    setVol(Math.round(next * 100) / 100);
  }
  function changeStrike(i: number) {
    setKi(i);
    setSteps([]);
  }

  const h = 300;
  const m = { top: 16, right: 16, bottom: 40, left: 48 };
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = h - m.top - m.bottom;
  const x = scaleLinear().domain([3, 49]).range([0, iw]);
  const pMax = Math.max(...curve.map((c) => c.p));
  const pMin = Math.min(...curve.map((c) => c.p));
  const y = scaleLinear().domain([Math.max(0, pMin - 1), pMax + 1]).nice().range([ih, 0]);
  const path = line<{ v: number; p: number }>().x((d) => x(d.v * 100)).y((d) => y(d.p))(curve) ?? '';
  const diff = model - row.mark;
  const color = right === 'call' ? t.call : t.put;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Solve for the volatility"
        sub="Model price at every volatility, the market price as a fixed line. Implied volatility is where they cross"
        right={
          <Segmented
            label="Option type"
            value={right}
            onChange={(v) => {
              setRight(v);
              const c2 = v === 'call' ? snapshot.chain.calls : snapshot.chain.puts;
              setKi(Math.max(0, c2.findIndex((c) => c.strike === 770)));
              setSteps([]);
            }}
            options={[
              { value: 'call', label: 'Calls' },
              { value: 'put', label: 'Puts' },
            ]}
          />
        }
      />
      <div className="mb-3 grid gap-4 sm:grid-cols-2">
        <Slider label="Strike" value={ki} min={0} max={chain.length - 1} step={1} onChange={changeStrike} format={(i) => `${chain[i].strike} · mid ${fmt.usd(chain[i].mark)}`} />
        <Slider label="Your volatility guess" value={vol} min={3} max={48} step={0.05} onChange={(v) => { setVol(v); setSteps([]); }} format={(v) => `${v.toFixed(2)}%`} />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Btn onClick={newtonStep}>Take a Newton step</Btn>
        <span className="text-[0.78rem] text-(--sl-color-gray-3)">Each step moves the guess by the miss divided by vega</span>
      </div>
      <div ref={wrap} className="w-full">
        <svg width={width} height={h} role="img" aria-label="Model price versus volatility with the market price line" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            <YAxis y={y} width={iw} t={t} ticks={6} format={(v) => `$${v}`} />
            <XAxis x={x} height={ih} width={iw} t={t} ticks={width < 420 ? 5 : 9} format={(v) => `${v}%`} label="volatility" />
            <path d={path} fill="none" stroke={color} strokeWidth={2.2} />
            <line x2={iw} y1={y(row.mark)} y2={y(row.mark)} stroke={t.ink} strokeDasharray="5 4" />
            <text x={4} y={y(row.mark) - 6} fontSize={10.5} fill={t.ink}>
              market {fmt.usd(row.mark)}
            </text>
            {Number.isFinite(iv) && (
              <g>
                <line x1={x(iv * 100)} x2={x(iv * 100)} y1={y(row.mark)} y2={ih} stroke={t.aqua} strokeWidth={1.5} />
                <circle cx={x(iv * 100)} cy={y(row.mark)} r={6} fill="none" stroke={t.aqua} strokeWidth={2.5} />
                <text x={x(iv * 100) + 6} y={ih - 8} fontSize={11} fontWeight={700} fill={t.aqua}>
                  IV {(iv * 100).toFixed(2)}%
                </text>
              </g>
            )}
            {steps.map((s, i) => (
              <circle key={i} cx={x(s.v)} cy={y(s.p)} r={3.5} fill={t.muted} />
            ))}
            <line x1={x(vol)} x2={x(vol)} y1={y(model)} y2={y(row.mark)} stroke={diff > 0 ? t.loss : t.profit} strokeWidth={2} />
            <circle cx={x(vol)} cy={y(model)} r={5.5} fill={color} stroke={t.surface} strokeWidth={2} />
          </g>
        </svg>
      </div>
      <Legend
        items={[
          { label: `Model price of the ${K} ${right}`, color },
          { label: 'Market mid', color: t.ink, kind: 'dash' },
          { label: 'Crossing = implied volatility', color: t.aqua, kind: 'dot' },
          ...(steps.length ? [{ label: 'Earlier guesses', color: t.muted, kind: 'dot' as const }] : []),
        ]}
      />
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Model at your guess" value={fmt.usd(model)} sub={`miss ${fmtSigned(diff)}`} accent={color} />
        <Tile label="Vega at your guess" value={vega.toFixed(3)} sub="$ per vol point" />
        <Tile label="Implied volatility" value={Number.isFinite(iv) ? fmt.pct(iv, 2) : 'n/a'} sub={`vendor shows ${fmt.pct(row.iv, 2)}`} accent={t.aqua} />
        <Tile label="Bid / ask as IV" value={`${ivTxt(impliedVol(right, row.bid, inp))} / ${ivTxt(impliedVol(right, row.ask, inp))}`} sub={`${fmt.usd(row.bid)} / ${fmt.usd(row.ask)}`} />
      </div>
    </div>
  );
}
