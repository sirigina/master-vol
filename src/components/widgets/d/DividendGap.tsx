import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { snapshot } from '../../../lib/snapshot';
import { S0, R, expLabel } from './common';

type Row = { label: string; dte: number; gap: number; qImp: number; divUsd: number; callIv: number; putIv: number; afterDiv: boolean };
const rows: Row[] = snapshot.termStructure.map((p) => {
  const T = p.dte / 365;
  const fwdNoDiv = S0 - 770 * Math.exp(-R * T);
  const parity = p.callMark - p.putMark;
  const qImp = -Math.log((parity + 770 * Math.exp(-R * T)) / S0) / T;
  return {
    label: expLabel(p.expiry),
    dte: p.dte,
    gap: (p.putIv - p.callIv) * 100,
    qImp: qImp * 100,
    divUsd: fwdNoDiv - parity,
    callIv: p.callIv,
    putIv: p.putIv,
    afterDiv: p.dte >= 52,
  };
});

const val = (d: Row, k: 'gap' | 'qImp') => d[k];

/** Vendor call-vs-put IV gap across expiries, and the dividend yield that parity implies. */
export default function DividendGap() {
  const [view, setView] = useState<'gap' | 'q'>('gap');
  const key = view === 'gap' ? 'gap' : 'qImp';
  return (
    <div className="viz-card not-content">
      <CardHead
        title={view === 'gap' ? '770 put IV minus call IV, by expiry (vendor quotes)' : 'Dividend yield implied by put-call parity, by expiry'}
        sub={view === 'gap' ? 'Positive bars: the vendor shows a higher IV for the put than for the call at the same strike' : 'The yield that makes the quoted call and put agree, with the 4.6% rate. Dashed: SPY’s ≈ 1.1% yield.'}
        right={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'gap', label: 'IV gap' },
              { value: 'q', label: 'Implied yield' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[view]}
        minHeight={280}
        build={(width, t) =>
          Plot.plot({
            width,
            height: 280,
            marginLeft: 50,
            marginBottom: width < 520 ? 56 : 40,
            style: plotStyle(t),
            x: { label: null, domain: rows.map((d) => d.label), tickRotate: width < 520 ? -45 : 0, padding: 0.25 },
            y: { label: view === 'gap' ? 'Put IV − call IV (vol points)' : 'Implied dividend yield (%)', grid: true, domain: view === 'gap' ? [-0.6, 1.2] : [-2, 2] },
            marks: [
              Plot.barY(rows, { x: 'label', y: key, fill: (d: Row) => (d.afterDiv ? t.put : t.muted), rx: 2 }),
              Plot.ruleY([0], { stroke: t.axis }),
              view === 'q' ? Plot.ruleY([1.1], { stroke: t.ink, strokeDasharray: '6 4' }) : null,
              ...[true, false].map((pos) =>
                Plot.text(
                  rows.filter((d) => (val(d, key) >= 0) === pos),
                  {
                    x: 'label',
                    y: key,
                    dy: pos ? -7 : 9,
                    text: (d: Row) => `${val(d, key) >= 0 ? '+' : '−'}${Math.abs(val(d, key)).toFixed(view === 'gap' ? 2 : 1)}`,
                    fill: t['ink-2'],
                    fontSize: width < 520 ? 8.5 : 10.5,
                  },
                ),
              ),
              Plot.tip(
                rows,
                Plot.pointerX({
                  x: 'label',
                  y: key,
                  title: (d: Row) =>
                    `${d.label} · ${d.dte} days\nCall IV ${(d.callIv * 100).toFixed(2)}%, put IV ${(d.putIv * 100).toFixed(2)}%\nParity-implied yield ${d.qImp.toFixed(2)}%\nImplied dividends ≈ $${d.divUsd.toFixed(2)}`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Expiry on or after the December ex-dividend date', color: 'var(--viz-put)', kind: 'box' },
          { label: 'No ex-dividend date before expiry', color: 'var(--viz-muted)', kind: 'box' },
          ...(view === 'q' ? [{ label: 'SPY yield ≈ 1.1%', color: 'var(--viz-ink)', kind: 'dash' as const }] : []),
        ]}
      />
    </div>
  );
}
