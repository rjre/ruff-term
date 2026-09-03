/**
 * Map over `items` with at most `limit` tasks in flight.
 *
 * `Promise.all(xs.map(f))` starts everything at once, which for the screener
 * (65 symbols) and macro (39) meant one burst of that many simultaneous
 * requests to Yahoo. Results keep input order, and — like `Promise.all` — a
 * rejection propagates, so callers that want per-item tolerance should catch
 * inside `fn`.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit < 1) throw new Error("mapLimit: limit must be >= 1");
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

/**
 * How many Yahoo requests a single snapshot load may have in flight.
 *
 * Yahoo's public endpoints are keyless and undocumented, with a 429 the only
 * feedback. Eight keeps a cold screener load (65 symbols) well under a second
 * while staying far short of the burst that provokes rate limiting.
 */
export const YAHOO_CONCURRENCY = 8;
