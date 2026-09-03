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
