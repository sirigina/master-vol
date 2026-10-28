import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { normPdf } from '../../../lib/pricing';
import { coinWalks } from './volmath';

const MAX_DRAWN = 120;

/** Coin-flip random walks; end points pile up into a bell curve whose width grows like √steps. */
export default function RandomWalkSim() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [paths, setPaths] = useState(300);
  const [steps, setSteps] = useState(100);
  const [seed, setSeed] = useState(12);
  const [shown, setShown] = useState(300);
  const raf = useRef<number | null>(null);

  const walks = useMemo(() => coinWalks(paths, steps, seed), [paths, steps, seed]);

  useEffect(() => setShown(paths), [paths, steps]);

  function run() {
    if (raf.current) cancelAnimationFrame(raf.current);
    setSeed((s) => s + 1);
    const t0 = performance.now();
    const dur = 1600;
    const tick = (now: number) => {
      const f = Math.min((now - t0) / dur, 1);
      setShown(Math.max(1, Math.round(paths * f * f)));
      if (f < 1) raf.current = requestAnimationFrame(tick);
    };
    setShown(1);
    raf.current = requestAnimationFrame(tick);
  }
  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  const n = Math.min(shown, paths);
  const ends = walks.slice(0, n).map((w) => w[steps]);
  const mean = ends.reduce((a, b) => a + b, 0) / Math.max(ends.length, 1);
  const sd = ends.length > 1 ? Math.sqrt(ends.reduce((a, b) => a + (b - mean) ** 2, 0) / (ends.length - 1)) : 0;
  const root = Math.sqrt(steps);
  const within = ends.filter((e) => Math.abs(e) <= root).length;

  const narrow = width < 520;
  const m = { top: 14, right: 12, bottom: 34, left: 40 };
  const height = narrow ? 300 : 340;
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = height - m.top - m.bottom;
  const histW = Math.round(iw * (narrow ? 0.34 : 0.28));
  const gap = 10;
  const pw = iw - histW - gap;

  const lim = Math.ceil(4 * root);
  const y = scaleLinear().domain([-lim, lim]).range([ih, 0]);
  const x = scaleLinear().domain([0, steps]).range([0, pw]);
  const pathGen = line<number>().x((_, i) => x(i)).y((v) => y(v));

  // Histogram: end points share the parity of `steps`, so bin in multiples of 2.
  const bw = 2 * Math.max(1, Math.round(root / 6));
  const bins = new Map<number, number>();
  for (const e of ends) {
    const b = Math.floor((e + lim) / bw);
    bins.set(b, (bins.get(b) ?? 0) + 1);
  }
  const curve = (v: number) => (n * bw * normPdf(v / root)) / root;
  const peak = Math.max(curve(0), ...bins.values(), 1);
  const hx = scaleLinear().domain([0, peak * 1.08]).range([0, histW]);
  const curvePts: [number, number][] = [];
  for (let v = -lim; v <= lim; v += lim / 60) curvePts.push([hx(curve(v)), y(v)]);
  const curvePath = 'M' + curvePts.map((p) => p.join(',')).join('L');

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Coin-flip walks pile up into a bell curve"
        sub="Each step is +1 or −1 with equal odds. Illustration with simulated flips, not market data."
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Slider label="Number of walks" value={paths} min={1} max={1000} step={1} onChange={setPaths} format={(v) => `${v}`} />
        <Slider label="Steps per walk" value={steps} min={10} max={400} step={10} onChange={setSteps} format={(v) => `${v}`} />
        <button
          type="button"
          onClick={run}
          className="justify-self-start cursor-pointer rounded-lg border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-3 py-1.5 text-[0.82rem] font-semibold text-(--sl-color-white) hover:bg-(--sl-color-gray-6)"
        >
          Flip new coins
        </button>
      </div>

      <div ref={wrap} className="mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label="Random walk paths with a histogram of where they ended" style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(narrow ? 5 : 7).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`}>
                <line x2={iw} stroke={t.grid} />
                <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
                  {v > 0 ? `+${v}` : v}
                </text>
              </g>
            ))}
            {x.ticks(narrow ? 3 : 5).map((v) => (
              <text key={v} x={x(v)} y={ih + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {v}
              </text>
            ))}
            <text x={pw / 2} y={ih + 32} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              Step
            </text>
            <text transform={`translate(-30,${ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              Position
            </text>

            {walks.slice(0, Math.min(n, MAX_DRAWN)).map((w, i) => (
              <path key={i} d={pathGen(w) ?? ''} fill="none" stroke={t.call} strokeOpacity={n > 40 ? 0.22 : 0.55} strokeWidth={1.2} />
            ))}
            {/* ±√n guides */}
            {[1, -1, 2, -2].map((k) => {
              const pts = Array.from({ length: 41 }, (_, i) => {
                const s = (steps * i) / 40;
                return `${x(s)},${y(k * Math.sqrt(s))}`;
              });
              return <path key={k} d={'M' + pts.join('L')} fill="none" stroke={Math.abs(k) === 1 ? t.put : t.muted} strokeWidth={1.6} strokeDasharray={Math.abs(k) === 1 ? undefined : '4 3'} />;
            })}

            {/* histogram of end points, sideways */}
            <g transform={`translate(${pw + gap},0)`}>
              <line y2={ih} stroke={t.axis} />
              {[...bins.entries()].map(([b, c]) => {
                const lo = -lim + b * bw;
                return <rect key={b} x={0} y={y(lo + bw)} width={hx(c)} height={Math.max(y(lo) - y(lo + bw) - 1, 0.5)} fill={t.call} fillOpacity={0.75} />;
              })}
              <path d={curvePath} fill="none" stroke={t.stock} strokeWidth={2} />
              <text x={histW} y={ih + 32} textAnchor="end" fontSize={11} fill={t['ink-2']}>
                Where they ended
              </text>
            </g>
          </g>
        </svg>
      </div>
      <Legend
        items={[
          { label: `Walks (${Math.min(n, MAX_DRAWN)} of ${n} drawn)`, color: t.call },
          { label: '±√steps (one standard deviation)', color: t.put },
          { label: '±2√steps', color: t.muted, kind: 'dash' },
          { label: 'Bell curve, SD = √steps', color: t.stock },
        ]}
      />
      <StatGrid
        items={[
          ['Average end point', mean.toFixed(1), 'should be near 0'],
          ['Spread of end points (SD)', sd.toFixed(1), `theory: √${steps} = ${root.toFixed(1)}`],
          ['Within ±√steps', n ? `${((100 * within) / n).toFixed(0)}%` : '–', 'bell ≈ 68%; whole steps nudge it up'],
          ['Walks so far', `${n}`],
        ]}
      />
    </div>
  );
}
