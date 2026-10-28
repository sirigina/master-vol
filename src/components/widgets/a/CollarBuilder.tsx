import { useState } from 'react';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import MultiPayoff from './MultiPayoff';
import { S0, quote, money0, money2, selectCls } from './common';
import { call, put, stock } from './strategies';

const PUTS = [700, 720, 740, 750, 760, 765];
const CALLS = [775, 780, 790, 800, 820];

/** Own 100 SPY, buy a put below, sell a call above: build it with real strikes. */
export default function CollarBuilder() {
  const t = useTokens();
  const [kp, setKp] = useState(750);
  const [kc, setKc] = useState(790);
  const p = quote('put', kp)!.mark;
  const c = quote('call', kc)!.mark;
  const net = p - c; // + = debit
  const floor = kp - S0 - net;
  const cap = kc - S0 - net;
  const legs = [stock(), put(kp, 1), call(kc, -1)];

  return (
    <div className="viz-card not-content">
      <CardHead title="Collar builder" sub={`You own 100 SPY at ${S0}. Buy a put below, sell a call above. Real Nov 27 marks.`} />
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[0.82rem] text-(--sl-color-gray-3)">
        <label className="inline-flex items-center gap-2">
          Buy put
          <select className={selectCls} value={kp} onChange={(e) => setKp(+e.target.value)} aria-label="Put strike">
            {PUTS.map((k) => (
              <option key={k} value={k}>
                {k} ({quote('put', k)!.mark.toFixed(2)})
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2">
          Sell call
          <select className={selectCls} value={kc} onChange={(e) => setKc(+e.target.value)} aria-label="Call strike">
            {CALLS.map((k) => (
              <option key={k} value={k}>
                {k} ({quote('call', k)!.mark.toFixed(2)})
              </option>
            ))}
          </select>
        </label>
      </div>
      <MultiPayoff
        tokens={t}
        lo={700}
        hi={840}
        spot={S0}
        marks={[
          { x: kp, label: `put ${kp}` },
          { x: kc, label: `call ${kc}` },
        ]}
        series={[
          { label: 'Collar', color: t.stock, legs },
          { label: '100 SPY alone', color: t.muted, legs: [stock()], dash: true },
        ]}
        ariaLabel="Collar payoff at expiration compared with owning the shares"
      />
      <StatGrid
        items={[
          ['Net cost', net > 0.004 ? `Pay ${money2(net)}` : net < -0.004 ? `Collect ${money2(-net)}` : 'Zero cost', `${money0(Math.abs(net) * 100, false)} per 100 shares`],
          ['Worst case', money0(floor * 100), `below ${kp}: ${floor >= 0 ? '+' : '−'}${Math.abs((floor / S0) * 100).toFixed(1)}%`, 'var(--viz-loss)'],
          ['Best case', money0(cap * 100), `above ${kc}: ${cap >= 0 ? '+' : '−'}${Math.abs((cap / S0) * 100).toFixed(1)}%`, 'var(--viz-profit)'],
          ['Collar range', `${kp} – ${kc}`, 'P/L tracks the shares in between'],
        ]}
      />
    </div>
  );
}
