const KEY = "ruff-term:recentTickers";
const MAX = 8;

export function getRecentTickers(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Pushes a ticker to the front of the recently-viewed list, deduping and
 * capping at MAX — most-recent-first, like browser history. */
export function addRecentTicker(ticker: string): void {
  const current = getRecentTickers().filter((t) => t !== ticker);
  const next = [ticker, ...current].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}
