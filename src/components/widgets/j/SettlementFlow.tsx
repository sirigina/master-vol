import { useState } from 'react';
import { Slider } from '../../ui/Slider';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';

const RATIO = snapshot.index.SPX / snapshot.spot;
const K_SPY = 770;
const K_SPX = 7725;

type Right = 'call' | 'put';

interface Step {
  when: string;
  title: string;
  body: string;
  tone?: 'good' | 'bad' | 'neutral';
}

/** J1: expiration settlement flow for a physically settled SPY option vs a cash-settled SPX option. */
export default function SettlementFlow() {
  const t = useTokens();
  const [right, setRight] = useState<Right>('call');
  const [move, setMove] = useState(1.0); // % move from snapshot to final settlement
  const [gap, setGap] = useState(-1.5); // % move over the weekend after expiry

  const spyFinal = snapshot.spot * (1 + move / 100);
  const spxFinal = spyFinal * RATIO;
  const spyMon = spyFinal * (1 + gap / 100);

  const itmSpy = right === 'call' ? spyFinal - K_SPY : K_SPY - spyFinal;
  const itmSpx = right === 'call' ? spxFinal - K_SPX : K_SPX - spxFinal;
  const exercised = itmSpy >= 0.01;
  const cash = Math.max(itmSpx, 0) * 100;
  const sharesDir = right === 'call' ? 'buy' : 'sell';
  const posAfter = right === 'call' ? 100 : -100;
  const weekendPnl = exercised ? posAfter * (spyMon - spyFinal) : 0;
  const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;

  const physical: Step[] = [
    { when: 'Expiry Friday, 4:00 pm', title: `SPY closes at ${spyFinal.toFixed(2)}`, body: `Your long ${K_SPY} ${right} is ${itmSpy >= 0 ? `${itmSpy.toFixed(2)} in the money` : `${(-itmSpy).toFixed(2)} out of the money`}.` },
    {
      when: 'Friday evening (OCC)',
      title: exercised ? 'Automatic exercise' : 'Expires worthless',
      body: exercised ? 'Options $0.01 or more in the money are exercised unless you instruct otherwise.' : 'Nothing is delivered; the premium is gone.',
      tone: exercised ? 'neutral' : 'bad',
    },
    {
      when: 'Next business day',
      title: exercised ? `You ${sharesDir} 100 SPY at ${K_SPY}` : 'No position',
      body: exercised ? `${right === 'call' ? 'Pay' : 'Receive'} ${usd(K_SPY * 100)} cash. You now hold ${posAfter > 0 ? 'long' : 'short'} 100 shares.` : '—',
    },
    {
      when: 'Monday open',
      title: exercised ? `SPY opens ${spyMon.toFixed(2)}` : 'No exposure',
      body: exercised ? `Weekend gap on the delivered shares: ${usd(weekendPnl)}. The option's capped risk became stock risk.` : 'Nothing at risk over the weekend.',
      tone: exercised ? (weekendPnl >= 0 ? 'good' : 'bad') : 'neutral',
    },
  ];

  const cashSteps: Step[] = [
    { when: 'Thursday close', title: 'Last trade (AM-settled SPX)', body: 'Standard monthly SPX stops trading the day before; SPXW PM-settled weeklies trade until Friday 4:00 pm.' },
    { when: 'Friday open', title: `Settlement value ${spxFinal.toFixed(2)}`, body: `Computed from each component's opening print (SOQ). Your ${K_SPX} ${right} is ${itmSpx >= 0 ? `${itmSpx.toFixed(2)} in the money` : 'out of the money'}.` },
    {
      when: 'Next business day',
      title: cash > 0 ? `Cash credited: ${usd(cash)}` : 'Expires worthless',
      body: cash > 0 ? `(${spxFinal.toFixed(2)} − ${K_SPX}) × $100${right === 'put' ? ' with the sign flipped for a put' : ''}. No shares change hands.` : 'No cash, no position.',
      tone: cash > 0 ? 'good' : 'bad',
    },
    { when: 'Monday open', title: 'No exposure', body: 'Nothing left to gap. The risk ended at the settlement print.', tone: 'neutral' },
  ];

  const toneColor = (tone?: Step['tone']) => (tone === 'good' ? t.profit : tone === 'bad' ? t.loss : t.axis);

  const Lane = ({ title, color, steps }: { title: string; color: string; steps: Step[] }) => (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2 text-[0.88rem] font-semibold">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
        {title}
      </div>
      <ol className="m-0 list-none p-0">
        {steps.map((s, i) => (
          <li key={i} className="relative pb-3 pl-5">
            {i < steps.length - 1 && <span className="absolute top-3 bottom-0 left-[5px] w-[2px]" style={{ background: color, opacity: 0.4 }} />}
            <span className="absolute top-1.5 left-0 h-3 w-3 rounded-full border-2" style={{ borderColor: color, background: t.surface }} />
            <div className="rounded-md border px-2.5 py-1.5" style={{ borderColor: toneColor(s.tone) }}>
              <div className="text-[0.7rem] uppercase tracking-wide text-(--sl-color-gray-3)">{s.when}</div>
              <div className="text-[0.86rem] font-semibold tabular-nums">{s.title}</div>
              <div className="text-[0.78rem] text-(--sl-color-gray-2) tabular-nums">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <div className="viz-card not-content">
      <CardHead title="What happens at expiration: physical vs cash settlement" sub={`Illustration from the snapshot: long one SPY ${K_SPY} or one SPX ${K_SPX} option (about the same strike, scaled by ${RATIO.toFixed(2)})`} />
      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <div className="min-w-0">
          <div className="mb-1 text-[0.78rem] text-(--sl-color-gray-3)">Option held</div>
          <Segmented
            label="Call or put"
            value={right}
            onChange={setRight}
            options={[
              { value: 'call', label: 'Long call' },
              { value: 'put', label: 'Long put' },
            ]}
          />
        </div>
        <Slider label="Index move to settlement" value={move} min={-5} max={5} step={0.1} onChange={setMove} format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`} />
        <Slider label="Weekend gap after expiry" value={gap} min={-5} max={5} step={0.1} onChange={setGap} format={(v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`} />
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <Lane title={`Physical: SPY ${K_SPY} ${right}`} color={t.call} steps={physical} />
        <Lane title={`Cash: SPX ${K_SPX} ${right} (AM-settled)`} color={t.put} steps={cashSteps} />
      </div>
    </div>
  );
}
