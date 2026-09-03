import type { CachedPoint } from "./store.js";

/**
 * Recovering a quota-blocked vol tenor from the streaming feed.
 *
 * Citi meters /data at roughly ten calls per tag, account-level, with no way
 * to buy the budget back — once a tenor's smile tags are spent, every further
 * /data call is wasted (and the API names only the first offending tag, so
 * probing costs a call per probe). The streaming websocket is metered
 * separately and can carry the same tags.
 *
 * Vol tags are derived surfaces rather than continuously quoted, so they do
 * not tick like spot: across hours of connected streaming the reference
 * implementation saw a single batch, in which all seven smile points arrived
 * together. So healing is a long, patient wait rather than a retry — which is
 * exactly why it is worth automating instead of leaving to a person.
 */

export interface HealTick {
  tag: string;
  value: number;
  /** ISO instant. */
  at: string;
}

export interface HealDeps {
  /** Ask the stream to subscribe these tags, opening the socket if needed. */
  want: (tags: string[]) => void;
  /** Register interest in the socket; the returned function releases it. */
  attach: () => () => void;
  /** Persist seeded values into the same cache /data writes to. */
  save: (points: Record<string, CachedPoint>) => void;
  now?: () => number;
}

export interface HealStatus {
  /** Tags still waiting for a value. */
  pending: string[];
  /** Tags this heal has seeded off the stream. */
  seeded: string[];
  startedAt: string;
  expiresAt: string;
}

/**
 * How long to hold the socket waiting for one tenor. Long, because whole-smile
 * batches are hours apart — but bounded, because a pair Citi does not entitle
 * would otherwise hold the single permitted connection open forever.
 */
export const HEAL_WINDOW_MS = 6 * 60 * 60 * 1000;

interface Heal {
  key: string;
  tags: Set<string>;
  seeded: Set<string>;
  startedAt: number;
  release: () => void;
}

export class VolHealer {
  private heals = new Map<string, Heal>();

  constructor(private deps: HealDeps) {}

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  private key(pair: string, tenor: string): string {
    return `${pair}|${tenor}`;
  }

  /**
   * Start waiting on the stream for a tenor whose /data fetch failed. Only
   * the tags actually missing are watched, so a partially cached smile does
   * not hold the socket for values it already has.
   */
  request(pair: string, tenor: string, missingTags: string[]): void {
    if (missingTags.length === 0) return;
    const key = this.key(pair, tenor);
    const existing = this.heals.get(key);
    if (existing) {
      for (const tag of missingTags) existing.tags.add(tag);
      this.deps.want([...existing.tags]);
      return;
    }

    const heal: Heal = {
      key,
      tags: new Set(missingTags),
      seeded: new Set(),
      startedAt: this.now(),
      release: this.deps.attach(),
    };
    this.heals.set(key, heal);
    this.deps.want(missingTags);
  }

  /** Feed a batch of stream ticks in. Returns the tags it consumed. */
  onTicks(ticks: HealTick[]): string[] {
    this.expire();
    const consumed: string[] = [];
    const points: Record<string, CachedPoint> = {};

    for (const tick of ticks) {
      for (const heal of this.heals.values()) {
        if (!heal.tags.has(tick.tag)) continue;
        points[tick.tag] = {
          date: dateFromIso(tick.at),
          value: tick.value,
          fetchedAt: new Date(this.now()).toISOString(),
          source: "stream",
        };
        heal.tags.delete(tick.tag);
        heal.seeded.add(tick.tag);
        consumed.push(tick.tag);
      }
    }

    if (consumed.length > 0) this.deps.save(points);

    // A heal with nothing left to wait for has done its job; stop holding the
    // socket open on its behalf.
    for (const heal of [...this.heals.values()]) {
      if (heal.tags.size === 0) this.finish(heal);
    }
    return consumed;
  }

  /** Drop heals that have outlived the window, releasing the socket. */
  expire(): void {
    const cutoff = this.now() - HEAL_WINDOW_MS;
    for (const heal of [...this.heals.values()]) {
      if (heal.startedAt <= cutoff) this.finish(heal);
    }
  }

  private finish(heal: Heal): void {
    heal.release();
    this.heals.delete(heal.key);
  }

  status(pair: string, tenor: string): HealStatus | null {
    this.expire();
    const heal = this.heals.get(this.key(pair, tenor));
    if (!heal) return null;
    return {
      pending: [...heal.tags],
      seeded: [...heal.seeded],
      startedAt: new Date(heal.startedAt).toISOString(),
      expiresAt: new Date(heal.startedAt + HEAL_WINDOW_MS).toISOString(),
    };
  }

  /** Every tenor currently waiting on the stream. */
  active(): string[] {
    this.expire();
    return [...this.heals.keys()];
  }
}

/** yyyyMMdd from an ISO instant, matching how /data reports observation dates. */
function dateFromIso(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`,
  );
}
