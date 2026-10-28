import { useMemo, useState } from 'react';
import GChart from './G1_Chart';
import { Segmented } from '../../ui/Segmented';
import { CardHead } from '../../ui/Stats';
import { leg, pnlAt, net, S0, DTE } from './G1_kit';

const LEFT = [31, 14, 3, 0];

/** G4: a butterfly's value as expiry approaches. */
export default function G4FlyDecay() {
  const [w, setW] = useState<'10' | '20'>('20');
  const legs = useMemo(() => (w === '10' ? [leg('call', 760, 1), leg('call', 770, -2), leg('call', 780, 1)] : [leg('call', 750, 1), leg('call', 770, -2), leg('call', 790, 1)]), [w]);
  const cost = net(legs);
  const colors = [(t: any) => t.muted, (t: any) => t.call, (t: any) => t.stock, (t: any) => t.ink];
  return (
    <div className="viz-card not-content">
      <CardHead
        title="A butterfly ripens late"
        sub={`Long ${w === '10' ? '760/770/780' : '750/770/790'} call butterfly, cost $${(cost * 100).toFixed(0)}. P/L with 31, 14, 3 and 0 days left, IVs unchanged.`}
        right={<Segmented label="Wing width" value={w} onChange={setW} options={[{ value: '10', label: '$10 wings' }, { value: '20', label: '$20 wings' }]} />}
      />
      <GChart
        series={LEFT.map((d, i) => ({
          key: `d${d}`,
          label: d === 0 ? 'At expiry' : `${d} days left`,
          color: colors[i],
          dash: d === 0 ? undefined : d === 31 ? '2 3' : '6 4',
          width: d === 0 ? 2.25 : 2,
          f: (x: number) => pnlAt(legs, x, DTE - d),
        }))}
        lo={735}
        hi={805}
        spot={S0}
        height={300}
        ariaLabel="Butterfly P/L curves at several times to expiry"
      />
    </div>
  );
}
