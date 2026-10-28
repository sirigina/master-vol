import { useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3';
import { Segmented } from '../../ui/Segmented';
import { CardHead, StatGrid } from '../../ui/Stats';
import { useTokens, useWidth } from '../../../lib/useViz';
import { BOOKS, S0, EXP_LABEL, bookGreeks, bookCost, legGreeks, legLabel, quote, strikesFor, sgn0, sgnN, type BookLeg, type Exp, type DollarGreeks } from './hlib';
import type { Right } from '../../../lib/pricing';

type GKey = keyof DollarGreeks;
const GREEKS: { key: GKey; label: string; unit: string; fmt: (v: number) => string }[] = [
  { key: 'delta', label: 'Delta', unit: 'shares', fmt: (v) => `${sgnN(v, 1)} sh` },
  { key: 'gamma', label: 'Gamma', unit: 'shares per $1', fmt: (v) => `${sgnN(v, 2)} sh` },
  { key: 'theta', label: 'Theta', unit: '$ per day', fmt: (v) => sgn0(v) },
  { key: 'vega', label: 'Vega', unit: '$ per vol point', fmt: (v) => sgn0(v) },
  { key: 'rho', label: 'Rho', unit: '$ per rate point', fmt: (v) => sgn0(v) },
];

type Row = { kind: 'option'; exp: Exp; right: Right; K: number; qty: number } | { kind: 'stock'; qty: number };

const sel =
  'rounded-md border border-(--sl-color-hairline-shade) bg-(--sl-color-bg) px-1.5 py-1 text-[0.8rem] text-(--sl-color-white) max-w-full';

/** H2: position Greek dashboard over the real Nov 27 and Dec 18 chains plus stock. */
export default function PositionGreeks() {
  const t = useTokens();
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap, 600);
  const [preset, setPreset] = useState('ironCondor');
  const [rows, setRows] = useState<Row[]>(BOOKS.ironCondor.legs as Row[]);
  const [gk, setGk] = useState<GKey>('vega');

  const legs = rows as BookLeg[];
  const g = useMemo(() => bookGreeks(legs), [rows]);
  const per = useMemo(() => legs.map((l) => legGreeks(l)), [rows]);
  const cost = bookCost(legs);
  const dollarGamma1 = 0.5 * g.gamma * (S0 * 0.01) ** 2;

  function load(k: string) {
    setPreset(k);
    setRows(BOOKS[k].legs as Row[]);
  }
  function update(i: number, patch: Partial<Row> | Row) {
    setPreset('custom');
    setRows((rs) => rs.map((r, j) => (j === i ? ({ ...r, ...patch } as Row) : r)));
  }
  function setKind(i: number, kind: string) {
    const r = rows[i];
    const qty = r.qty;
    if (kind === 'stock') return update(i, { kind: 'stock', qty: Math.sign(qty || 1) * 100 });
    const [exp, right] = kind.split('-') as [Exp, Right];
    const ks = strikesFor(exp, right);
    const prevK = r.kind === 'option' ? r.K : 770;
    const K = ks.reduce((b, k) => (Math.abs(k - prevK) < Math.abs(b - prevK) ? k : b), ks[0]);
    update(i, { kind: 'option', exp, right, K, qty: r.kind === 'stock' ? Math.sign(qty) : qty });
  }
  function add() {
    setPreset('custom');
    setRows((rs) => (rs.length >= 6 ? rs : [...rs, { kind: 'option', exp: 'nov', right: 'call', K: 780, qty: 1 }]));
  }
  function remove(i: number) {
    setPreset('custom');
    setRows((rs) => rs.filter((_, j) => j !== i));
  }

  const G = GREEKS.find((x) => x.key === gk)!;
  const vals = per.map((p) => p[gk]);
  const maxAbs = Math.max(1e-9, ...vals.map(Math.abs), Math.abs(g[gk]));
  const labelW = width < 480 ? 116 : 170;
  const valW = 74;
  const barW = Math.max(width - labelW - valW, 60);
  const x = scaleLinear().domain([-maxAbs, maxAbs]).range([0, barW]);
  const rowH = 26;
  const barRows = [...legs.map((l, i) => ({ label: legLabel(l), v: vals[i], total: false })), { label: 'Total', v: g[gk], total: true }];
  const h = barRows.length * rowH + 8;

  return (
    <div className="viz-card not-content">
      <CardHead title="Position Greek dashboard" sub="Real Nov 27 and Dec 18 SPY options plus stock. Greeks in dollars and shares for the whole position (options × 100)." />
      <Segmented
        label="Preset book"
        value={preset}
        onChange={load}
        options={[
          ...['ironCondor', 'shortStrangle', 'longStraddle', 'calendar', 'coveredCall'].map((k) => ({ value: k, label: BOOKS[k].label })),
          ...(preset === 'custom' ? [{ value: 'custom', label: 'Custom' }] : []),
        ]}
      />
      <p className="mt-2 mb-3 text-[0.82rem] text-(--sl-color-gray-2)">{preset === 'custom' ? 'Custom book. Edit, add or remove legs.' : BOOKS[preset].note}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-[0.8rem]">
          <thead>
            <tr className="text-left text-(--sl-color-gray-3)">
              <th className="py-1 pr-1 font-medium">Qty</th>
              <th className="py-1 pr-1 font-medium">Instrument</th>
              <th className="py-1 pr-1 font-medium">Strike</th>
              <th className="py-1 pr-1 text-right font-medium">Mark<span className="hidden sm:inline"> · IV</span></th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const q = r.kind === 'option' ? quote(r.exp, r.right, r.K) : undefined;
              const qtyOpts = r.kind === 'stock' ? [-500, -300, -200, -100, -50, 50, 100, 200, 300, 500] : [-10, -5, -3, -2, -1, 1, 2, 3, 5, 10];
              return (
                <tr key={i} className="border-t border-(--sl-color-hairline)">
                  <td className="py-1 pr-1">
                    <select className={sel} value={r.qty} onChange={(e) => update(i, { qty: +e.target.value })} aria-label="Quantity, negative is short">
                      {qtyOpts.map((n) => (
                        <option key={n} value={n}>
                          {n > 0 ? `+${n}` : `−${-n}`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <select className={sel} value={r.kind === 'stock' ? 'stock' : `${r.exp}-${r.right}`} onChange={(e) => setKind(i, e.target.value)} aria-label="Instrument">
                      <option value="nov-call">Nov 27 call</option>
                      <option value="nov-put">Nov 27 put</option>
                      <option value="dec-call">Dec 18 call</option>
                      <option value="dec-put">Dec 18 put</option>
                      <option value="stock">SPY shares</option>
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    {r.kind === 'option' ? (
                      <select className={sel} value={r.K} onChange={(e) => update(i, { K: +e.target.value })} aria-label="Strike">
                        {strikesFor(r.exp, r.right).map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-(--sl-color-gray-3)">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-1 pr-1 text-right tabular-nums text-(--sl-color-gray-2)">
                    {q ? (
                      <>
                        {q.mark.toFixed(2)}
                        <span className="hidden text-(--sl-color-gray-3) sm:inline"> · {(q.iv * 100).toFixed(1)}%</span>
                      </>
                    ) : (
                      S0.toFixed(2)
                    )}
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="cursor-pointer rounded border-0 bg-transparent px-1.5 text-(--sl-color-gray-3) hover:text-(--sl-color-white)"
                      aria-label={`Remove leg ${i + 1}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={rows.length >= 6}
        className="mt-2 cursor-pointer rounded-md border border-(--sl-color-hairline-shade) bg-transparent px-2.5 py-1 text-[0.8rem] text-(--sl-color-white) hover:bg-(--sl-color-gray-6) disabled:opacity-40"
      >
        + Add leg
      </button>

      <StatGrid
        cols={3}
        items={[
          ['Net delta', `${sgnN(g.delta, 1)} sh`, `${sgn0(g.delta * S0)} of SPY exposure`, t.stock],
          ['Gamma', `${sgnN(g.gamma, 2)} sh / $1`, `${sgn0(dollarGamma1)} on any 1% move`],
          ['Theta', `${sgn0(g.theta)} / day`, 'calendar day, nothing else moves'],
          ['Vega', `${sgn0(g.vega)} / vol pt`, 'all IVs up 1 point'],
          ['Rho', `${sgn0(g.rho)} / rate pt`, 'rates up 1 point'],
          ['Net premium', cost >= 0 ? `Pay ${sgn0(cost).replace('+', '')}` : `Collect ${sgn0(-cost).replace('+', '')}`, 'at the snapshot marks'],
        ]}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[0.85rem] font-semibold text-(--sl-color-white)">
          Where the {G.label.toLowerCase()} comes from <span className="font-normal text-(--sl-color-gray-3)">({G.unit})</span>
        </div>
        <Segmented label="Greek" value={gk} onChange={(v) => setGk(v as GKey)} options={GREEKS.map((x) => ({ value: x.key, label: x.label }))} />
      </div>
      <div ref={wrap} className="mt-2 w-full">
        <svg width={width} height={h} role="img" aria-label={`Per-leg contribution to position ${G.label}`} style={{ display: 'block' }}>
          <line x1={labelW + x(0)} x2={labelW + x(0)} y1={0} y2={h} stroke={t.axis} />
          {barRows.map((b, i) => {
            const y0 = i * rowH + 4;
            const x0 = x(Math.min(0, b.v));
            const w = Math.abs(x(b.v) - x(0));
            return (
              <g key={i} transform={`translate(0,${y0})`}>
                {b.total && <line x1={0} x2={width} y1={-3} y2={-3} stroke={t.grid} />}
                <text x={0} y={rowH / 2 - 2} dy="0.32em" fontSize={11.5} fill={b.total ? t.ink : t['ink-2']} fontWeight={b.total ? 700 : 400}>
                  {b.label}
                </text>
                <rect x={labelW + x0} y={3} width={Math.max(w, 1)} height={rowH - 10} rx={2} fill={b.total ? t.stock : b.v >= 0 ? t.call : t.put} opacity={b.total ? 1 : 0.85} />
                <text x={width - 2} y={rowH / 2 - 2} dy="0.32em" textAnchor="end" fontSize={11.5} fill={t.ink} fontWeight={b.total ? 700 : 500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {G.fmt(b.v)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-5 text-[0.78rem] text-(--sl-color-gray-3)">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--viz-call)' }} /> adds
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--viz-put)' }} /> subtracts
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--viz-stock)' }} /> position total
        </span>
      </div>
      <p className="mt-2 text-[0.75rem] text-(--sl-color-gray-3)">
        Greeks recomputed with Black-Scholes at each option&apos;s quoted IV, rate {(4.6).toFixed(1)}%, no dividend; they can differ from the vendor&apos;s
        column by a few hundredths. Expiries: {EXP_LABEL.nov} (31 days), {EXP_LABEL.dec} (52 days).
      </p>
    </div>
  );
}
