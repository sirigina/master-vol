import { useMemo, useState } from 'react';
import LineChart, { money0, moneySigned, kfmtSigned } from './LineChart';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend, StatGrid } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { positionPnlAtExpiry, type Leg } from '../../../lib/pricing';
import { S0, DTE, EXP_LABEL, quote, strikes, type Expiry } from './hedge';

type Kind = 'put' | 'collar' | 'covered';

const PUTS: Record<Expiry, number[]> = {
  nov: strikes('nov', 'put').filter((k) => k <= 770 && k >= 700),
  dec: strikes('dec', 'put').filter((k) => k <= 770),
};
const CALLS: Record<Expiry, number[]> = {
  nov: strikes('nov', 'call').filter((k) => k >= 775 && k <= 820),
  dec: strikes('dec', 'call').filter((k) => k >= 790),
};

const LO = 680;
const HI = 860;

/** I1: protective put / collar / covered call on 100 SPY shares vs the unhedged stock. */
export default function HedgeBuilder() {
  const t = useTokens();
  const [exp, setExp] = useState<Expiry>('nov');
  const [kind, setKind] = useState<Kind>('collar');
  const [pk, setPk] = useState(740);
  const [ck, setCk] = useState(790);

  const putK = PUTS[exp].includes(pk) ? pk : PUTS[exp][PUTS[exp].length - 2];
  const callK = CALLS[exp].includes(ck) ? ck : CALLS[exp][0];
  const put = quote(exp, 'put', putK)!;
  const call = quote(exp, 'call', callK)!;

  const legs: Leg[] = useMemo(() => {
    const out: Leg[] = [{ kind: 'stock', qty: 1, entry: S0 }];
    if (kind !== 'covered') out.push({ kind: 'option', right: 'put', K: putK, qty: 1, premium: put.mark });
    if (kind !== 'put') out.push({ kind: 'option', right: 'call', K: callK, qty: -1, premium: call.mark });
    return out;
  }, [kind, putK, callK, exp]);

  const xs = Array.from({ length: 181 }, (_, i) => LO + i);
  const hedged = xs.map((s) => ({ x: s, y: positionPnlAtExpiry(legs, s) * 100 }));
  const naked = xs.map((s) => ({ x: s, y: (s - S0) * 100 }));

  const net = ((kind !== 'covered' ? put.mark : 0) - (kind !== 'put' ? call.mark : 0)) * 100;
  const floor = kind === 'covered' ? null : positionPnlAtExpiry(legs, 0) * 100;
  const cap = kind === 'put' ? null : positionPnlAtExpiry(legs, 5000) * 100;
  const be = S0 + net / 100;
  const dte = DTE[exp];

  // Zero-cost hint: call whose premium best offsets the chosen put.
  const best = CALLS[exp]
    .map((k) => ({ k, d: quote(exp, 'call', k)!.mark - put.mark }))
    .reduce((a, b) => (Math.abs(b.d) < Math.abs(a.d) ? b : a));

  const kindOpts = [
    { value: 'put', label: 'Protective put' },
    { value: 'collar', label: 'Collar' },
    { value: 'covered', label: 'Covered call' },
  ] as { value: Kind; label: string }[];

  return (
    <div className="viz-card not-content">
      <CardHead title="Hedge builder: 100 SPY shares bought at 769.66" sub="Profit or loss at expiration, hedged vs unhedged. Option prices are snapshot mid-marks." />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Structure</div>
          <Segmented label="Structure" value={kind} onChange={setKind} options={kindOpts} />
        </div>
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Expiry</div>
          <Segmented
            label="Expiry"
            value={exp}
            onChange={setExp}
            options={[
              { value: 'nov', label: `Nov 27 (${DTE.nov}d)` },
              { value: 'dec', label: `Dec 18 (${DTE.dec}d)` },
            ]}
          />
        </div>
        {kind !== 'covered' && (
          <div className="min-w-0">
            <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Buy put, strike</div>
            <Segmented label="Put strike" value={String(putK)} onChange={(v) => setPk(+v)} options={PUTS[exp].map((k) => ({ value: String(k), label: String(k) }))} />
          </div>
        )}
        {kind !== 'put' && (
          <div className="min-w-0">
            <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Sell call, strike</div>
            <Segmented label="Call strike" value={String(callK)} onChange={(v) => setCk(+v)} options={CALLS[exp].map((k) => ({ value: String(k), label: String(k) }))} />
          </div>
        )}
      </div>

      <div className="mt-4">
        <LineChart
          ariaLabel="Expiration profit and loss of 100 SPY shares, hedged and unhedged"
          height={300}
          series={[
            { key: 'naked', label: 'Unhedged stock', color: t.stock, points: naked, dash: true },
            { key: 'hedged', label: 'Hedged', color: t.ink, points: hedged, width: 2.5 },
          ]}
          pnlShadeKey="hedged"
          xLabel={`SPY at ${EXP_LABEL[exp]} expiration`}
          yLabel="P/L, 100 shares"
          yFmt={kfmtSigned}
          tipFmt={moneySigned}
          tipTitle={(v) => `SPY at ${v.toFixed(0)}`}
          xDomain={[LO, HI]}
          vlines={[{ x: S0, label: 'today' }]}
        />
      </div>
      <Legend
        items={[
          { label: 'Hedged position', color: t.ink },
          { label: 'Unhedged 100 shares', color: t.stock, kind: 'dash' },
        ]}
      />
      <StatGrid
        items={[
          [
            'Net cost of hedge',
            net > 0.5 ? `Pay ${money0(net)}` : net < -0.5 ? `Collect ${money0(-net)}` : 'Zero cost',
            [kind !== 'covered' ? `put ${put.mark.toFixed(2)}` : '', kind !== 'put' ? `call ${call.mark.toFixed(2)}` : ''].filter(Boolean).join(' − '),
          ],
          ['Worst case', floor === null ? 'Unlimited to 0' : moneySigned(floor), floor === null ? 'shares can fall to zero' : `below ${putK}`, t.loss],
          ['Best case', cap === null ? 'Unlimited' : moneySigned(cap), cap === null ? 'less the premium' : `above ${callK}`, t.profit],
          ['Breakeven', be.toFixed(2), `stock alone: ${S0.toFixed(2)}`],
        ]}
      />
      <p className="mt-3 text-[0.8rem] text-(--sl-color-gray-3)">
        {kind === 'put' &&
          `Insurance for ${dte} days costs ${((put.mark / S0) * 100).toFixed(2)}% of the stock value, about ${((put.mark / S0) * (365 / dte) * 100).toFixed(1)}% a year if you kept renewing it at this price.`}
        {kind === 'collar' &&
          (Math.abs(best.d) < 0.005
            ? `The ${best.k} call exactly pays for the ${putK} put: a zero-cost collar.`
            : `Closest to zero cost with the ${putK} put: the ${best.k} call (net ${best.d > 0 ? 'credit' : 'debit'} ${Math.abs(best.d).toFixed(2)} per share).`)}
        {kind === 'covered' && `The call premium cushions only the first ${call.mark.toFixed(2)} of a fall. Below ${(S0 - call.mark).toFixed(2)} you lose dollar for dollar.`}
      </p>
    </div>
  );
}
