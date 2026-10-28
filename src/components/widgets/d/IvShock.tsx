import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid, Legend } from '../../ui/Stats';
import { snapshot, callAt, putAt, call2At, put2At } from '../../../lib/snapshot';
import { S0, g, usd0 } from './common';

type Strat = 'straddle' | 'call' | 'put';
type Exp = 'nov' | 'dec';
const STRIKES = ['750', '770', '790'];
type Row = { shift: number; v: number; series: string };

/** P/L of a real-chain position when implied volatility shifts in parallel. */
export default function IvShock() {
  const [strat, setStrat] = useState<Strat>('straddle');
  const [exp, setExp] = useState<Exp>('nov');
  const [k, setK] = useState('770');
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [shift, setShift] = useState(2);
  const K = +k;
  const dte = exp === 'nov' ? snapshot.chain.dte : snapshot.chain2.dte;
  const c = exp === 'nov' ? callAt(K)! : call2At(K)!;
  const p = exp === 'nov' ? putAt(K)! : put2At(K)!;
  const legs = [...(strat !== 'put' ? [{ r: 'call' as const, q: c }] : []), ...(strat !== 'call' ? [{ r: 'put' as const, q: p }] : [])];
  const sgn = side === 'long' ? 1 : -1;

  const value = (sh: number) => legs.reduce((a, l) => a + g(l.r, S0, K, dte, Math.max(l.q.iv + sh / 100, 0.005)).price, 0);
  const v0 = value(0);
  const vega = legs.reduce((a, l) => a + g(l.r, S0, K, dte, l.q.iv).vega, 0);
  const premium = legs.reduce((a, l) => a + l.q.mark, 0);

  const data = useMemo(() => {
    const out: Row[] = [];
    for (let s = -8; s <= 8; s += 0.25) {
      out.push({ shift: s, v: sgn * (value(s) - v0) * 100, series: 'Full reprice' });
      out.push({ shift: s, v: sgn * vega * s * 100, series: 'Vega × change' });
    }
    return out;
  }, [strat, exp, k, side]);
  const full = sgn * (value(shift) - v0) * 100;

  const ivLabel = legs.map((l) => `${l.r} ${(l.q.iv * 100).toFixed(1)}%`).join(', ');
  return (
    <div className="viz-card not-content">
      <CardHead title="What an implied-volatility shift does to a real position" sub="One contract (or one straddle) from the real chain, SPY and time held fixed; every leg's IV moves by the same number of points" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-wrap gap-2">
          <Segmented label="Side" value={side} onChange={setSide} options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]} />
          <Segmented
            label="Position"
            value={strat}
            onChange={setStrat}
            options={[
              { value: 'straddle', label: 'Straddle' },
              { value: 'call', label: 'Call' },
              { value: 'put', label: 'Put' },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented label="Strike" value={k} onChange={setK} options={STRIKES.map((s) => ({ value: s, label: s }))} />
          <Segmented
            label="Expiry"
            value={exp}
            onChange={setExp}
            options={[
              { value: 'nov', label: `Nov 27 (${snapshot.chain.dte}d)` },
              { value: 'dec', label: `Dec 18 (${snapshot.chain2.dte}d)` },
            ]}
          />
        </div>
      </div>
      <Slider className="mt-3" label="IV change" value={shift} min={-8} max={8} step={0.25} onChange={setShift} format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} vol points`} />
      <div className="mt-3">
        <PlotFigure
          deps={[data, shift]}
          minHeight={260}
          build={(width, t) =>
            Plot.plot({
              width,
              height: 260,
              marginLeft: 60,
              marginBottom: 40,
              style: plotStyle(t),
              x: { label: 'IV change (vol points)', domain: [-8, 8] },
              y: { label: 'P/L ($)', grid: true },
              color: { domain: ['Full reprice', 'Vega × change'], range: [t.call, t.put] },
              marks: [
                Plot.ruleY([0], { stroke: t.axis }),
                Plot.ruleX([0], { stroke: t.axis }),
                Plot.ruleX([shift], { stroke: t.muted, strokeDasharray: '3 3' }),
                Plot.line(data.filter((d) => d.series === 'Full reprice'), { x: 'shift', y: 'v', stroke: t.call, strokeWidth: 2 }),
                Plot.line(data.filter((d) => d.series !== 'Full reprice'), { x: 'shift', y: 'v', stroke: t.put, strokeWidth: 2, strokeDasharray: '6 4' }),
                Plot.dot([{ shift, v: full }], { x: 'shift', y: 'v', r: 5, fill: t.call, stroke: t.surface, strokeWidth: 2 }),
                Plot.tip(data.filter((d) => d.series === 'Full reprice'), Plot.pointerX({ x: 'shift', y: 'v', title: (d: Row) => `IV ${d.shift >= 0 ? '+' : '−'}${Math.abs(d.shift)} pts\nP/L ${usd0(d.v)}` })),
              ],
            })
          }
        />
      </div>
      <Legend
        items={[
          { label: 'Full reprice', color: 'var(--viz-call)' },
          { label: 'Vega × IV change', color: 'var(--viz-put)', kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          ['Premium', `$${(premium * 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, `mid ${premium.toFixed(2)} × 100`],
          ['Position vega', `${sgn > 0 ? '+' : '−'}$${(vega * 100).toFixed(0)}`, 'per vol point'],
          ['P/L at this shift', usd0(full), `${((full / (premium * 100)) * 100).toFixed(1)}% of premium`, 'var(--viz-call)'],
          ['Expiry', `${dte} days`, `IV: ${ivLabel}`],
        ]}
      />
    </div>
  );
}
