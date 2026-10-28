import * as Plot from '@observablehq/plot';
import { useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot, fmt } from '../../../lib/snapshot';

type View = 'strike' | 'expiry';

const smile = [
  ...snapshot.chain.puts.map((p) => ({ K: p.strike, iv: p.iv * 100, side: 'Puts', otm: p.strike <= snapshot.spot })),
  ...snapshot.chain.calls.map((c) => ({ K: c.strike, iv: c.iv * 100, side: 'Calls', otm: c.strike >= snapshot.spot })),
];
const term = snapshot.termStructure.map((p) => ({
  dte: p.dte,
  label: new Date(p.expiry + 'T16:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
  call: p.callIv * 100,
  put: p.putIv * 100,
  atm: p.atmIv * 100,
}));

/** One option chain, many implied volatilities: across strikes (smile) and across expiries (term structure). */
export default function IvAcross() {
  const t = useTokens();
  const [view, setView] = useState<View>('strike');

  return (
    <div className="viz-card not-content">
      <CardHead
        title={view === 'strike' ? 'Implied volatility by strike, November 27' : 'Implied volatility by expiry, 770 strike'}
        sub={view === 'strike' ? 'Each dot is the vol that reprices one option. Filled dots are the out-of-the-money side, the ones that trade most' : 'At-the-money IV for nine expiries from 10 to 416 days'}
        right={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'strike', label: 'Across strikes' },
              { value: 'expiry', label: 'Across expiries' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[view]}
        minHeight={300}
        build={(width, tk) =>
          view === 'strike'
            ? Plot.plot({
                width,
                height: 300,
                marginLeft: 44,
                marginBottom: 40,
                style: plotStyle(tk),
                x: { label: 'Strike', domain: [640, 850] },
                y: { label: 'Implied vol (%)', grid: true, domain: [8, 34] },
                color: { domain: ['Puts', 'Calls'], range: [tk.put, tk.call] },
                marks: [
                  Plot.ruleX([snapshot.spot], { stroke: tk.stock, strokeDasharray: '3 3' }),
                  Plot.text([snapshot.spot], { x: (d: number) => d, frameAnchor: 'top', dy: 4, dx: 4, textAnchor: 'start', text: () => `SPY ${snapshot.spot}`, fill: tk.stock }),
                  Plot.line(smile.filter((d) => d.side === 'Puts'), { x: 'K', y: 'iv', stroke: tk.put, strokeOpacity: 0.5 }),
                  Plot.line(smile.filter((d) => d.side === 'Calls'), { x: 'K', y: 'iv', stroke: tk.call, strokeOpacity: 0.5 }),
                  Plot.dot(smile, { x: 'K', y: 'iv', stroke: 'side', fill: (d: { otm: boolean; side: string }) => (d.otm ? d.side : 'none'), r: 4.5, strokeWidth: 1.5 }),
                  Plot.tip(smile, Plot.pointer({ x: 'K', y: 'iv', title: (d: { K: number; iv: number; side: string }) => `${d.K} ${d.side === 'Puts' ? 'put' : 'call'}\nIV ${d.iv.toFixed(2)}%` })),
                ],
              })
            : Plot.plot({
                width,
                height: 300,
                marginLeft: 44,
                marginBottom: 40,
                style: plotStyle(tk),
                x: { label: 'Days to expiry', domain: [0, 430] },
                y: { label: 'Implied vol (%)', grid: true, domain: [13, 19.5] },
                marks: [
                  Plot.line(term, { x: 'dte', y: 'atm', stroke: tk.aqua, strokeWidth: 2.2 }),
                  Plot.dot(term, { x: 'dte', y: 'call', fill: tk.call, r: 3.5 }),
                  Plot.dot(term, { x: 'dte', y: 'put', fill: tk.put, r: 3.5 }),
                  Plot.dot(term, { x: 'dte', y: 'atm', fill: tk.aqua, stroke: tk.surface, r: 5 }),
                  Plot.tip(
                    term,
                    Plot.pointerX({
                      x: 'dte',
                      y: 'atm',
                      title: (d: (typeof term)[0]) => `${d.label} (${d.dte} days)\nATM ${d.atm.toFixed(2)}%\nCall ${d.call.toFixed(2)}% · Put ${d.put.toFixed(2)}%`,
                    }),
                  ),
                ],
              })
        }
      />
      {view === 'strike' ? (
        <Legend
          items={[
            { label: 'Put IV', color: t.put, kind: 'dot' },
            { label: 'Call IV', color: t.call, kind: 'dot' },
            { label: 'Spot', color: t.stock, kind: 'dash' },
          ]}
        />
      ) : (
        <Legend
          items={[
            { label: 'ATM IV (average of call and put)', color: t.aqua },
            { label: '770 call IV', color: t.call, kind: 'dot' },
            { label: '770 put IV', color: t.put, kind: 'dot' },
          ]}
        />
      )}
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        {view === 'strike'
          ? `650 put ${fmt.pct(snapshot.chain.puts[0].iv)}, 770 call ${fmt.pct(snapshot.chain.calls.find((c) => c.strike === 770)!.iv)}, 820 call ${fmt.pct(snapshot.chain.calls.find((c) => c.strike === 820)!.iv)}. Same underlying, same expiry, very different vols.`
          : `Beyond December the put IV sits above the call IV because the vendor model leaves out SPY's dividend (lesson B3).`}
      </p>
    </div>
  );
}
