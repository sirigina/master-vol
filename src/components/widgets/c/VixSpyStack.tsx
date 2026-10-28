import { useRef, useState } from 'react';
import { scaleLinear, scaleTime, line, timeFormat } from 'd3';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';

const spyMap = new Map(snapshot.closes);
const rows = snapshot.vix
  .filter(([d]) => spyMap.has(d))
  .map(([d, v]) => ({ date: new Date(d + 'T16:00:00'), vix: v, spy: spyMap.get(d)! }));
const vixMean = snapshot.vix.reduce((a, v) => a + v[1], 0) / snapshot.vix.length;
const fmtD = timeFormat('%b %-d, %Y');
const fmtTick = timeFormat('%b');

/** VIX and SPY as two stacked panels on one time axis, with a shared crosshair. */
export default function VixSpyStack() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [hover, setHover] = useState<number | null>(null);

  const narrow = width < 520;
  const m = { top: 10, right: 14, bottom: 26, left: 44 };
  const panelH = narrow ? 150 : 170;
  const gap = 40;
  const height = m.top + 12 + panelH * 2 + gap + m.bottom;
  const iw = Math.max(width - m.left - m.right, 60);

  const x = scaleTime().domain([rows[0].date, rows[rows.length - 1].date]).range([0, iw]);
  const yV = scaleLinear().domain([10, 34]).range([panelH, 0]);
  const yS = scaleLinear().domain([600, 800]).range([panelH, 0]);
  const vPath = line<(typeof rows)[0]>().x((d) => x(d.date)).y((d) => yV(d.vix))(rows) ?? '';
  const sPath = line<(typeof rows)[0]>().x((d) => x(d.date)).y((d) => yS(d.spy))(rows) ?? '';
  const h = hover === null ? null : rows[hover];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const dx = x.invert(e.clientX - r.left).getTime();
    let best = 0;
    rows.forEach((p, i) => {
      if (Math.abs(p.date.getTime() - dx) < Math.abs(rows[best].date.getTime() - dx)) best = i;
    });
    setHover(best);
  }

  const panel = (title: string, y: typeof yV, path: string, color: string, ticks: number[], off: number, key: 'vix' | 'spy') => (
    <g transform={`translate(0,${off})`}>
      {ticks.map((v) => (
        <g key={v} transform={`translate(0,${y(v)})`}>
          <line x2={iw} stroke={t.grid} />
          <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill={t.muted}>
            {v}
          </text>
        </g>
      ))}
      <text x={4} y={-8} fontSize={11} fontWeight={600} fill={color}>
        {title}
      </text>
      {key === 'vix' && (
        <>
          <line x2={iw} y1={y(vixMean)} y2={y(vixMean)} stroke={t.muted} strokeDasharray="4 3" />
        </>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={1.8} />
      {h && <circle cx={x(h.date)} cy={y(h[key])} r={4} fill={color} stroke={t.surface} strokeWidth={2} />}
    </g>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="VIX and SPY, one year" sub="Two panels sharing the same dates. Hover or tap to line up a day." />
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label="VIX in the top panel and SPY in the bottom panel over the same year" style={{ display: 'block', touchAction: 'pan-y' }}>
          <g transform={`translate(${m.left},${m.top + 12})`}>
            {panel('VIX', yV, vPath, t.put, [10, 15, 20, 25, 30], 0, 'vix')}
            {panel('SPY', yS, sPath, t.call, [600, 650, 700, 750, 800], panelH + gap, 'spy')}
            {x.ticks(narrow ? 4 : 8).map((d) => (
              <text key={+d} x={x(d)} y={panelH * 2 + gap + 18} textAnchor="middle" fontSize={11} fill={t.muted}>
                {d.getMonth() === 0 ? d.getFullYear() : fmtTick(d)}
              </text>
            ))}
            {h && <line x1={x(h.date)} x2={x(h.date)} y1={0} y2={panelH * 2 + gap} stroke={t['ink-2']} strokeDasharray="3 3" pointerEvents="none" />}
            <rect width={iw} height={panelH * 2 + gap} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </g>
        </svg>
        {h && (
          <div className="viz-tip" style={{ left: Math.max(4, Math.min(m.left + x(h.date) + 12, width - 170)), top: m.top + panelH - 10 }}>
            <div style={{ color: 'var(--sl-color-gray-3)' }}>{fmtD(h.date)}</div>
            <div>
              VIX <b>{h.vix.toFixed(2)}</b>
            </div>
            <div>
              SPY <b>{h.spy.toFixed(2)}</b>
            </div>
          </div>
        )}
      </div>
      <Legend
        items={[
          { label: 'VIX close', color: t.put },
          { label: 'SPY close', color: t.call },
          { label: `VIX 1-year average (${vixMean.toFixed(1)})`, color: t.muted, kind: 'dash' },
        ]}
      />
    </div>
  );
}
