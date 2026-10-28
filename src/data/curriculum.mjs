// Single source of truth for the curriculum. The sidebar and the course map
// are both generated from this file. Flip `live: true` when a lesson ships.
// Each track gets its own URL prefix so new tracks never renumber old ones.

export const tracks = [
  {
    slug: 'vol',
    title: 'Options & Volatility',
    blurb:
      'From payoff diagrams to volatility skew and dynamic hedging: the professional market-maker view of options.',
    modules: [
      {
        id: 'A', title: 'Contracts, markets & payoffs', lessons: [
          { id: 'A1', title: 'What an option is', live: true },
          { id: 'A2', title: 'Exercise, assignment & settlement', live: true },
          { id: 'A3', title: 'Moneyness, intrinsic & time value', live: true },
          { id: 'A4', title: 'How options trade', live: true },
          { id: 'A5', title: 'Expiration payoff diagrams', live: true },
          { id: 'A6', title: 'Elementary strategies', live: true },
        ],
      },
      {
        id: 'B', title: 'What an option is worth', lessons: [
          { id: 'B1', title: 'Expected value & fair price', live: true },
          { id: 'B2', title: 'Model inputs', live: true },
          { id: 'B3', title: 'Carrying costs & the forward', live: true },
          { id: 'B4', title: 'Black-Scholes intuition', live: true },
          { id: 'B5', title: 'The binomial model', live: true },
          { id: 'B6', title: 'Model vs market: implied volatility', live: true },
        ],
      },
      {
        id: 'C', title: 'Volatility', lessons: [
          { id: 'C1', title: 'Random walks & the normal distribution', live: true },
          { id: 'C2', title: 'Volatility as a number & expected moves', live: true },
          { id: 'C3', title: 'Lognormal vs normal', live: true },
          { id: 'C4', title: 'The five volatilities', live: true },
          { id: 'C5', title: 'Implied volatility in practice & VIX', live: true },
          { id: 'C6', title: 'Volatility characteristics & forecasting', live: true },
          { id: 'C7', title: 'Term structure & earnings crush', live: true },
          { id: 'C8', title: 'Skew & smile', live: true },
        ],
      },
      {
        id: 'D', title: 'The Greeks', lessons: [
          { id: 'D1', title: 'Delta', live: true },
          { id: 'D2', title: 'Gamma', live: true },
          { id: 'D3', title: 'Theta (and 0DTE)', live: true },
          { id: 'D4', title: 'Vega', live: true },
          { id: 'D5', title: 'Rho & dividends', live: true },
          { id: 'D6', title: 'How the Greeks move', live: true },
          { id: 'D7', title: 'The gamma-theta trade-off', live: true },
        ],
      },
      {
        id: 'E', title: 'Trading against the model', lessons: [
          { id: 'E1', title: 'Finding edge', live: true },
          { id: 'E2', title: 'Delta-neutral hedging', live: true },
          { id: 'E3', title: 'Adjusting the hedge', live: true },
          { id: 'E4', title: 'Where edge goes wrong', live: true },
        ],
      },
      {
        id: 'F', title: 'Synthetics, arbitrage & early exercise', lessons: [
          { id: 'F1', title: 'Synthetics', live: true },
          { id: 'F2', title: 'Put-call parity', live: true },
          { id: 'F3', title: 'Conversions & reversals', live: true },
          { id: 'F4', title: 'Boxes & jelly rolls', live: true },
          { id: 'F5', title: 'Arbitrage risks', live: true },
          { id: 'F6', title: 'Early exercise', live: true },
        ],
      },
      {
        id: 'G', title: 'Spreads', lessons: [
          { id: 'G1', title: 'Why spreads', live: true },
          { id: 'G2', title: 'Classifying volatility spreads', live: true },
          { id: 'G3', title: 'Straddles & strangles', live: true },
          { id: 'G4', title: 'Butterflies & condors', live: true },
          { id: 'G5', title: 'Ratios & backspreads', live: true },
          { id: 'G6', title: 'Calendars & diagonals', live: true },
          { id: 'G7', title: 'Choosing the right volatility spread', live: true },
          { id: 'G8', title: 'Bull & bear verticals', live: true },
          { id: 'G9', title: 'Adjusting & exiting', live: true },
        ],
      },
      {
        id: 'H', title: 'Risk & position analysis', lessons: [
          { id: 'H1', title: 'Comparing spreads by risk', live: true },
          { id: 'H2', title: 'Position Greeks', live: true },
          { id: 'H3', title: 'Scenario analysis', live: true },
          { id: 'H4', title: 'Practical risk management', live: true },
          { id: 'H5', title: 'Models and the real world', live: true },
        ],
      },
      {
        id: 'I', title: 'Hedging', lessons: [
          { id: 'I1', title: 'Protective strategies', live: true },
          { id: 'I2', title: 'Complex hedges', live: true },
          { id: 'I3', title: 'Portfolio hedging', live: true },
        ],
      },
      {
        id: 'J', title: 'Index & intermarket', lessons: [
          { id: 'J1', title: 'Index options & futures', live: true },
          { id: 'J2', title: 'Index fair value & arbitrage', live: true },
          { id: 'J3', title: 'Intermarket spreading', live: true },
          { id: 'J4', title: 'Capstone: building a trade plan', live: true },
        ],
      },
    ],
  },
];

export const lessonHref = (track, id) => `/${track}/${id.toLowerCase()}/`;

/** Starlight sidebar: one group per module, live lessons only. */
export function buildSidebar() {
  return [
    { label: 'Start here', items: [{ label: 'Course map', link: '/vol/' }, { label: 'How to use this site', link: '/about/' }] },
    ...tracks.flatMap((t) =>
      t.modules
        .filter((m) => m.lessons.some((l) => l.live))
        .map((m) => ({
          label: `${m.id} · ${m.title}`,
          items: m.lessons
            .filter((l) => l.live)
            .map((l) => ({ label: `${l.id} ${l.title}`, link: lessonHref(t.slug, l.id) })),
        })),
    ),
    { label: 'Reference', items: [{ label: 'Glossary', link: '/glossary/' }] },
  ];
}
