import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import LinesChart from './LinesChart';
import { pairAt, S0, R, T1, money, smoney } from './fdata';

type Target = 'long-stock' | 'short-stock' | 'long-call' | 'long-put' | 'short-call' | 'short-put';
const STRIKES = [750, 760, 770, 780, 790];

const LABEL: Record<Target, string> = {
  'long-stock': 'Long stock',
  'short-stock': 'Short stock',
  'long-call': 'Long call',
  'long-put': 'Long put',
  'short-call': 'Short call',
  'short-put': 'Short put',
};

/**
 * Overlays the expiry P/L of a real instrument and its synthetic twin built
 * from the other two, priced at snapshot mids. The gap is carry.
 */
export default function SyntheticBuilder() {
  const [target, setTarget] = useState<Target>('long-stock');
  const [k, setK] = useState('770');
  const [carry, setCarry] = useState<'off' | 'on'>('off');
  const K = +k;
  const { call, put } = pairAt('nov', K);
  const C = call.mark;
  const P = put.mark;
  const S = S0;
  const ic = (x: number) => Math.max(x - K, 0);
  const ip = (x: number) => Math.max(K - x, 0);
  // Interest over the 31 days on the cash each version ties up (+ cost, − income).
  const g = Math.exp(R * T1) - 1;

  // real(x), synth(x), recipe, cash outlay of each today (+ paid, − received)
  let real: (x: number) => number;
  let synth: (x: number) => number;
  let recipe: string;
  let realCash: number;
  let synthCash: number;
  switch (target) {
    case 'long-stock':
      real = (x) => x - S;
      synth = (x) => ic(x) - C - (ip(x) - P);
      recipe = `Long ${K} call + short ${K} put`;
      realCash = S;
      synthCash = C - P;
      break;
    case 'short-stock':
      real = (x) => S - x;
      synth = (x) => -(ic(x) - C) + (ip(x) - P);
      recipe = `Short ${K} call + long ${K} put`;
      realCash = -S;
      synthCash = -(C - P);
      break;
    case 'long-call':
      real = (x) => ic(x) - C;
      synth = (x) => x - S + ip(x) - P;
      recipe = `Long stock + long ${K} put`;
      realCash = C;
      synthCash = S + P;
      break;
    case 'short-call':
      real = (x) => C - ic(x);
      synth = (x) => S - x - (ip(x) - P);
      recipe = `Short stock + short ${K} put`;
      realCash = -C;
      synthCash = -(S + P);
      break;
    case 'long-put':
      real = (x) => ip(x) - P;
      synth = (x) => S - x + ic(x) - C;
      recipe = `Short stock + long ${K} call`;
      realCash = P;
      synthCash = C - S;
      break;
    case 'short-put':
      real = (x) => P - ip(x);
      synth = (x) => x - S - (ic(x) - C);
      recipe = `Long stock + short ${K} call`;
      realCash = -P;
      synthCash = S - C;
      break;
  }
  const realCarry = realCash * g;
  const synthCarry = synthCash * g;
  const withCarry = carry === 'on';
  const realF = (x: number) => real(x) - (withCarry ? realCarry : 0);
  const synthF = (x: number) => synth(x) - (withCarry ? synthCarry : 0);
  const gap = synthF(800) - realF(800);

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Build the synthetic, compare with the real thing"
        sub="Expiry P/L per share at Nov 27 mid prices. Any gap is the cost of carrying cash for 31 days."
      />
      <div className="grid gap-3">
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Instrument to replicate</div>
          <Segmented
            label="Instrument"
            value={target}
            onChange={setTarget}
            options={(Object.keys(LABEL) as Target[]).map((v) => ({ value: v, label: LABEL[v] }))}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Strike</div>
            <Segmented label="Strike" value={k} onChange={setK} options={STRIKES.map((s) => ({ value: String(s), label: String(s) }))} />
          </div>
          <div>
            <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Interest on cash tied up</div>
            <Segmented
              label="Carry"
              value={carry}
              onChange={setCarry}
              options={[
                { value: 'off', label: 'Ignore' },
                { value: 'on', label: `Charge ${(R * 100).toFixed(1)}%` },
              ]}
            />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <LinesChart
          ariaLabel="Expiry profit and loss of an instrument and its synthetic equivalent"
          lo={720}
          hi={820}
          marks={[{ x: K, label: `K ${K}` }]}
          series={[
            { label: `${LABEL[target]} (real)`, color: 'ink', fn: realF, width: 3.5 },
            { label: `Synthetic: ${recipe.toLowerCase()}`, color: 'put', fn: synthF, dash: true, width: 2.25 },
          ]}
        />
      </div>
      <StatGrid
        items={[
          ['Recipe', recipe, `call ${money(C)}, put ${money(P)}, SPY ${money(S)}`],
          ['Cash today, real', smoney(realCash), realCash >= 0 ? 'paid' : 'received'],
          ['Cash today, synthetic', smoney(synthCash), synthCash >= 0 ? 'paid' : 'received'],
          [
            'Synthetic minus real',
            smoney(gap),
            withCarry ? 'after interest: rounding and spreads' : `interest on the cash difference ≈ ${money(Math.abs((realCash - synthCash) * g))}`,
            withCarry ? 'var(--viz-profit)' : 'var(--viz-put)',
          ],
        ]}
      />
    </div>
  );
}
