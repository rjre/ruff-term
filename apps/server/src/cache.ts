interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Tiny in-memory TTL cache. Keeps us within free-tier API rate limits. */
export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  /** Loads currently in flight, so a burst of misses on the same key waits
   * on one upstream request instead of firing one each. */
  private inFlight = new Map<string, Promise<T>>();

  constructor(private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    // Every panel polls on its own timer and several browser tabs may be
    // open, so an expiring key would otherwise fan out into one Yahoo call
    // per concurrent request — the fastest way to earn a 429.
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        // A rejected load is deliberately not cached: the caller handles the
        // error and the next request gets a fresh attempt.
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }
}

/**
 * For a source fetched only on a deliberate user action — a tab visit, or
 * the header's Refresh button, which fully remounts the active view —
 * rather than polled on a timer. A `TtlCache` there just gives Refresh a
 * chance to look like it does nothing: every call already represents a
 * genuine "get me the current data" moment, so this always attempts a live
 * load instead of gating it behind an expiry.
 *
 * Concurrent callers on the same key (React StrictMode's double effect
 * invocation in dev, or more than one browser tab) still collapse onto one
 * upstream request, and a failed load falls back to the last successful
 * result rather than erroring the panel over a transient hiccup — the
 * fallback is fail-open resilience, not a freshness guarantee.
 */
export class LiveCache<T> {
  private lastGood = new Map<string, T>();
  private inFlight = new Map<string, Promise<T>>();

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        this.lastGood.set(key, value);
        return value;
      })
      .catch((err) => {
        const fallback = this.lastGood.get(key);
        if (fallback !== undefined) return fallback;
        throw err;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }
}
