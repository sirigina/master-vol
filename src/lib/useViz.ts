import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

const useIso = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Track an element's content width for responsive SVG. */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback = 640): number {
  const [w, setW] = useState(fallback);
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const first = Math.floor(el.getBoundingClientRect().width);
    if (first > 0) setW(first);
    const ro = new ResizeObserver((entries) => {
      const cw = Math.floor(entries[0].contentRect.width);
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const TOKEN_NAMES = [
  'surface', 'ink', 'ink-2', 'muted', 'grid', 'axis', 'call', 'put', 'stock', 'aqua',
  'profit', 'loss', 'profit-wash', 'loss-wash', 'band-1', 'band-2',
] as const;
export type Tokens = Record<(typeof TOKEN_NAMES)[number], string>;

const LIGHT_FALLBACK: Tokens = {
  surface: '#fcfcfb', ink: '#0b0b0b', 'ink-2': '#52514e', muted: '#898781', grid: '#e1e0d9',
  axis: '#c3c2b7', call: '#2a78d6', put: '#eb6834', stock: '#6250d6', aqua: '#1baf7a',
  profit: '#0ca30c', loss: '#d03b3b', 'profit-wash': 'rgba(12,163,12,.1)', 'loss-wash': 'rgba(208,59,59,.1)',
  'band-1': 'rgba(42,120,214,.2)', 'band-2': 'rgba(42,120,214,.09)',
};

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const out = { ...LIGHT_FALLBACK };
  for (const n of TOKEN_NAMES) {
    const v = cs.getPropertyValue(`--viz-${n}`).trim();
    if (v) out[n] = v;
  }
  return out;
}

/**
 * Resolved chart colors. SVG presentation attributes can't read CSS variables
 * reliably, so we resolve them in JS and re-render when the theme flips.
 */
export function useTokens(): Tokens {
  const [t, setT] = useState<Tokens>(LIGHT_FALLBACK);
  useIso(() => {
    const update = () => setT(readTokens());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', update);
    };
  }, []);
  return t;
}
