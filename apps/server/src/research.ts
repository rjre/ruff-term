import type { ResearchItem } from "@ruff-term/shared";

/** Placeholder content only — not real Ruffer research. Stands in for an
 * internal research feed until one is wired up. Authored generically
 * ("Ruffer Investment Team") rather than attributed to named individuals. */
export const DEMO_RESEARCH: ResearchItem[] = [
  {
    id: "demo-1",
    title: "Gold's role as portfolio insurance in a higher-rate world",
    summary:
      "Revisiting the case for gold and gold equities as a hedge against fiscal dominance and currency debasement, even as real yields stay elevated.",
    category: "Macro",
    author: "Ruffer Investment Team",
    publishedAt: "2026-08-28T09:00:00.000Z",
    readTimeMinutes: 6,
  },
  {
    id: "demo-2",
    title: "Inflation-linked bonds: cheap optionality or value trap?",
    summary:
      "Breakeven rates have compressed across UK and US linkers. We set out why long-dated inflation protection still screens attractively on a risk-adjusted basis.",
    category: "Fixed Income",
    author: "Ruffer Investment Team",
    publishedAt: "2026-08-25T09:00:00.000Z",
    readTimeMinutes: 8,
  },
  {
    id: "demo-3",
    title: "The AI capex cycle: participation with protection",
    summary:
      "How concentrated is too concentrated? A framework for sizing exposure to AI infrastructure beneficiaries while retaining convexity elsewhere in the book.",
    category: "Equities",
    author: "Ruffer Investment Team",
    publishedAt: "2026-08-20T09:00:00.000Z",
    readTimeMinutes: 5,
  },
  {
    id: "demo-4",
    title: "Japan: the last cheap developed equity market?",
    summary:
      "Corporate governance reform, a weak yen and re-emerging inflation are reshaping the case for Japanese equities. We look at where the asymmetry is best.",
    category: "Equities",
    author: "Ruffer Investment Team",
    publishedAt: "2026-08-14T09:00:00.000Z",
    readTimeMinutes: 7,
  },
  {
    id: "demo-5",
    title: "Derivative strategies as an unconventional protection asset",
    summary:
      "Conventional bonds may not diversify equity risk if inflation and growth both surprise to the upside. A primer on how option-based strategies fill that gap.",
    category: "Strategy",
    author: "Ruffer Investment Team",
    publishedAt: "2026-08-06T09:00:00.000Z",
    readTimeMinutes: 9,
  },
  {
    id: "demo-6",
    title: "Quarterly review: resilience over prediction",
    summary:
      "Our house view on markets heading into year end — why we remain positioned for a broadening of returns beyond a narrow set of AI beneficiaries.",
    category: "Markets",
    author: "Ruffer Investment Team",
    publishedAt: "2026-07-30T09:00:00.000Z",
    readTimeMinutes: 10,
  },
];

export function getResearch(): ResearchItem[] {
  return DEMO_RESEARCH;
}
