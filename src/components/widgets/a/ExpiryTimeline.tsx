import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';

type Who = 'long' | 'short';

const EVENTS: { time: string; day: string; title: string; all: string; long: string; short: string }[] = [
  {
    time: '9:30 a.m.',
    day: 'Fri',
    title: 'Last trading day opens',
    all: 'Expiring contracts trade normally. Their price is now almost pure intrinsic value plus whatever chance remains of crossing the strike today.',
    long: 'You can still sell the option instead of exercising it. Selling captures any time value left; exercising throws it away.',
    short: 'You can buy the option back to remove assignment risk. Close to the strike, this is often the cheapest insurance you will ever buy.',
  },
  {
    time: '≈3:30 p.m.',
    day: 'Fri',
    title: 'Broker risk desks act',
    all: 'Many retail brokers stop new opening trades in expiring contracts and may start closing positions they think the account cannot carry through exercise or assignment. Times vary by broker.',
    long: 'If your account cannot pay for the shares a call would deliver, the broker may sell the option for you.',
    short: 'If assignment would create a position your account cannot margin, expect a liquidation call or a forced buy-back.',
  },
  {
    time: '4:00 p.m.',
    day: 'Fri',
    title: 'SPY closing price is set',
    all: 'The official closing price sets the default: an option in the money by $0.01 or more will be exercised automatically by the OCC (exercise by exception). SPY options may trade a few minutes longer under the late-close rules, but the price that decides the default is fixed.',
    long: 'Your option is now either auto-exercise or expire-worthless by default. Once the expiring series stops trading you can no longer sell it.',
    short: 'Once the expiring series stops trading you cannot buy it back. Whether you are assigned is then out of your hands.',
  },
  {
    time: '5:30 p.m.',
    day: 'Fri',
    title: 'Exercise decision cut-off',
    all: 'Holders have until 5:30 p.m. ET to override the default with a contrary exercise instruction (brokers often set an earlier internal cut-off). After-hours news can change the decision.',
    long: 'You may exercise an option that closed slightly out of the money, or decline to exercise one that closed slightly in the money.',
    short: 'Holders on the other side are making that choice now. You will not know the result until the OCC reports it.',
  },
  {
    time: 'Evening',
    day: 'Fri',
    title: 'OCC processes exercises',
    all: 'The OCC matches every exercise against open short positions at clearing firms, which in turn allocate assignments to customer accounts, randomly or first-in-first-out.',
    long: 'Your exercise is matched with a short somewhere in the market.',
    short: 'You may get assigned on all, some, or none of your in-the-money shorts.',
  },
  {
    time: 'Before open',
    day: 'Mon',
    title: 'Positions appear, T+1 settlement',
    all: 'Assignment notices and resulting stock positions show up in accounts. Exercise trades settle one business day later, like any stock trade.',
    long: 'Long call: you now own the shares and paid the strike. Long put: you sold shares at the strike (or are now short them).',
    short: 'Short call: you sold shares at the strike (short them if you had none). Short put: you bought shares at the strike. Monday\'s open sets your first P/L on them.',
  },
];

/** Expiration day, step by step, with what each side should know at each step. */
export default function ExpiryTimeline() {
  const [i, setI] = useState(2);
  const [who, setWho] = useState<Who>('long');
  const e = EVENTS[i];

  return (
    <div className="viz-card not-content">
      <CardHead
        title="Expiration day, step by step"
        sub="A regular Friday expiry for SPY options. Tap a step. Times are US Eastern."
        right={
          <Segmented
            label="Your side"
            value={who}
            onChange={setWho}
            options={[
              { value: 'long', label: 'I am long' },
              { value: 'short', label: 'I am short' },
            ]}
          />
        }
      />
      <ol className="relative m-0 grid list-none grid-cols-1 gap-1 p-0 sm:grid-cols-6 sm:gap-0">
        <span aria-hidden="true" className="absolute top-[0.6rem] right-[8%] left-[8%] hidden h-0.5 sm:block" style={{ background: 'var(--sl-color-gray-5)' }} />
        <span aria-hidden="true" className="absolute top-2 bottom-2 left-[0.55rem] w-0.5 sm:hidden" style={{ background: 'var(--sl-color-gray-5)' }} />
        {EVENTS.map((ev, j) => {
          const on = j === i;
          return (
            <li key={ev.title} className="relative m-0 p-0">
              <button
                type="button"
                onClick={() => setI(j)}
                aria-pressed={on}
                className="flex w-full cursor-pointer items-start gap-3 border-0 bg-transparent p-0 text-left sm:flex-col sm:items-center sm:gap-1.5 sm:text-center"
              >
                <span
                  className="relative z-[1] mt-0.5 inline-block h-[1.1rem] w-[1.1rem] flex-none rounded-full border-2 sm:mt-0"
                  style={{
                    borderColor: on ? 'var(--sl-color-accent)' : 'var(--sl-color-gray-4)',
                    background: on ? 'var(--sl-color-accent)' : 'var(--sl-color-bg)',
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">
                    {ev.day} · {ev.time}
                  </span>
                  <span className={`block text-[0.82rem] leading-snug ${on ? 'font-semibold text-(--sl-color-white)' : 'text-(--sl-color-gray-2)'}`}>
                    {ev.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 rounded-lg border border-(--sl-color-hairline) px-3 py-2.5">
        <div className="text-[0.9rem] font-semibold text-(--sl-color-white)">{e.title}</div>
        <p className="mt-1 mb-0 text-[0.84rem] text-(--sl-color-gray-2)">{e.all}</p>
        <p className="mt-2 mb-0 text-[0.84rem]" style={{ color: 'var(--sl-color-white)' }}>
          <b style={{ color: who === 'long' ? 'var(--viz-call)' : 'var(--viz-put)' }}>{who === 'long' ? 'If you are long: ' : 'If you are short: '}</b>
          {who === 'long' ? e.long : e.short}
        </p>
      </div>
    </div>
  );
}
