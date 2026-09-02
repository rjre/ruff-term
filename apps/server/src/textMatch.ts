function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive match. Plain substring matching lets "rate"
 * match inside "strategy" or "ai" match inside "said"/"gain" — both show up
 * constantly in real headlines, so keyword heuristics need this instead. */
export function includesWord(text: string, keyword: string): boolean {
  return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text);
}
