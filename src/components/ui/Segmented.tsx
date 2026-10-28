import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from './cn';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}

/** shadcn-style segmented control (single select). */
export function Segmented<T extends string>({ value, options, onChange, label, className }: Props<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn('inline-flex flex-wrap gap-1 rounded-lg bg-(--sl-color-gray-6) p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="cursor-pointer rounded-md border-0 bg-transparent px-2.5 py-1 text-[0.8rem] font-medium text-(--sl-color-gray-2) transition-colors hover:text-(--sl-color-white) data-[state=on]:bg-(--sl-color-bg) data-[state=on]:text-(--sl-color-white) data-[state=on]:shadow-sm"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
