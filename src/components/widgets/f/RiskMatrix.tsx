import { useState } from 'react';
import { CardHead } from '../../ui/Stats';

const RISKS = ['Pin', 'Early assignment', 'Dividend', 'Interest rate', 'Execution / legging', 'Settlement'] as const;
const POS = ['Conversion', 'Reversal', 'Box', 'Jelly roll'] as const;
const SHORT = ['Pin', 'Early', 'Div.', 'Rate', 'Exec.', 'Settle'];
type Lvl = 0 | 1 | 2;

const GRID: Record<(typeof POS)[number], Lvl[]> = {
  // Pin, Early, Div, Rate, Exec, Settle
  Conversion: [2, 1, 2, 1, 1, 0],
  Reversal: [2, 2, 1, 1, 1, 1],
  Box: [2, 2, 0, 1, 1, 1],
  'Jelly roll': [1, 1, 2, 1, 1, 1],
};

const WHY: Record<string, string> = {
  'Conversion|Pin': 'Short call and long put at one strike. If SPY closes on the strike you cannot know whether the call will be assigned.',
  'Conversion|Early assignment': 'Your short call can be assigned early, usually only on the eve of an ex-date. You still have the put; the stock is simply gone early.',
  'Conversion|Dividend': 'You own the stock for the dividend. If the short call is assigned the day before the ex-date, you lose the dividend you priced in.',
  'Conversion|Interest rate': 'You paid cash for the stock. If financing costs rise above the rate implied in the prices, the carry turns against you.',
  'Conversion|Execution / legging': 'Three legs. Trade one and the market moves before the others fill.',
  'Conversion|Settlement': 'Stock settles T+1, options exercise into stock: mostly a cash-management detail for a pure equity conversion.',
  'Reversal|Pin': 'Long call and short put at the same strike. A close on the strike leaves you unsure whether the put will be assigned.',
  'Reversal|Early assignment': 'Short in-the-money puts can be assigned early when interest on the strike outweighs their time value. Your short stock is closed and you carry less cash than planned.',
  'Reversal|Dividend': 'You are short the stock and owe the dividend. A higher dividend than priced in costs you; if your long call needs exercising to avoid paying it, that is a decision to make.',
  'Reversal|Interest rate': 'You earn interest on short-sale proceeds. If rates fall or the borrow fee rises, the locked-in edge shrinks.',
  'Reversal|Execution / legging': 'Three legs, one of them a short sale that needs a located borrow first. Trade one leg and the market moves before the others fill.',
  'Reversal|Settlement': 'Borrow and locate requirements. Hard-to-borrow names make reversals expensive or impossible.',
  'Box|Pin': 'Two strikes, each with a short option. A close near either strike can leave a stock position.',
  'Box|Early assignment': 'American boxes hide an early-exercise option in the in-the-money put. If it is assigned, the box breaks into a stock position plus a vertical.',
  'Box|Dividend': 'The calls in a box can be exercised before an ex-date, same as any call. The size of the box payoff is not affected.',
  'Box|Interest rate': 'A box is a loan. Its value moves with rates exactly like a zero-coupon bond of the same maturity.',
  'Box|Execution / legging': 'Four legs, usually traded as one package. Legging in is where most box losses come from.',
  'Box|Settlement': 'Cash-settled European index boxes (SPX) remove assignment risk; American equity boxes do not.',
  'Jelly roll|Pin': 'Pin risk at the near expiry only, on the short synthetic. The far synthetic stays open.',
  'Jelly roll|Early assignment': 'The deep in-the-money leg of either synthetic can be assigned early, leaving a stock position against the other expiry.',
  'Jelly roll|Dividend': 'The key risk: a dividend that goes ex between the two expiries is priced into the roll. A changed or mistimed dividend moves its value directly.',
  'Jelly roll|Interest rate': 'It is a forward-starting loan between the two expiries: sensitive to forward rates.',
  'Jelly roll|Execution / legging': 'Four legs across two expiries; the spreads in the far month are wider.',
  'Jelly roll|Settlement': 'Exercise at the first expiry creates stock that must be financed or delivered until the second.',
};

/** Clickable map: which risks hit which arbitrage positions, and how hard. */
export default function RiskMatrix() {
  const [cell, setCell] = useState<[number, number]>([0, 2]);
  const lvlColor = ['var(--viz-grid)', 'var(--viz-band-1)', 'var(--viz-loss-wash)'];
  const lvlBorder = ['var(--viz-grid)', 'var(--viz-call)', 'var(--viz-loss)'];
  const lvlText = ['Low', 'Moderate', 'High'];
  const [pi, ri] = cell;
  return (
    <div className="viz-card not-content">
      <CardHead title="Where the riskless trades leak" sub="Click a cell. Severity is a desk rule of thumb for SPY-style American options." />
      <div>
        <table className="w-full border-separate border-spacing-0.5 text-[0.72rem] sm:border-spacing-1 sm:text-[0.78rem]">
          <thead>
            <tr>
              <th />
              {RISKS.map((r, j) => (
                <th key={r} className="px-0.5 py-1 text-center font-medium text-(--sl-color-gray-3)">
                  <span className="sm:hidden">{SHORT[j]}</span>
                  <span className="hidden sm:inline">{r}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POS.map((p, i) => (
              <tr key={p}>
                <th className="pr-1 text-left font-semibold leading-tight sm:whitespace-nowrap sm:pr-2">{p}</th>
                {GRID[p].map((l, j) => {
                  const on = i === pi && j === ri;
                  return (
                    <td key={j} className="p-0">
                      <button
                        type="button"
                        onClick={() => setCell([i, j])}
                        className="h-9 w-full cursor-pointer rounded-md text-[0.75rem] font-medium text-(--sl-color-white)"
                        style={{ background: lvlColor[l], border: `${on ? 2.5 : 1}px solid ${on ? 'var(--sl-color-white)' : lvlBorder[l]}` }}
                        aria-label={`${p}, ${RISKS[j]}: ${lvlText[l]}`}
                      >
                        <span className="sm:hidden">{['Low', 'Med', 'High'][l]}</span>
                        <span className="hidden sm:inline">{lvlText[l]}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 rounded-lg border border-(--sl-color-hairline) px-3 py-2 text-[0.85rem]">
        <div className="text-[0.72rem] uppercase tracking-wide text-(--sl-color-gray-3)">
          {POS[pi]} · {RISKS[ri]} · {lvlText[GRID[POS[pi]][ri]]}
        </div>
        <div>{WHY[`${POS[pi]}|${RISKS[ri]}`]}</div>
      </div>
    </div>
  );
}
