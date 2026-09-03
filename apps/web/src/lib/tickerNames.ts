import { fetchSearch } from "../api/client";

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

export function getCachedTickerName(ticker: string): string | null | undefined {
  return cache.get(ticker);
}

export function subscribeTickerNames(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const cb of listeners) cb();
}

/** Resolves a ticker to its company/instrument name via ticker search,
 * caching the result (including misses) for the life of the page. */
export function resolveTickerName(ticker: string): Promise<string | null> {
  if (cache.has(ticker)) return Promise.resolve(cache.get(ticker) ?? null);
  const existing = inflight.get(ticker);
  if (existing) return existing;

  const promise = fetchSearch(ticker)
    .then((results) => {
      const match = results.find((r) => r.ticker === ticker) ?? results[0];
      const name = match?.name ?? null;
      cache.set(ticker, name);
      inflight.delete(ticker);
      notify();
      return name;
    })
    .catch(() => {
      cache.set(ticker, null);
      inflight.delete(ticker);
      notify();
      return null;
    });
  inflight.set(ticker, promise);
  return promise;
}
