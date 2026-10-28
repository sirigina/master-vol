import { useState } from 'react';
import LineChart, { money0, moneySigned, kfmtSigned } from './LineChart';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { positionPnlAtExpiry } from '../../../lib/pricing';
import { putAt, callAt } from '../../../lib/snapshot';
import {
  S0, STRUCT_KEYS, STRUCT_LABEL, optionLegs, withStock, cost100, describe,
  LONG_STRIKES, SHORT_STRIKES, CALL_STRIKES, type StructKey,
} from './structures';

const LO = 600;

const HI = 840;

/** I2: four hedge structures on 100 SPY shares, payoff overlay and cost table (market vs flat vol). */
export default function StructureCompare() {
  const t = useTokens();
  const [long, setLong] = useState(750);
  const [short, setShort] = useState(700);
  const [call, setCall] = useState(790);
  const [focus, setFocus] = useState<StructKey>('ps');

  const s = { long, short, call };
  const colors: Record<StructKey, string> = { pp: t.call, ps: t.aqua, r12: t.put, sg: t.stock };
  const xs = Array.from({ length: 121 }, (_, i) => LO + i * 2);

  const series = [
    { key: 'naked', label: 'Unhedged', color: t.muted, points: xs.map((x) => ({ x, y: (x - S0) * 100 })), dash: true, width: 1.5 },
    ...STRUCT_KEYS.map((k) => {
      const legs = withStock(optionLegs(k, s));
      return {
        key: k,
        label: STRUCT_LABEL[k],
        color: colors[k],
        points: xs.map((x) => ({ x, y: positionPnlAtExpiry(legs, x) * 100 })),
        width: k === focus ? 3 : 1.75,
        faded: k !== focus,
      };
    }),
  ];

  const opt = (arr: number[]) => arr.map((k) => ({ value: String(k), label: String(k) }));

  return (
    <div className="viz-card not-content">
      <CardHead title="Four ways to hedge 100 SPY shares" sub="Nov 27 expiry, mid prices. Highlight one structure; the others stay faint for comparison." />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Long put</div>
          <Segmented label="Long put strike" value={String(long)} onChange={(v) => setLong(+v)} options={opt(LONG_STRIKES)} />
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Short put(s)</div>
          <Segmented label="Short put strike" value={String(short)} onChange={(v) => setShort(+v)} options={opt(SHORT_STRIKES)} />
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Short call (seagull)</div>
          <Segmented label="Call strike" value={String(call)} onChange={(v) => setCall(+v)} options={opt(CALL_STRIKES)} />
        </div>
      </div>
      <div className="mt-3">
        <Segmented label="Highlight" value={focus} onChange={setFocus} options={STRUCT_KEYS.map((k) => ({ value: k, label: STRUCT_LABEL[k] }))} />
      </div>
      <div className="mt-3">
        <LineChart
          ariaLabel="Expiration P/L of four hedge structures on 100 SPY shares"
          height={320}
          series={series}
          xDomain={[LO, HI]}
          xLabel="SPY at Nov 27 expiration"
          yLabel="P/L, shares + hedge"
          yFmt={kfmtSigned}
          tipFmt={moneySigned}
          tipTitle={(v) => `SPY at ${v.toFixed(0)}`}
          vlines={[{ x: S0, label: 'today' }]}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.78rem] text-(--sl-color-gray-3)">
        {series.map((sr) => (
          <span key={sr.key} className="inline-flex items-center gap-1.5" style={{ opacity: 'faded' in sr && sr.faded ? 0.6 : 1 }}>
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="22" y2="4" style={{ stroke: sr.color }} strokeWidth="2.5" strokeDasharray={'dash' in sr && sr.dash ? '5 4' : undefined} />
            </svg>
            {sr.label}
          </span>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-[0.82rem] tabular-nums">
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              <th className="py-1 pr-2 font-medium">Structure</th>
              <th className="py-1 pr-2 font-medium">Legs</th>
              <th className="py-1 pr-2 text-right font-medium">Cost (market)</th>
              <th className="py-1 pr-2 text-right font-medium">Cost at flat 14.1% vol</th>
              <th className="py-1 pr-2 font-medium">What it protects</th>
            </tr>
          </thead>
          <tbody>
            {STRUCT_KEYS.map((k) => {
              const legs = optionLegs(k, s);
              const flat = optionLegs(k, s, true);
              const c = cost100(legs);
              const cf = cost100(flat);
              const fmtC = (v: number) => (Math.abs(v) < 0.5 ? '$0' : v > 0 ? `Pay ${money0(v)}` : `Collect ${money0(-v)}`);
              return (
                <tr
                  key={k}
                  className="cursor-pointer border-t border-(--sl-color-hairline)"
                  style={{ fontWeight: k === focus ? 600 : 400 }}
                  onClick={() => setFocus(k)}
                >
                  <td className="py-1.5 pr-2">
                    <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: colors[k] }} />
                    {STRUCT_LABEL[k]}
                  </td>
                  <td className="py-1.5 pr-2 text-(--sl-color-gray-2)">{describe(k, s)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtC(c)}</td>
                  <td className="py-1.5 pr-2 text-right text-(--sl-color-gray-3)">{fmtC(cf)}</td>
                  <td className="py-1.5 pr-2 text-(--sl-color-gray-2)">
                    {k === 'pp' && `Full floor at ${long}`}
                    {k === 'ps' && `${long} down to ${short}, then none`}
                    {k === 'r12' && `${long} to ${short}; worse than unhedged below ${(2 * short - long + cost100(legs) / 100).toFixed(2)}`}
                    {k === 'sg' && `${long} down to ${short}; gains capped at ${call}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Leg marks: {long} put {putAt(long)!.mark.toFixed(2)} ({(putAt(long)!.iv * 100).toFixed(1)}% IV), {short} put {putAt(short)!.mark.toFixed(2)} (
        {(putAt(short)!.iv * 100).toFixed(1)}% IV), {call} call {callAt(call)!.mark.toFixed(2)} ({(callAt(call)!.iv * 100).toFixed(1)}% IV). The flat-vol column reprices every leg at the
        at-the-money 14.1% to show what skew adds or saves.
      </p>
    </div>
  );
}
