import * as RadixSlider from '@radix-ui/react-slider';
import { cn } from './cn';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** How to show the current value */
  format?: (v: number) => string;
  className?: string;
}

/** shadcn-style labeled slider. */
export function Slider({ label, value, min, max, step, onChange, format = String, className }: Props) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="flex items-baseline justify-between gap-3 text-[0.8rem] leading-tight">
        <span className="text-(--sl-color-gray-3)">{label}</span>
        <span className="font-semibold tabular-nums text-(--sl-color-white)">{format(value)}</span>
      </span>
      <RadixSlider.Root
        className="relative mt-2 flex h-5 w-full touch-none select-none items-center"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
      >
        <RadixSlider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-(--sl-color-gray-5)">
          <RadixSlider.Range className="absolute h-full bg-(--sl-color-accent)" />
        </RadixSlider.Track>
        <RadixSlider.Thumb className="block h-4 w-4 rounded-full border-2 border-(--sl-color-accent) bg-(--sl-color-bg) shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sl-color-accent)" />
      </RadixSlider.Root>
    </label>
  );
}
