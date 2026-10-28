import { useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { pairs, S0, R, T1, STOCK_ASK, STOCK_BID, money, smoney } from './fdata';

type Side = 'conv' | 'rev';
type Px = 'mid' | 'nat';

const KS = pairs('nov').map((p) => p.K);

/** Conversion / reversal on the Nov 27 chain, at mid or after crossing every spread. */
export function conversionPnl(side: Side, K: number, px: Px, rate: number, borrow: number) {
  const p = pairs('nov').find((x) => x.K === K)!;
  const nat = px === 'nat';
  if (side === 'conv') {
    const stock = nat ? STOCK_ASK : S0;
    const call = nat ? p.call.bid : p.call.mark; // sold
    const put = nat ? p.put.ask : p.put.mark; // bought
    const outlay = stock - call + put;
    const interest = -outlay * (Math.exp(rate * T1) - 1);
    const midOutlay = S0 - p.call.mark + p.put.mark;
    return {
      stock, call, put, outlay,
      parts: [
        { label: 'Call sold − put bought', v: call - put },
        { label: 'Strike received − stock paid', v: K - stock },
        { label: 'Interest on cash tied up', v: interest },
      ],
      spread: -(outlay - midOutlay),
      net: K - outlay + interest,
    };
  }
  const stock = nat ? STOCK_BID : S0;
  const call = nat ? p.call.ask : p.call.mark; // bought
  const put = nat ? p.put.bid : p.put.mark; // sold
  const proceeds = stock - call + put;
  const interest = proceeds * (Math.exp((rate - borrow) * T1) - 1);
  const midProceeds = S0 - p.call.mark + p.put.mark;
  return {
    stock, call, put, outlay: -proceeds,
    parts: [
      { label: 'Put sold − call bought', v: put - call },
      { label: 'Stock sold − strike paid', v: stock - K },
      { label: borrow > 0 ? 'Interest earned, net of borrow fee' : 'Interest earned on short proceeds', v: interest },
    ],
    spread: -(midProceeds - proceeds),
    net: proceeds + interest - K,
  };
}

export default function ConversionCalc() {
  const t = useTokens();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const [side, setSide] = useState<Side>('conv');
  const [k, setK] = useState('770');
  const [px, setPx] = useState<Px>('nat');
  const [rate, setRate] = useState(R * 100);
  const [borrow, setBorrow] = useState(0.25);
  const [n, setN] = useState(10);
  const K = +k;
  const res = conversionPnl(side, K, px, rate / 100, borrow / 100);
  const mult = 100 * n;

  // Waterfall bars per share
  const steps: { label: string; v: number; start: number }[] = [];
  let run = 0;
  for (const p of res.parts) {
    steps.push({ label: p.label, v: p.v, start: run });
    run += p.v;
  }
  const all = steps.flatMap((s) => [s.start, s.start + s.v]).concat([0, res.net]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const narrow = width < 520;
  const labelW = narrow ? 0 : 230;
  const rowH = narrow ? 46 : 34;
  const x = scaleLinear()
    .domain([lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.08])
    .range([labelW + 8, width - 64]);
  const rows = [...steps.map((s) => ({ ...s, total: false })), { label: 'Net locked-in P/L', v: res.net, start: 0, total: true }];
  const h = rows.length * rowH + 26;

  return (
    <div className="viz-card not-content">
      <CardHead title="Conversion & reversal calculator" sub="Nov 27 expiry, real bid/ask. SPY quote assumed one cent either side of the 769.66 close." />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-3">
          <div>
            <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Trade</div>
            <Segmented
              label="Trade"
              value={side}
              onChange={setSide}
              options={[
                { value: 'conv', label: 'Conversion' },
                { value: 'rev', label: 'Reversal' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Prices</div>
            <Segmented
              label="Prices"
              value={px}
              onChange={setPx}
              options={[
                { value: 'mid', label: 'At mid' },
                { value: 'nat', label: 'Natural (cross spreads)' },
              ]}
            />
          </div>
        </div>
        <div className="grid gap-3">
          <Slider label="Strike" value={KS.indexOf(K)} min={0} max={KS.length - 1} step={1} onChange={(i) => setK(String(KS[i]))} format={(i) => String(KS[i])} />
          <Slider label="Financing rate" value={rate} min={3} max={6} step={0.05} onChange={setRate} format={(v) => `${v.toFixed(2)}%`} />
          {side === 'rev' ? (
            <Slider label="Stock borrow fee" value={borrow} min={0} max={2} step={0.05} onChange={setBorrow} format={(v) => `${v.toFixed(2)}%`} />
          ) : (
            <Slider label="Size (1 contract = 100 shares)" value={n} min={1} max={50} step={1} onChange={setN} format={(v) => `${v} × 100 sh`} />
          )}
        </div>
      </div>

      <div className="mt-3 text-[0.82rem] text-(--sl-color-gray-2)">
        {side === 'conv' ? (
          <>
            Buy SPY at <b>{res.stock.toFixed(2)}</b>, sell the {K} call at <b>{res.call.toFixed(2)}</b>, buy the {K} put at <b>{res.put.toFixed(2)}</b>.
            At expiry the stock is delivered at {K} whatever happens.
          </>
        ) : (
          <>
            Short SPY at <b>{res.stock.toFixed(2)}</b>, buy the {K} call at <b>{res.call.toFixed(2)}</b>, sell the {K} put at <b>{res.put.toFixed(2)}</b>.
            At expiry the stock is bought back at {K} whatever happens.
          </>
        )}
      </div>

      <div ref={wrap} className="mt-2 w-full">
        <svg width={width} height={h} role="img" aria-label="Breakdown of locked-in profit or loss per share">
          <line x1={x(0)} x2={x(0)} y1={0} y2={h - 18} stroke={t.axis} />
          {rows.map((r, i) => {
            const y0 = i * rowH + (narrow ? 18 : 4);
            const a = x(Math.min(r.start, r.start + r.v));
            const b = x(Math.max(r.start, r.start + r.v));
            const col = r.total ? (r.v >= 0 ? t.profit : t.loss) : r.v >= 0 ? t.call : t.put;
            return (
              <g key={r.label}>
                <text x={narrow ? 0 : labelW} y={narrow ? y0 - 5 : y0 + 13} textAnchor={narrow ? 'start' : 'end'} fontSize={11.5} fontWeight={r.total ? 700 : 400} fill={t['ink-2']}>
                  {r.label}
                </text>
                <rect x={a} y={y0} width={Math.max(b - a, 1.5)} height={20} rx={3} fill={col} fillOpacity={r.total ? 1 : 0.85} />
                <text x={b + 6} y={y0 + 14} fontSize={11.5} fontWeight={600} fill={t.ink}>
                  {smoney(r.v)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <StatGrid
        items={[
          [side === 'conv' ? 'Cash paid today' : 'Cash received today', money(Math.abs(res.outlay)), 'per share'],
          ['Locked-in P/L', smoney(res.net), 'per share, at expiry', res.net >= 0 ? 'var(--viz-profit)' : 'var(--viz-loss)'],
          ['Cost of spreads', px === 'mid' ? '$0.00' : smoney(res.spread), 'versus trading at mid'],
          [side === 'conv' ? `On ${(n * 100).toLocaleString()} shares` : 'Per contract', smoney(res.net * (side === 'conv' ? mult : 100), 0), side === 'conv' ? `${n} contracts` : '100 shares'],
        ]}
      />
    </div>
  );
}
