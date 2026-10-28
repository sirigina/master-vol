import { useMemo, useRef, useState } from 'react';
import { scaleLinear, line } from 'd3';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { rng } from '../../../lib/position';
import { Tile, Btn, usd, fmtSigned, YAxis, XAxis } from './kit';

type Game = 'die' | 'call';

const FACES = [1, 2, 3, 4, 5, 6];

/**
 * Expected value of a simple game, then a "call option on a die".
 * The reader sets the price to play and watches the average result of many
 * plays converge to the edge (expected value minus price).
 */
export default function DiceGame() {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 640);
  const t = useTokens();
  const [game, setGame] = useState<Game>('call');
  const [strike, setStrike] = useState(3);
  const [price, setPrice] = useState(12);
  const [plays, setPlays] = useState(200);
  const [seed, setSeed] = useState(7);

  const payoff = (face: number) => (game === 'die' ? face * 10 : Math.max(face - strike, 0) * 10);
  const ev = FACES.reduce((a, f) => a + payoff(f) / 6, 0);
  const edge = ev - price;

  const sim = useMemo(() => {
    const u = rng(seed);
    const out: { n: number; avg: number }[] = [];
    let tot = 0;
    for (let i = 1; i <= plays; i++) {
      const face = 1 + Math.floor(u() * 6);
      tot += payoff(face) - price;
      out.push({ n: i, avg: tot / i });
    }
    return { out, total: tot };
  }, [seed, plays, game, strike, price]);

  const h = 230;
  const m = { top: 22, right: 14, bottom: 38, left: 46 };
  const iw = Math.max(width - m.left - m.right, 50);
  const ih = h - m.top - m.bottom;
  const x = scaleLinear().domain([1, plays]).range([0, iw]);
  const ext = Math.max(25, ...sim.out.slice(5).map((d) => Math.abs(d.avg)));
  const y = scaleLinear().domain([-ext, ext]).nice().range([ih, 0]);
  const path = line<{ n: number; avg: number }>().x((d) => x(d.n)).y((d) => y(d.avg))(sim.out) ?? '';

  return (
    <div className="viz-card not-content">
      <CardHead
        title="What is a game worth?"
        sub="Illustration with a fair six-sided die. Set the price to play, then watch the average result of many plays."
        right={
          <Segmented
            label="Game"
            value={game}
            onChange={setGame}
            options={[
              { value: 'die', label: '$10 per pip' },
              { value: 'call', label: 'Call on a die' },
            ]}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-(--sl-color-hairline) p-3">
            <div className="mb-2 text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">Payoff by roll</div>
            <div className="grid grid-cols-6 gap-1 text-center text-[0.8rem] tabular-nums">
              {FACES.map((f) => (
                <div key={f} className="rounded-md bg-(--sl-color-gray-6) px-0.5 py-1">
                  <div className="text-(--sl-color-gray-3)">{f}</div>
                  <div className="font-semibold text-(--sl-color-white)">${payoff(f)}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[0.75rem] text-(--sl-color-gray-3)">
              {game === 'die' ? 'You collect $10 times the number rolled.' : `You collect $10 for every pip above the strike of ${strike}, else nothing.`}
            </div>
          </div>
          {game === 'call' && <Slider label="Strike (pips)" value={strike} min={0} max={5} step={1} onChange={setStrike} format={(v) => `${v}`} />}
          <Slider label="Price to play" value={price} min={0} max={50} step={0.5} onChange={setPrice} format={(v) => usd(v)} />
          <Slider label="Number of plays" value={plays} min={20} max={2000} step={20} onChange={setPlays} format={(v) => `${v}`} />
          <Btn onClick={() => setSeed((s) => s + 1)}>Roll a new batch</Btn>
        </div>

        <div ref={wrap} className="min-w-0">
          <svg width={width} height={h} role="img" aria-label="Average profit per play as the number of plays grows" style={{ display: 'block' }}>
            <g transform={`translate(${m.left},${m.top})`}>
              <YAxis y={y} width={iw} t={t} ticks={5} format={(v) => `${v < 0 ? '−' : ''}$${Math.abs(v)}`} label="Average P/L per play" />
              <XAxis x={x} height={ih} width={iw} t={t} ticks={width < 420 ? 3 : 6} label="plays" />
              <line x2={iw} y1={y(0)} y2={y(0)} stroke={t.axis} />
              <line x2={iw} y1={y(edge)} y2={y(edge)} stroke={t.put} strokeWidth={2} strokeDasharray="6 4" />
              <path d={path} fill="none" stroke={t.call} strokeWidth={1.8} />
            </g>
          </svg>
          <Legend
            items={[
              { label: 'Running average of your results', color: t.call },
              { label: 'Expected value minus price (your edge)', color: t.put, kind: 'dash' },
            ]}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Expected value" value={usd(ev)} sub="average payoff, ⅙ per face" accent={t.aqua} />
        <Tile label="Price to play" value={usd(price)} />
        <Tile label="Edge per play" value={fmtSigned(edge)} sub={edge > 0 ? 'buyer has the edge' : edge < 0 ? 'seller has the edge' : 'fair game'} accent={t.put} />
        <Tile label={`Actual after ${plays}`} value={`${fmtSigned(sim.total, 0)}`} sub={`expected ${fmtSigned(edge * plays, 0)}`} />
      </div>
    </div>
  );
}
