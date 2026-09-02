import type { ImpactedNewsItem, NewsItem, PortfolioSnapshot } from "@ruff-term/shared";
import { includesWord } from "./textMatch.js";

function heuristicImpact(item: NewsItem, portfolio: PortfolioSnapshot): string {
  const headline = item.headline.toLowerCase();
  const directHolding = portfolio.topHoldings.find((h) => includesWord(headline, h.name.split(" ")[0]));
  if (directHolding) {
    return `Direct holding: ${directHolding.name} is one of the fund's 5 largest disclosed equity positions (${directHolding.pct}% of NAV) — this headline touches a position the fund actually holds.`;
  }

  const themeMap: Array<{ keywords: string[]; label: string; pct: number }> = [
    { keywords: ["gold", "precious metal"], label: "Gold and precious metals exposure", pct: 3.1 },
    { keywords: ["oil", "crude", "energy"], label: "Energy equities / commodity exposure", pct: 5.5 },
    { keywords: ["china", "asia"], label: "Asia ex-Japan equities / China A ETF holding", pct: 4.6 },
    { keywords: ["yen", "japan", "boj"], label: "Yen currency exposure / Japan equities", pct: 4.9 },
    { keywords: ["fed", "rate", "inflation", "yield", "bond", "treasury"], label: "Protection & inflation-linked bond allocation", pct: 48.4 },
    { keywords: ["dollar", "usd"], label: "US dollar currency exposure", pct: 11.8 },
  ];
  const theme = themeMap.find((t) => t.keywords.some((k) => includesWord(headline, k)));
  if (theme) {
    return `Thematic linkage: relevant to the fund's ${theme.label} (~${theme.pct}% of the portfolio), based on keyword overlap — not a disclosed direct holding.`;
  }

  return "No material direct portfolio linkage identified from the headline alone; treat as general market context.";
}

export async function getPortfolioImpact(
  items: NewsItem[],
  portfolio: PortfolioSnapshot
): Promise<ImpactedNewsItem[]> {
  return items.map((item) => ({
    ...item,
    impact: heuristicImpact(item, portfolio),
  }));
}
