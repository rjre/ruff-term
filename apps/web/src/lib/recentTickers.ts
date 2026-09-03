const KEY = "ruff-term:recentTickers";
const MAX = 8;

const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Cached so getRecentTickers is referentially stable between renders, which
 * useSyncExternalStore requires — re-parsing localStorage each call would
 * hand React a new array every time and loop. */
let snapshot: string[] = read();

export function getRecentTickers(): string[] {
  return snapshot;
}

export function subscribeRecentTickers(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Pushes a ticker to the front of the recently-viewed list, deduping and
 * capping at MAX — most-recent-first, like browser history. */
export function addRecentTicker(ticker: string): void {
  const next = [ticker, ...snapshot.filter((t) => t !== ticker)].slice(0, MAX);
  if (next.length === snapshot.length && next.every((t, i) => t === snapshot[i])) {
    return; // already at the front; don't churn subscribers
  }
  snapshot = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private-mode/quota failures shouldn't break navigation.
  }
  for (const onChange of listeners) onChange();
}
