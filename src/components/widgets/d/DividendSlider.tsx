import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid, Legend } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';
import { S0, g, usd2 } from './common';

const TS = snapshot.termStructure;
const EXPS = {
  nov: TS.find((p) => p.dte === 31)!,
  jun: TS.find((p) => p.dte === 233)!,
  dec: TS.find((p) => p.dte === 416)!,
};
type E = keyof typeof EXPS;
type Row = { q: number; v: number; series: string };

/** Reprice the 770 call and put as the dividend yield changes. */
export default function DividendSlider() {
  const [exp, setExp] = useState<E>('dec');
  const [qPct, setQ] = useState(1.1);
  const p = EXPS[exp];
  const sigma = p.atmIv;
  const at = (q: number) => {
    const c = g('call', S0, 770, p.dte, sigma, q / 100);
    const pu = g('put', S0, 770, p.dte, sigma, q / 100);
    return { c: c.price, p: pu.price, cd: c.delta, pd: pu.delta };
  };
  const data = useMemo(() => {
    const out: Row[] = [];
    for (let q = 0; q <= 3.001; q += 0.05) {
      const x = at(q);
      out.push({ q, v: x.c, series: 'Call' }, { q, v: x.p, series: 'Put' });
    }
    return out;
  }, [exp]);
  const z = at(0);
  const now = at(qPct);
  const divDollars = S0 * (1 - Math.exp((-qPct / 100) * (p.dte / 365)));

  return (
    <div className="viz-card not-content">
      <CardHead title="Dividends: the 770 call and put repriced" sub={`Model, SPY ${S0}, rate 4.6%, one flat volatility (${(sigma * 100).toFixed(1)}%, the ATM IV for the expiry). Dividend as a continuous yield.`} />
      <div className="mb-3 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
        <Segmented
          label="Expiry"
          value={exp}
          onChange={setExp}
          options={[
            { value: 'nov', label: 'Nov 27' },
            { value: 'jun', label: "Jun '27" },
            { value: 'dec', label: "Dec '27" },
          ]}
        />
        <Slider label="Dividend yield" value={qPct} min={0} max={3} step={0.05} onChange={setQ} format={(v) => `${v.toFixed(2)}%${Math.abs(v - 1.1) < 0.03 ? ' (≈ SPY)' : ''}`} />
      </div>
      <PlotFigure
        deps={[data, qPct]}
        minHeight={260}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 260,
            marginLeft: 50,
            marginBottom: 40,
            style: plotStyle(t),
            x: { label: 'Dividend yield (%)', domain: [0, 3] },
            y: { label: 'Option value ($)', grid: true },
            color: { domain: ['Call', 'Put'], range: [t.call, t.put] },
            marks: [
              Plot.areaY(
                data.filter((d) => d.series === 'Call').map((d, i) => ({ q: d.q, hi: d.v, lo: data.filter((e) => e.series === 'Put')[i].v })),
                { x: 'q', y1: 'lo', y2: 'hi', fill: t['band-2'] },
              ),
              Plot.line(data, { x: 'q', y: 'v', stroke: 'series', strokeWidth: 2.2 }),
              Plot.ruleX([qPct], { stroke: t.muted, strokeDasharray: '3 3' }),
              Plot.dot(
                [
                  { q: qPct, v: now.c, s: 'Call' },
                  { q: qPct, v: now.p, s: 'Put' },
                ],
                { x: 'q', y: 'v', r: 5, fill: (d: { s: string }) => (d.s === 'Call' ? t.call : t.put), stroke: t.surface, strokeWidth: 2 },
              ),
              Plot.tip(data, Plot.pointer({ x: 'q', y: 'v', stroke: 'series', title: (d: Row) => `Yield ${d.q.toFixed(2)}%\n${d.series} ${usd2(d.v)}` })),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: '770 call', color: 'var(--viz-call)' },
          { label: '770 put', color: 'var(--viz-put)' },
          { label: 'Call − put gap', color: 'var(--viz-band-2)', kind: 'box' },
        ]}
      />
      <StatGrid
        items={[
          ['Call', usd2(now.c), `${now.c - z.c >= 0 ? '+' : '−'}${usd2(Math.abs(now.c - z.c))} vs no dividend`, 'var(--viz-call)'],
          ['Put', usd2(now.p), `${now.p - z.p >= 0 ? '+' : '−'}${usd2(Math.abs(now.p - z.p))} vs no dividend`, 'var(--viz-put)'],
          ['Call − put', usd2(now.c - now.p), `${usd2(z.c - z.p)} with no dividend`],
          ['Dividends to expiry', `≈ ${usd2(divDollars)}`, 'per share, present value'],
        ]}
      />
    </div>
  );
}
