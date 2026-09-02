import Anthropic from "@anthropic-ai/sdk";
import type { ImpactedNewsItem, NewsItem, PortfolioSnapshot } from "@ruff-term/shared";
import { includesWord } from "./textMatch.js";

const MODEL = "claude-sonnet-5";

function buildPortfolioContext(portfolio: PortfolioSnapshot): string {
  const categories = new Map<string, number>();
  for (const line of portfolio.assetAllocation) {
    categories.set(line.category, (categories.get(line.category) ?? 0) + line.pct);
  }
  const categoryLines = [...categories.entries()].map(([c, pct]) => `${c} ${pct.toFixed(1)}%`).join(", ");
  const detailLines = portfolio.assetAllocation.map((l) => `${l.label} (${l.category}) ${l.pct}%`).join("; ");
  const holdingLines = portfolio.topHoldings.map((h) => `${h.name} ${h.pct}%`).join(", ");
  const currencyLines = portfolio.currencyAllocation.map((c) => `${c.label} ${c.pct}%`).join(", ");
  const geoLines = portfolio.geographicalEquityAllocation.map((g) => `${g.label} ${g.pct}%`).join(", ");

  return [
    `Fund: ${portfolio.fundName}, as of ${portfolio.asOfDate}, size £${portfolio.fundSizeGBPm}m.`,
    `Top-level asset allocation: ${categoryLines}.`,
    `Full allocation detail: ${detailLines}.`,
    `Currency allocation: ${currencyLines}.`,
    `Geographical equity allocation: ${geoLines}.`,
    `5 largest disclosed equity holdings: ${holdingLines}.`,
  ].join("\n");
}

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

interface ClaudeImpactResult {
  id: string;
  impact: string;
}

async function claudeImpacts(
  items: NewsItem[],
  portfolio: PortfolioSnapshot
): Promise<Map<string, string>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const newsList = items
    .map((item, i) => `${i + 1}. id="${item.id}" ticker=${item.tickers.join(",") || "n/a"} headline="${item.headline}"`)
    .join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1536,
    temperature: 0.2,
    system:
      "You are a portfolio analyst assistant embedded in an internal investment terminal called Ruff Term, built for Ruffer LLP. " +
      "Given a fund's current asset allocation and holdings, and a list of news headlines, write a short (1-2 sentence, under 240 characters) " +
      "note on what each headline plausibly means for THIS specific fund's portfolio, grounded only in the allocation/holdings facts given. " +
      "Be specific about which allocation category or holding is relevant. If a headline has no real connection to the fund's disclosed " +
      "exposures, say so plainly rather than inventing a link — do not overstate confidence. " +
      'Respond with ONLY a JSON array like [{"id":"...","impact":"..."}], no prose, no markdown fences.',
    messages: [
      {
        role: "user",
        content: `PORTFOLIO CONTEXT:\n${buildPortfolioContext(portfolio)}\n\nHEADLINES:\n${newsList}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text content in Claude response");

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not find JSON array in Claude response");

  const parsed = JSON.parse(jsonMatch[0]) as ClaudeImpactResult[];
  return new Map(parsed.map((r) => [r.id, r.impact]));
}

export async function getPortfolioImpact(
  items: NewsItem[],
  portfolio: PortfolioSnapshot
): Promise<ImpactedNewsItem[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return items.map((item) => ({
      ...item,
      impact: heuristicImpact(item, portfolio),
      impactSource: "heuristic",
    }));
  }

  try {
    const impacts = await claudeImpacts(items, portfolio);
    return items.map((item) => ({
      ...item,
      impact: impacts.get(item.id) ?? heuristicImpact(item, portfolio),
      impactSource: impacts.has(item.id) ? "claude" : "heuristic",
    }));
  } catch (err) {
    console.warn("[impact] Falling back to heuristic impact:", (err as Error).message);
    return items.map((item) => ({
      ...item,
      impact: heuristicImpact(item, portfolio),
      impactSource: "heuristic",
    }));
  }
}
