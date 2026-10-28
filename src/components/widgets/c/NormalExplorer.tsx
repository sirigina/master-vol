import { useRef, useState } from 'react';
import { scaleLinear, area, line } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { normCdf, normPdf } from '../../../lib/pricing';
import { snapshot, fmt } from '../../../lib/snapshot';

type Mode = '1' | '2' | '3' | 'x';

/**
 * Normal curve with the ±1/2/3 SD areas shaded, labelled both in SDs and in
 * SPY daily moves at a chosen volatility.
 */
export default function NormalExplorer() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [mode, setMode] = useState<Mode>('1');
  const [z, setZ] = useState(1.5);
  const [vol, setVol] = useState(14);

  const k = mode === 'x' ? z : +mode;
  const inside = normCdf(k) - normCdf(-k);
  const daily = vol / Math.sqrt(252); // % per day
  const S = snapshot.spot;

  const narrow = width < 520;
  const m = { top: 16, right: 14, bottom: narrow ? 52 : 46, left: 14 };
  const height = 280;
  const iw = Math.max(width - m.left - m.right, 60);
  const ih = height - m.top - m.bottom;
  const x = scaleLinear().domain([-4, 4]).range([0, iw]);
  const y = scaleLinear().domain([0, normPdf(0) * 1.1]).range([ih, 0]);
  const xs = Array.from({ length: 321 }, (_, i) => -4 + i * 0.025);
  const curve = line<number>().x((v) => x(v)).y((v) => y(normPdf(v)))(xs) ?? '';
  const band = (a: number, b: number) =>
    area<number>()
      .x((v) => x(v))
      .y0(ih)
      .y1((v) => y(normPdf(v)))([a, ...xs.filter((v) => v > a && v < b), b]) ?? '';

  const fills = [t['band-1'], t['band-2'], t['band-2']];
  const shades = mode === 'x' ? [[-z, z]] : [1, 2, 3].filter((s) => s <= k).map((s) => [-s, s]);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="The bell curve and the 68-95-99.7 rule"
        sub="Shaded area = share of outcomes inside the band. Bottom axis also shows one SPY day at the chosen volatility."
      />
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <Segmented
          label="Band"
          value={mode}
          onChange={setMode}
          options={[
            { value: '1', label: '±1 SD' },
            { value: '2', label: '±2 SD' },
            { value: '3', label: '±3 SD' },
            { value: 'x', label: 'Custom' },
          ]}
        />
        {mode === 'x' ? (
          <Slider label="Band half-width" value={z} min={0.1} max={3.5} step={0.05} onChange={setZ} format={(v) => `±${v.toFixed(2)} SD`} />
        ) : (
          <Slider label="Volatility for the SPY axis" value={vol} min={5} max={60} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}% a year`} />
        )}
      </div>

      <div ref={wrap} className="mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label={`Normal curve with ${(inside * 100).toFixed(1)} percent of the area inside plus or minus ${k} standard deviations`} style={{ display: 'block' }}>
          <g transform={`translate(${m.left},${m.top})`}>
            {[...shades].reverse().map(([a, b], i) => (
              <path key={i} d={band(a, b)} fill={fills[shades.length - 1 - i] ?? t['band-2']} />
            ))}
            <path d={curve} fill="none" stroke={t.call} strokeWidth={2.2} />
            <line x2={iw} y1={ih} y2={ih} stroke={t.axis} />
            {[-k, k].map((v) => (
              <line key={v} x1={x(v)} x2={x(v)} y1={ih} y2={y(normPdf(v))} stroke={t.put} strokeWidth={1.6} />
            ))}
            <text x={x(0)} y={y(normPdf(0) * 0.45)} textAnchor="middle" fontSize={narrow ? 15 : 18} fontWeight={700} fill={t.ink}>
              {(inside * 100).toFixed(1)}%
            </text>
            {narrow && (
              <text x={iw} y={8} textAnchor="end" fontSize={10.5} fill={t.muted}>
                axis in SDs
              </text>
            )}
            <text x={x(0)} y={y(normPdf(0) * 0.45) + 18} textAnchor="middle" fontSize={11} fill={t['ink-2']}>
              inside ±{k.toFixed(mode === 'x' ? 2 : 0)} SD
            </text>
            {[-k, k].map((v) => {
              const tight = v < 0 ? x(v) < 95 : iw - x(v) < 95;
              const lx = tight ? (v < 0 ? 0 : iw) : x(v + (v < 0 ? -0.15 : 0.15));
              const ly = tight ? ih * 0.45 : y(normPdf(v)) - 6;
              return (
                <text key={'o' + v} x={lx} y={ly} textAnchor={v < 0 ? (tight ? 'start' : 'end') : tight ? 'end' : 'start'} fontSize={11} fill={t.put}>
                  {(((1 - inside) / 2) * 100).toFixed(k >= 3 ? 2 : 1)}% beyond
                </text>
              );
            })}
            {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
              <g key={v} transform={`translate(${x(v)},${ih})`}>
                <line y2={4} stroke={t.axis} />
                <text y={16} textAnchor="middle" fontSize={11} fill={t.muted}>
                  {v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}${narrow ? '' : ' SD'}`}
                </text>
                {(!narrow || v % 2 !== 0 || v === 0) && (
                  <text y={31} textAnchor="middle" fontSize={10.5} fill={t['ink-2']}>
                    {v === 0 ? fmt.usd(S, 0) : `${v > 0 ? '+' : '−'}${fmt.usd((Math.abs(v) * daily * S) / 100, narrow ? 0 : 2)}`}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <StatGrid
        items={[
          ['Inside the band', `${(inside * 100).toFixed(1)}%`],
          ['Outside (both tails)', `${((1 - inside) * 100).toFixed(k >= 3 ? 2 : 1)}%`],
          ['Happens outside about', 1 - inside > 0 ? `1 day in ${Math.round(1 / (1 - inside))}` : '–', 'if days were normal'],
          ['One SD for SPY, one day', `±${daily.toFixed(2)}% ≈ ${fmt.usd((daily * S) / 100)}`, `at ${vol.toFixed(1)}% vol`],
        ]}
      />
    </div>
  );
}
