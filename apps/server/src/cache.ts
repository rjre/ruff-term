interface Entry<T> {
  value: T;
  expiresAt: number;
}

/** Tiny in-memory TTL cache. Keeps us within free-tier API rate limits. */
export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();

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
    const value = await load();
    this.set(key, value);
    return value;
  }
}
