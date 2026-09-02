import { includesWord } from "./textMatch.js";

export interface ThemeDef {
  theme: string;
  keywords: string[];
}

export const THEMES: ThemeDef[] = [
  { theme: "Rates & inflation", keywords: ["fed", "rate", "inflation", "yield", "bond", "treasury", "boe", "ecb"] },
  { theme: "Gold & precious metals", keywords: ["gold", "silver", "precious metal"] },
  { theme: "Energy & commodities", keywords: ["oil", "crude", "energy", "gas", "opec", "commodity"] },
  { theme: "China & Asia", keywords: ["china", "asia", "yuan", "hong kong"] },
  { theme: "Japan & yen", keywords: ["yen", "japan", "boj"] },
  { theme: "Currency & dollar", keywords: ["dollar", "usd", "currency", "fx"] },
  { theme: "AI & technology", keywords: ["ai", "artificial intelligence", "tech", "software", "chip", "semiconductor"] },
];

/** First matching theme for a headline, or "Other" if none match. */
export function classifyHeadline(headline: string): string {
  const match = THEMES.find((t) => t.keywords.some((k) => includesWord(headline, k)));
  return match?.theme ?? "Other";
}
