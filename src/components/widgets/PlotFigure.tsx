import { useEffect, useRef } from 'react';
import { useTokens, useWidth, type Tokens } from '../../lib/useViz';

/**
 * Thin React wrapper for Observable Plot. `build` receives the measured width
 * and resolved theme tokens and returns a Plot element (or any Element).
 */
export default function PlotFigure({
  build,
  deps,
  minHeight = 240,
}: {
  build: (width: number, t: Tokens) => Element;
  deps: unknown[];
  minHeight?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box, 640);
  const t = useTokens();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const node = build(width, t);
    el.replaceChildren(node);
    return () => node.remove();
  }, [width, t, ...deps]);

  return <div ref={box} className="plot-host w-full" style={{ minHeight }} />;
}

/** Shared Plot style so every chart on the site matches. */
export function plotStyle(t: Tokens) {
  return {
    background: 'transparent',
    color: t['ink-2'],
    fontFamily: "'Inter Variable', system-ui, sans-serif",
    fontSize: '11px',
    overflow: 'visible',
  } as const;
}
