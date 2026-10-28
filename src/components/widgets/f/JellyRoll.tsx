import { useMemo, useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { pairAt, divTree, S0, R, T1, T2, EX_T, money, pct } from './fdata';

/**
 * Jelly roll: long the Dec 18 770 synthetic, short the Nov 27 770 synthetic.
 * Compares the market price with financing alone, and with the December dividend.
 */
export default function JellyRoll() {
  const t = useTokens();
  const [rate, setRate] = useState(R * 100);
  const [div, setDiv] = useState(2.1);
  const n = pairAt('nov', 770);
  const d = pairAt('dec', 770);
  const mkt = d.call.mark - d.put.mark - (n.call.mark - n.put.mark);
  const bid = d.call.bid - d.put.ask - (n.call.ask - n.put.bid);
  const ask = d.call.ask - d.put.bid - (n.call.bid - n.put.ask);
  const r = rate / 100;
  const fin = 770 * (Math.exp(-r * T1) - Math.exp(-r * T2));
  const pvD = div * Math.exp(-r * EX_T);
  const amer = useMemo(() => {
    const sn = (n.call.iv + n.put.iv) / 2;
    const sd = (d.call.iv + d.put.iv) / 2;
    const syn = (T: number, s: number, D: number) =>
      divTree('call', { S: S0, K: 770, T, r, sigma: s, D, tD: EX_T, steps: 500 }) - divTree('put', { S: S0, K: 770, T, r, sigma: s, D, tD: EX_T, steps: 500 });
    return syn(T2, sd, div) - syn(T1, sn, 0);
  }, [rate, div]);
  const fwd = -Math.log(1 - mkt / (770 * Math.exp(-r * T1))) / (T2 - T1);

  const vals = [
    { label: 'Financing only', v: fin, color: t.stock },
    { label: 'European, full dividend', v: fin - pvD, color: t.put },
    { label: 'American model, with dividend', v: amer, color: t.aqua },
    { label: 'Market (mid)', v: mkt, color: t.ink },
  ];
  const lo = Math.min(-0.5, ...vals.map((x) => x.v));
  const hi = Math.max(2.5, ...vals.map((x) => x.v), ask);
  const X = (v: number) => 8 + ((v - lo) / (hi - lo)) * 84;

  return (
    <div className="viz-card not-content">
      <CardHead title="Jelly roll: November vs December 770 synthetics" sub="Long the Dec 18 synthetic (call − put), short the Nov 27 synthetic. What should the 21 days in between cost?" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Financing rate" value={rate} min={3} max={6} step={0.05} onChange={setRate} format={(v) => `${v.toFixed(2)}%`} />
        <Slider label="Dividend going ex Dec 18" value={div} min={0} max={3} step={0.05} onChange={setDiv} format={(v) => `$${v.toFixed(2)}`} />
      </div>
      <div className="mt-4 grid gap-2">
        {vals.map((v) => (
          <div key={v.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 sm:grid-cols-[13rem_1fr_4rem]">
            <div className="text-[0.78rem] leading-tight text-(--sl-color-gray-3)">{v.label}</div>
            <div className="relative order-3 col-span-2 h-6 sm:order-none sm:col-span-1">
              <div className="absolute left-0 right-0 top-1/2 h-px bg-(--sl-color-gray-5)" />
              <div className="absolute top-0.5 h-5 rounded" style={{ left: `${X(bid)}%`, width: `${X(ask) - X(bid)}%`, background: t['band-1'] }} />
              <div className="absolute top-1/2 w-px bg-(--sl-color-gray-4)" style={{ left: `${X(0)}%`, height: 24, transform: 'translateY(-50%)' }} />
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{ left: `${X(v.v)}%`, background: v.color, borderColor: t.surface }}
              />
            </div>
            <div className="text-right text-[0.88rem] font-semibold tabular-nums">{money(v.v)}</div>
          </div>
        ))}
        <div className="text-[0.75rem] text-(--sl-color-gray-3)">
          Shaded band: market bid to ask ({money(bid)} to {money(ask)}). Thin tick: $0.
        </div>
      </div>
      <StatGrid
        items={[
          ['Dec synthetic', money(d.call.mark - d.put.mark), `${d.call.mark.toFixed(2)} − ${d.put.mark.toFixed(2)}`],
          ['Nov synthetic', money(n.call.mark - n.put.mark), `${n.call.mark.toFixed(2)} − ${n.put.mark.toFixed(2)}`],
          ['Jelly roll, bid / ask', `${money(bid)} / ${money(ask)}`, 'shaded band'],
          ['Forward rate if no dividend', pct(fwd), 'Nov 27 → Dec 18, misleading'],
        ]}
      />
      <p className="mt-2 text-[0.78rem] text-(--sl-color-gray-3)">
        Model values use a binomial tree with the dividend paid in cash on the ex-date and the call holder free to exercise the evening before. Average of call and
        put IV at each expiry.
      </p>
    </div>
  );
}
