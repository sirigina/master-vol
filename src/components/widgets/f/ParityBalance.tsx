import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { bs } from '../../../lib/pricing';
import { S0, R } from './fdata';

/**
 * A balance: left pan C − P (Black-Scholes, any volatility), right pan S − PV(K).
 * Moving volatility changes both options but never tips the scale.
 */
export default function ParityBalance() {
  const t = useTokens();
  const [S, setS] = useState(Math.round(S0));
  const [K, setK] = useState(770);
  const [r, setR] = useState(R * 100);
  const [days, setDays] = useState(31);
  const [vol, setVol] = useState(14);
  const [quote, setQuote] = useState(0);
  const T = days / 365;
  const inp = { S, K, T, r: r / 100, sigma: vol / 100 };
  const C = bs('call', inp).price;
  const P = bs('put', inp).price;
  const left = C + quote - P;
  const pvK = K * Math.exp((-r / 100) * T);
  const right = S - pvK;
  const diff = left - right;
  const tilt = Math.max(-14, Math.min(14, diff * 4));
  const cx = 180;
  const cy = 70;
  const arm = 120;
  const rad = (tilt * Math.PI) / 180;
  const lx = cx - arm * Math.cos(rad);
  const ly = cy - arm * Math.sin(rad);
  const rx = cx + arm * Math.cos(rad);
  const ry = cy + arm * Math.sin(rad);

  const pan = (x: number, y: number, title: string, value: number, sub: string, color: string) => (
    <g transform={`translate(${x},${y})`}>
      <line x1={-38} y1={0} x2={0} y2={48} stroke={t.muted} />
      <line x1={38} y1={0} x2={0} y2={48} stroke={t.muted} />
      <path d="M-50,48 L50,48 L40,62 L-40,62 Z" fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
      <text y={84} textAnchor="middle" fontSize={12} fill={t['ink-2']}>
        {title}
      </text>
      <text y={102} textAnchor="middle" fontSize={16} fontWeight={700} fill={t.ink}>
        {value.toFixed(2)}
      </text>
      <text y={118} textAnchor="middle" fontSize={10.5} fill={t.muted}>
        {sub}
      </text>
    </g>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="The parity balance" sub="Left pan: call minus put. Right pan: stock minus the present value of the strike. Model prices, an illustration." />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
        <div className="grid gap-3">
          <Slider label="SPY price" value={S} min={700} max={840} step={1} onChange={setS} format={(v) => `$${v}`} />
          <Slider label="Strike" value={K} min={700} max={840} step={5} onChange={setK} format={(v) => `${v}`} />
          <Slider label="Interest rate" value={r} min={0} max={10} step={0.1} onChange={setR} format={(v) => `${v.toFixed(1)}%`} />
          <Slider label="Days to expiry" value={days} min={1} max={365} step={1} onChange={setDays} format={(v) => `${v}`} />
          <Slider label="Volatility (both options)" value={vol} min={5} max={60} step={1} onChange={setVol} format={(v) => `${v}%`} />
          <Slider
            label="Mispricing on the call quote"
            value={quote}
            min={-2}
            max={2}
            step={0.05}
            onChange={setQuote}
            format={(v) => (v === 0 ? 'none' : `${v > 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`)}
          />
        </div>
        <div>
          <svg viewBox="0 0 360 250" width="100%" style={{ display: 'block' }} role="img" aria-label="Balance scale comparing call minus put with stock minus present value of strike">
            <path d={`M${cx},${cy} L${cx - 22},228 L${cx + 22},228 Z`} fill={t.grid} />
            <line x1={lx} y1={ly} x2={rx} y2={ry} stroke={t.ink} strokeWidth={4} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={6} fill={t.ink} />
            {pan(lx, ly, 'C − P', left, `${(C + quote).toFixed(2)} − ${P.toFixed(2)}`, t.call)}
            {pan(rx, ry, 'S − PV(K)', right, `${S} − ${pvK.toFixed(2)}`, t.stock)}
          </svg>
          <div
            className="mt-1 rounded-lg border px-3 py-2 text-[0.85rem]"
            style={{ borderColor: Math.abs(diff) < 0.005 ? 'var(--viz-profit)' : 'var(--viz-loss)' }}
          >
            {Math.abs(diff) < 0.005 ? (
              <>
                <b>Balanced.</b> Volatility moved the call to {C.toFixed(2)} and the put to {P.toFixed(2)}, but their difference did not move.
              </>
            ) : (
              <>
                <b>Out of balance by ${Math.abs(diff).toFixed(2)}.</b> {diff > 0 ? 'The call is rich: sell call, buy put, buy stock (a conversion).' : 'The call is cheap: buy call, sell put, sell stock (a reversal).'}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
