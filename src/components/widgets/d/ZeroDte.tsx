import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import { S0, IV0, VOL0, K0, g, usd2 } from './common';

/** Hours → years on a calendar-time clock (24 × 365). */
const hrs = (h: number) => h / 24;

type Row = { h: number; v: number };

/** 0DTE explorer: the 770 call in its final session. */
export default function ZeroDte() {
  const [hours, setHours] = useState(6.5);
  const [vol, setVol] = useState(VOL0);
  const [spot, setSpot] = useState<'atm' | 'otm'>('atm');
  const sigma = vol / 100;
  const S = spot === 'atm' ? S0 : 765;

  const at = (h: number) => g('call', S, K0, hrs(h), sigma);
  const now = at(hours);
  const hourAhead = at(Math.max(hours - 1, 0));
  const perHour = hourAhead.price - now.price;
  const ref31 = g('call', S, K0, 31, sigma);

  const curve = useMemo(() => {
    const out: Row[] = [];
    for (let h = 6.5; h >= 0.02; h -= 0.02) out.push({ h, v: at(h).price });
    out.push({ h: 0, v: Math.max(S - K0, 0) });
    return out;
  }, [sigma, S]);

  return (
    <div className="viz-card not-content">
      <CardHead title="0DTE: the 770 call on expiration day" sub="Model illustration. Hours left in the session (calendar-time clock), SPY held fixed, no intraday volatility pattern." />
      <div className="mb-3 grid gap-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
        <Segmented
          label="SPY"
          value={spot}
          onChange={setSpot}
          options={[
            { value: 'atm', label: `SPY ${S0}` },
            { value: 'otm', label: 'SPY 765' },
          ]}
        />
        <Slider label="Hours left" value={hours} min={0.25} max={6.5} step={0.25} onChange={setHours} format={(v) => `${v.toFixed(2)} h`} />
        <Slider label="Volatility" value={vol} min={6} max={40} step={0.5} onChange={setVol} format={(v) => `${v.toFixed(1)}%`} />
      </div>
      <PlotFigure
        deps={[curve, hours]}
        minHeight={240}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 240,
            marginLeft: 48,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Hours left in the session', domain: [6.5, 0], reverse: false },
            y: { label: 'Call value ($)', grid: true, domain: [0, Math.max(...curve.map((d) => d.v)) * 1.1 + 0.01] },
            marks: [
              Plot.ruleY([0], { stroke: t.axis }),
              Plot.line(curve, { x: 'h', y: 'v', stroke: t.put, strokeWidth: 2.2 }),
              Plot.ruleX([hours], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.dot([{ h: hours, v: now.price }], { x: 'h', y: 'v', r: 5, fill: t.put, stroke: t.surface, strokeWidth: 2 }),
              Plot.tip(curve, Plot.pointerX({ x: 'h', y: 'v', title: (d: Row) => `${d.h.toFixed(2)} h left\nValue ${usd2(d.v)}` })),
            ],
          })
        }
      />
      <StatGrid
        items={[
          ['Call value', usd2(now.price), `vs ${usd2(ref31.price)} with 31 days left`],
          ['Decay next hour', usd2(perHour), `${now.price > 0.005 ? ((-perHour / now.price) * 100).toFixed(0) : '—'}% of the value`, 'var(--viz-put)'],
          ['Gamma', now.gamma.toFixed(3), `${(now.gamma / ref31.gamma).toFixed(1)}× the 31-day gamma`, 'var(--viz-call)'],
          ['Delta', now.delta.toFixed(2), `a $1 move shifts it ${(now.gamma).toFixed(2)}`],
        ]}
      />
    </div>
  );
}
