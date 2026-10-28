# MasterVol authoring guide

Read this fully before writing a lesson. The three published lessons are the
reference implementation; read them first and match their quality, tone and structure:

- `src/content/docs/vol/a5.mdx` (payoff diagrams)
- `src/content/docs/vol/c2.mdx` (volatility, the best template)
- `src/content/docs/vol/d1.mdx` (delta)

## Stack

Astro 7 + Starlight 0.42 (docs shell), MDX lessons, React 19 widgets hydrated with
`client:visible`, Observable Plot for standard charts, D3 scales/shapes + JSX for custom
charts, KaTeX math, Tailwind v4 utilities (no preflight) + Radix/shadcn-style UI.

Commands: `npx astro build` (must pass), `npx vitest run` (must pass),
`npx astro preview --port <port>` then `python3 scripts/shoot-cards.py <port> /vol/<id>/ <outdir> 1280 light`
(and `390 dark`) to screenshot every figure. **Look at every screenshot** and fix overlaps,
clipping, empty charts, unreadable labels, and broken dark mode.

## Files you may create / edit

- `src/content/docs/vol/<id>.mdx` for your lessons (lowercase id: `b4.mdx` -> URL `/vol/b4/`).
- New widgets in `src/components/widgets/<module letter lowercase>/` e.g. `widgets/b/BinomialTree.tsx`.
  Module-private helpers go in the same folder.
- In your working copy only, you may set `live: true` for your lessons in `src/data/curriculum.mjs`
  so they show in the sidebar while you test. (That file is not merged; the lead publishes all lessons.)

Do **not** edit anything else (shared `src/lib/*`, existing components, `ui/*`, config, styles,
other modules' lessons). If a shared helper is missing, write a local one in your widget folder.

## Shared building blocks

MDX imports use relative paths from `src/content/docs/vol/`, e.g.
`import Plain from '../../../components/Plain.astro';`

| Component | Use |
| --- | --- |
| `Plain.astro` (`title?`) | Beginner layer. Analogies from the fixed set below. |
| `Pro.astro` (`title?`) | Professional layer: definitions, math, desk practice. |
| `SnapshotNote.astro` (`detail?`) | **Required directly under every figure/example that uses market data.** |
| `Takeaway.astro` | Bulleted key takeaways (put a markdown list inside). |
| `BookRef.astro` | "Go deeper" box. Renders only if frontmatter has `bookRef`. Put at the very end. |
| `widgets/Quiz.tsx` | `<Quiz client:visible id="B4" questions={[{q, options, answer, why}]} />` |
| `widgets/PayoffChart.tsx` | Expiry (and optional "today") P/L chart for option/stock legs. |
| `widgets/PayoffBuilder.tsx` | Full strategy builder (A5). Reuse only if it fits. |
| `widgets/PlotFigure.tsx` | `<PlotFigure deps={[...]} build={(width, t) => Plot.plot({... style: plotStyle(t)})} />` |
| `ui/Slider.tsx`, `ui/Segmented.tsx` | Controls. |
| `ui/Stats.tsx` | `StatGrid`, `Legend`, `CardHead`. |

Libraries (import, never copy):

- `lib/pricing.ts`: `bs(right, {S,K,T,r,sigma,q})` -> price + Greeks (theta per calendar day,
  vega per vol point, rho per rate point), `impliedVol`, `normCdf`, `normPdf`, `intrinsic`,
  `positionPnlAtExpiry`, `breakevens`, `logReturns`, `stdev`, `realizedVol`, `rollingVol`, `expectedMove`.
- `lib/position.ts`: multi-leg `positionPnl` / `positionGreeks` (legs with their own `T` and `iv`,
  `elapsed`, `volShift`) for spreads, calendars and hedges; `binomial()` CRR tree (European/American);
  `rng`, `normalSampler`, `gbmPath(S0, sigma, days, seed)` (seeded, deterministic); `lognormalPdf`.
- `lib/snapshot.ts`: `snapshot`, `closes`, `dates`, `callAt(k)`, `putAt(k)`, `call2At(k)`, `put2At(k)`,
  `T_EXPIRY` (31/365), `T_EXPIRY2` (52/365), `atmIv`, `atmStrike`, `vixDates`, `vixValues`, `fmt`.
- `lib/useViz.ts`: `useTokens()` (resolved theme colors), `useWidth(ref)`.

Every widget: wrap in `<div className="viz-card not-content">`, start with `CardHead`, size with
`useWidth`, colors only from `useTokens()` (never hard-coded hex, never `var()` in SVG attributes;
inline `style={{stroke:'var(--viz-call)'}}` is fine for HTML legends).

## The market snapshot (SPY, Oct 27 2026 close)

All market examples use `src/data/snapshot-2026-10-27.json` via `lib/snapshot.ts`.

- SPY 769.66. Financing rate implied by put-call parity 4.6% (`snapshot.rate`). Use `q = 0`
  unless teaching dividends (SPY pays roughly 1.1%/yr, quarterly; ex-date around the third Friday of Dec/Mar/Jun/Sep).
- `chain`: Nov 27 2026 expiry, 31 days. Call strikes 700, 720, 740, 750, 760, 765, 770, 775, 780,
  790, 800, 820, 840. Put strikes 650, 680, 700, 720, 740, 750, 760, 765, 770, 775, 780, 790, 800.
  Each row: bid/ask/mark/iv/delta/gamma/theta/vega.
  770 call 13.90 (IV 14.13%, delta 0.54), 770 put 11.24 (IV 13.98%), straddle 25.14. ATM IV ≈ 14.06%.
  OTM puts carry much higher IV (650 put 32.1%, 700 put 23.8%) than OTM calls (800 call 11.8%): the skew.
- `chain2`: Dec 18 2026 expiry, 52 days, strikes 730/750/770/790/810 calls, 730/750/770/790 puts.
  770 call 18.97, 770 put 15.36.
- `termStructure`: 770-strike call/put across 9 expiries (10 to 416 days). ATM IV runs 14.7% (10d),
  14.1% (31d), 14.7% (52d), 15.9% (143d), 18.1% (416d): upward-sloping. Beyond December the put IV
  exceeds the call IV at the same strike because the vendor model doesn't include the dividend.
- `closes`: 257 daily closes Oct 20 2025 – Oct 27 2026. Realized vol 12.7% (1y), 10.0% (20d).
  Big selloff into Mar 30 2026 (631.97), recovery to highs ~779 in Oct 2026.
- `vix`: daily VIX closes, same window. Close 17.52 at the snapshot; range 13.47–31.05; mean 18.0.
  Spikes: Nov 2025 (26.4), Mar 2026 (31.1), Jun 2026 (22.2), Oct 16 2026 (20.0).
- `index`: SPX 7722.6 (SPX/SPY ≈ 10.03), VIX 17.52.
- `earnings`: MSFT 531.33, reports Oct 28 2026 after the close. 530-strike straddles:
  Oct 30 (3 days) 27.07 at IV ≈ 75%; Nov 6 (10d) 31.23, IV ≈ 45%; Nov 20 (24d) 37.88, IV ≈ 35%;
  Dec 18 (52d) 48.38, IV ≈ 30%. The front week is pricing the earnings move.

When a figure uses invented or model-generated numbers (random paths, a stylized $100 stock,
a binomial tree), do **not** put a SnapshotNote under it; say in the card subtitle that it is an
illustration. Anchor illustrations to the snapshot where natural (e.g. start paths at 769.66 with 14% vol).

**Every number you write in prose must be computed**, not estimated: write a throwaway
`node`/`npx tsx`/python check against the snapshot and the libs, and match the widget output.

## Lesson structure

```mdx
---
title: <Short title matching curriculum.mjs>
description: <one sentence, what the reader will be able to do>
lessonId: B4
prereqs: [B1, B2]
minutes: 20
bookRef: <only if listed for this lesson below>
---
import ... (only what you use)

<1–2 sentence hook in plain prose: the question this lesson answers.>

## <Section>
<Plain> … </Plain>
<Pro> … </Pro>
<Widget client:visible />
<SnapshotNote detail="…" />   (if market data)
<short prose: what to notice / try>

… 3–5 sections …

## Common mistakes        (3–4 bullets)
<Takeaway> - … </Takeaway>  (4–6 bullets)
## Check yourself
<Quiz client:visible id="B4" questions={[...]} />   (3–5 questions, each with a "why")
<BookRef />               (only when bookRef is set)
```

Aim for 2–4 interactive figures per lesson (more where the concept is visual). Each
figure must earn its place: something the reader can drag, toggle or hover to *see* the idea.
Prefer one strong interactive over two static charts.

## Writing rules

- **Original work.** Explain in our own words with our own numbers and examples. Never reproduce
  Natenberg's text, tables, figures, worked examples or problem sets. Don't paraphrase his
  examples either; build new ones from the snapshot.
- **Attribution.** Only lessons whose framing follows the book closely carry `bookRef` (list below);
  phrase it as a topic, e.g. `the chapter on volatility spreads`. Never cite chapter numbers.
  Don't mention Natenberg in the body of common-concept lessons.
- **Two layers, every section.** Plain = everyday analogies, no jargon without a gloss, no formulas.
  Pro = precise definitions, formulas with `$$...$$`, how desks actually use it, caveats.
  Each layer must stand on its own (the reader may hide the other).
- **Analogy set** (use these, don't invent competing ones): option = a deposit that holds a price
  (put = insurance policy); premium = the deposit/insurance payment; volatility = weather forecast
  for price swings (size, not direction); implied vs realized = forecast vs the weather that happened;
  delta = speedometer; gamma = accelerator; theta = melting ice; vega = sensitivity to the forecast changing.
- **Math:** `$$...$$` for all math, inline or display (single `$` is plain text so prices like $13.90
  are safe). Inside JSX props/strings no math.
- **Style:** plain, direct, specific. Short paragraphs. Bold sparingly for the key number or idea.
  No filler ("In this lesson we will…", "It's important to note…", "dive into"), no exclamation marks,
  no emojis. Use "SPY" consistently; dates like "November 27". Use the en-dash style of existing lessons
  sparingly; prefer commas and periods.
- **Cross-links** to other lessons as markdown links `[lesson D2](/vol/d2/)`; every lesson in the
  curriculum will be published, so links to any ID are fine.
- Not investment advice: describe mechanics and trade-offs, never "you should buy…".

## bookRef by lesson

Use `bookRef` only on: C2 (`the chapter on volatility`), D1 (`the chapters on risk measurement`), B1 (`the chapter on theoretical pricing and expected value`),
B6 (`the chapter on implied volatility`), C4 (`the chapter on volatility`),
C6 (`the chapter on volatility characteristics and forecasting`), D6 and D7
(`the chapters on risk measurement`), E1–E4 (`the chapters on dynamic hedging`),
F3 and F5 (`the chapter on option arbitrage`), F6 (`the chapter on early exercise`),
G2, G5, G7 (`the chapter on volatility spreads`), G9 (`the chapter on risk considerations`),
H1 and H4 (`the chapters on risk analysis`), H5 (`the chapter on models and the real world`),
I2 (`the chapter on hedging with options`), J3 (`the chapter on intermarket spreading`).
All other lessons: no bookRef.

## Quality bar (self-review before you finish)

1. `npx astro build` passes with no new warnings from your files; `npx vitest run` passes.
2. Screenshot every lesson at 1280 light and 390 dark; every figure renders, no overlaps/clipping,
   legends present for ≥2 series, tooltips work, controls usable on mobile.
3. Every number in prose matches the widgets and the snapshot.
4. Both layers present in each main section; quiz answers correct with good explanations.
5. Frontmatter `title` matches curriculum; `prereqs` are real IDs.
