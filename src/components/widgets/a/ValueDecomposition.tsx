import * as Plot from '@observablehq/plot';
import { useMemo, useState } from 'react';
import PlotFigure, { plotStyle } from '../PlotFigure';
import { Segmented } from '../../ui/Segmented';
import { CardHead, Legend } from '../../ui/Stats';
import { useTokens } from '../../../lib/useViz';
import { snapshot } from '../../../lib/snapshot';
import { S0 } from './common';

type Right = 'call' | 'put';
type Part = { strike: number; part: 'Intrinsic' | 'Time value'; v: number; mark: number; intr: number; tv: number };

/** Real Nov 27 marks split into intrinsic and time value, strike by strike. */
export default function ValueDecomposition() {
  const [right, setRight] = useState<Right>('call');
  const t = useTokens();
  const rows = right === 'call' ? snapshot.chain.calls : snapshot.chain.puts;

  const data = useMemo(() => {
    const out: Part[] = [];
    for (const r of rows) {
      const intr = Math.max(right === 'call' ? S0 - r.strike : r.strike - S0, 0);
      const tv = r.mark - intr;
      out.push({ strike: r.strike, part: 'Intrinsic', v: intr, mark: r.mark, intr, tv });
      out.push({ strike: r.strike, part: 'Time value', v: tv, mark: r.mark, intr, tv });
    }
    return out;
  }, [right]);
  const tvOnly = data.filter((d) => d.part === 'Time value');
  const peak = tvOnly.reduce((a, b) => (b.v > a.v ? b : a));
  const color = right === 'call' ? t.call : t.put;

  return (
    <div className="viz-card not-content">
      <CardHead
        title="What you pay for: intrinsic vs time value"
        sub={`Real mid prices, Nov 27, 2026 expiry, SPY ${S0}. Hover a bar.`}
        right={
          <Segmented
            label="Option type"
            value={right}
            onChange={setRight}
            options={[
              { value: 'call', label: 'Calls' },
              { value: 'put', label: 'Puts' },
            ]}
          />
        }
      />
      <PlotFigure
        deps={[right]}
        minHeight={300}
        build={(width, tk) =>
          Plot.plot({
            width,
            height: 300,
            marginLeft: 44,
            marginBottom: 40,
            style: plotStyle(tk),
            x: { label: 'Strike', type: 'band', padding: 0.18, tickRotate: width < 520 ? -45 : 0 },
            y: { label: 'Price per share ($)', grid: true },
            color: { domain: ['Intrinsic', 'Time value'], range: [tk.aqua, right === 'call' ? tk.call : tk.put] },
            marks: [
              Plot.barY(data, {
                x: 'strike',
                y: 'v',
                fill: 'part',
                order: ['Intrinsic', 'Time value'],
              }),
              Plot.ruleY([0], { stroke: tk.axis }),
              Plot.tip(
                tvOnly,
                Plot.pointerX({
                  x: 'strike',
                  y: 'mark',
                  title: (d: Part) =>
                    `${d.strike} ${right}\nMark ${d.mark.toFixed(2)}\nIntrinsic ${d.intr.toFixed(2)}\nTime value ${d.tv.toFixed(2)}`,
                }),
              ),
            ],
          })
        }
      />
      <Legend
        items={[
          { label: 'Intrinsic value (in hand now)', color: t.aqua, kind: 'box' },
          { label: 'Time value (pays for possibility)', color, kind: 'box' },
        ]}
      />
      <p className="mt-2 text-[0.8rem] text-(--sl-color-gray-3)">
        Time value peaks at the {peak.strike} strike ({peak.v.toFixed(2)}), the one nearest the current price, and shrinks in both directions.
      </p>
    </div>
  );
}
