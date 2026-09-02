function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesWord(text: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text);
}

/**
 * A rough, keyword-count heuristic for headline tone — not a real NLP
 * sentiment model, just enough to let someone scan a long list of
 * headlines for which ones are worth opening first. Ties go neutral.
 */
const POSITIVE_WORDS = [
  "surges", "surge", "soars", "soar", "jumps", "jump", "rallies", "rally", "gains", "gain",
  "beats", "beat", "upgrade", "upgraded", "outperform", "strong", "growth", "wins", "win",
  "approval", "approved", "buyback", "record", "rises", "rise", "rebounds", "rebound",
  "optimistic", "bullish", "boost", "boosts", "profit", "profits",
];

const NEGATIVE_WORDS = [
  "falls", "fall", "drops", "drop", "plunges", "plunge", "slumps", "slump", "misses", "miss",
  "downgrade", "downgraded", "underperform", "weak", "losses", "loss", "cuts", "cut", "warns",
  "warn", "warning", "lawsuit", "investigation", "bearish", "recall", "layoffs", "bankruptcy",
  "fraud", "probe", "sues", "sued", "delays", "delay",
];

export type Sentiment = "positive" | "negative" | "neutral";

export function classifyHeadline(headline: string): Sentiment {
  let score = 0;
  for (const w of POSITIVE_WORDS) if (includesWord(headline, w)) score++;
  for (const w of NEGATIVE_WORDS) if (includesWord(headline, w)) score--;
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}
