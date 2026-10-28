import { useState } from 'react';
import { Segmented } from '../../ui/Segmented';
import { Slider } from '../../ui/Slider';
import { CardHead } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { pnlAt, greeksAt, shifted, STRANGLE, CREDIT } from './G9_adjust';
import { money, usd, num } from './G6_helpers';

interface Node {
  q: string;
  detail: string;
  yes: boolean;
  /** action when the answer is yes (stop) */
  action: string;
}

/** Exit decision flow for the short strangle, evaluated live from a market scenario. */
export default function ExitFlow() {
  const t = useTokens();
  const [S, setS] = useState(792);
  const [day, setDay] = useState(12);
  const [iv, setIv] = useState(0);
  const [thesis, setThesis] = useState<'yes' | 'no'>('yes');
  const legs = shifted(STRANGLE, iv / 100);
  const el = day / 365;
  const pnl = pnlAt(legs, S, el);
  const g = greeksAt(legs, S, el);
  const left = 31 - day;
  const pct = pnl / CREDIT;

  const nodes: Node[] = [
    { q: 'Profit target: captured 50% of the credit?', detail: `P/L ${money(pnl * 100)} = ${num(pct * 100, 0)}% of ${usd(CREDIT * 100)}`, yes: pct >= 0.5, action: 'Close. The remaining premium is small next to the gamma risk you keep.' },
    { q: 'Loss limit: lost 2× the credit?', detail: `limit ${money(-2 * CREDIT * 100)}`, yes: pnl <= -2 * CREDIT, action: 'Close or cut size now. The limit was set before the trade so this is not a new decision.' },
    { q: 'Time stop: 7 days or fewer left?', detail: `${left} days left, gamma ${num(g.gamma * 100)} per $1`, yes: left <= 7, action: 'Close. Gamma near expiry makes small moves expensive for little remaining theta.' },
    { q: 'Thesis broken: is implied no longer rich versus your forecast?', detail: 'your call: the toggle above', yes: thesis === 'no', action: 'Close. The reason for the trade is gone; adjusting would be a new trade.' },
    { q: 'Delta drift: |delta| above 30 shares per strangle?', detail: `delta ${num(g.delta * 100, 0)} shares`, yes: Math.abs(g.delta) > 0.3, action: 'Adjust: roll the tested side, buy wings, or hedge delta (simulator above). Compare the cost of each.' },
  ];
  const stop = nodes.findIndex((n) => n.yes);

  return (
    <div className="viz-card not-content">
      <CardHead title="Exit rules for the short 750/790 strangle" sub="A pre-committed checklist, checked in order. Move the market and see which rule fires first." />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Slider label="SPY price" value={S} min={720} max={820} step={1} onChange={setS} format={(v) => v.toFixed(0)} />
        <Slider label="Days since entry" value={day} min={0} max={30} step={1} onChange={setDay} format={(v) => `${v} (${31 - v} left)`} />
        <Slider label="IV change" value={iv} min={-4} max={10} step={1} onChange={setIv} format={(v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} pts`} />
        <div>
          <div className="mb-1.5 text-[0.8rem] text-(--sl-color-gray-3)">Implied still rich vs your forecast?</div>
          <Segmented label="Thesis intact" value={thesis} onChange={setThesis} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
        </div>
      </div>
      <ol className="m-0 list-none p-0">
        {nodes.map((n, i) => {
          const reached = stop === -1 || i <= stop;
          const fired = i === stop;
          return (
            <li key={n.q} className="relative pb-3 pl-8" style={{ opacity: reached ? 1 : 0.4 }}>
              {i < nodes.length - 1 && (
                <span className="absolute top-6 left-[11px] w-0.5" style={{ bottom: 0, background: reached && !fired ? t.axis : 'transparent' }} />
              )}
              <span
                className="absolute top-0.5 left-0 flex h-6 w-6 items-center justify-center rounded-full text-[0.75rem] font-semibold"
                style={{ background: fired ? t.loss : reached ? t.call : t.grid, color: fired || reached ? t.surface : t.muted }}
              >
                {i + 1}
              </span>
              <div className="text-[0.88rem] font-medium text-(--sl-color-white)">{n.q}</div>
              <div className="text-[0.78rem] text-(--sl-color-gray-3)">
                {n.detail} · <b style={{ color: n.yes ? t.loss : t.profit }}>{n.yes ? 'Yes' : 'No'}</b>
                {reached && !fired && !n.yes && i < nodes.length - 1 ? ', continue' : ''}
              </div>
              {fired && (
                <div className="mt-1.5 rounded-md border px-2.5 py-1.5 text-[0.82rem]" style={{ borderColor: t.loss }}>
                  {n.action}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {stop === -1 && (
        <div className="ml-8 rounded-md border px-2.5 py-1.5 text-[0.82rem]" style={{ borderColor: t.profit }}>
          Hold. No rule fires: keep collecting theta ({money(g.theta * 100, 2)} a day) and check again tomorrow.
        </div>
      )}
      <p className="mt-3 text-[0.78rem] text-(--sl-color-gray-3)">
        Thresholds (50%, 2×, 7 days, 30 shares) are common desk conventions used for illustration, not optimal values. Per contract, model values on the snapshot IVs.
      </p>
    </div>
  );
}
