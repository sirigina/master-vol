# MasterVol: interactive options & volatility course

Astro + Starlight site with React widgets, Observable Plot / D3 charts, KaTeX math,
and Tailwind v4 + shadcn-style (Radix) UI. Fully static; deploys to Vercel with zero config.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # pricing-engine tests (vitest)
npm run build      # static site in dist/
```

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project → import the repo**. It detects Astro automatically
   (build `npm run build`, output `dist`). No environment variables needed.
3. **Settings → Domains**: add `mastervol.com` (and `www.mastervol.com` redirecting to it) and follow the DNS instructions.
4. Before launch, edit `src/data/site.mjs`: `amazonTag`
   (Amazon Associates tag), and confirm `bookAsin` points at the 2nd edition.

## Project map

| Path | What it is |
| --- | --- |
| `src/data/curriculum.mjs` | **Single source of truth** for tracks, modules, lessons. Set `live: true` to publish a lesson; the sidebar and course map update automatically. |
| `src/data/snapshot-YYYY-MM-DD.json` | The frozen market snapshot every example uses. |
| `scripts/snapshot-source.py` | Builds the snapshot JSON from values pulled from Robinhood at design time. |
| `src/lib/pricing.ts` | Shared pricing engine: Black-Scholes, Greeks, implied vol, payoffs, realized vol. Tested in `pricing.test.ts`. |
| `src/lib/snapshot.ts` | Typed access to the snapshot plus formatters. |
| `src/components/widgets/` | Interactive figures (React). |
| `src/components/{Plain,Pro,SnapshotNote,Takeaway,BookRef}.astro` | Lesson building blocks. |
| `src/content/docs/vol/<id>.mdx` | Lessons. URL = `/vol/<id>/`. |

## Writing a lesson

Copy `src/content/docs/vol/c2.mdx` as a template. Each lesson:

- Frontmatter: `lessonId`, `prereqs`, `minutes`, and `bookRef` **only** when the
  framing follows Natenberg closely (omit for common concepts).
- Alternates `<Plain>` (analogies from the set on `/about/`) and `<Pro>` (math, practice).
- Puts `<SnapshotNote />` directly under **every** figure or example that uses market data.
- Ends with `<Takeaway>`, a `<Quiz>`, and `<BookRef />` (renders only when `bookRef` is set).
- Math: write `$$...$$` (inline or block). A single `$` is plain text, so prices like $13.90 are safe.
- Widgets need a hydration directive: `<MyWidget client:visible />`.

Content rules: our own words, our own numbers, no tables/figures/problems copied from the book.

## Refreshing the market data

Pull the same fields again (SPY quote, a year of daily closes, one ~30-day expiry's
chain with marks, IV and Greeks), update `scripts/snapshot-source.py`, run
`npm run snapshot`, then point `src/lib/snapshot.ts` at the new file. Lesson prose
quotes specific numbers, so search the `.mdx` files for the old values and update them.

## Adding a new track

Add an object to `tracks` in `curriculum.mjs` with its own `slug`, and put its lessons
under `src/content/docs/<slug>/`. Existing IDs and URLs never change.
