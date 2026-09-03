import fs from "node:fs";
import path from "node:path";
import { post } from "./client.js";
import { CACHE_DIR } from "./config.js";

const BASE_PATH = "/markets/analytics/chartingbe/rest/external/authed";

/**
 * `/tagbrowsing` and `/taglisting` are the two endpoints Citi does NOT meter
 * — verified against the live API by the reference implementation: twelve
 * calls against a prefix left a tag inside it with all ten of its /data calls
 * intact. So tree navigation and inventory counts are free, and the whole
 * catalog can be browsed without spending any of the budget the vol surface
 * and G10 grid depend on.
 *
 * They are still cached, because they are slow (one request per second,
 * globally) rather than because they are expensive.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Cached<T> {
  value: T;
  fetchedAt: number;
}

function cacheFile(kind: string, key: string): string {
  const safe = key.replace(/[^A-Za-z0-9._-]/g, "_") || "_root";
  return path.join(CACHE_DIR, "free", `${kind}-${safe}.json`);
}

function read<T>(kind: string, key: string): T | null {
  try {
    const raw = JSON.parse(
      fs.readFileSync(cacheFile(kind, key), "utf8"),
    ) as Cached<T>;
    if (Date.now() - raw.fetchedAt > TTL_MS) return null;
    return raw.value;
  } catch {
    return null;
  }
}

function write<T>(kind: string, key: string, value: T): void {
  try {
    fs.mkdirSync(path.join(CACHE_DIR, "free"), { recursive: true });
    const file = cacheFile(kind, key);
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({ value, fetchedAt: Date.now() }));
    fs.renameSync(`${file}.tmp`, file);
  } catch (err) {
    console.warn(`[citi] Could not cache ${kind}/${key}:`, (err as Error).message);
  }
}

export interface BrowseLevel {
  /** Citi's own name for this level — "Sub Category", "Currency", "Tenor". */
  header: string | null;
  /** Code to Citi's label. Most of the tree's human meaning lives here. */
  fields: Record<string, string>;
  leaves: string[];
}

export async function browse(prefix: string): Promise<BrowseLevel> {
  const cached = read<BrowseLevel>("browse", prefix);
  if (cached) return cached;

  const result = await post<{
    header?: string;
    fields?: Record<string, string>;
    leaves?: string[];
  }>(`${BASE_PATH}/tagbrowsing`, { prefix });

  const value: BrowseLevel = {
    header: result.header ?? null,
    fields: result.fields ?? {},
    leaves: result.leaves ?? [],
  };
  write("browse", prefix, value);
  return value;
}

export interface Inventory {
  prefix: string;
  tagCount: number;
  /** A handful of real tags, to show the shape rather than the whole list. */
  samples: string[];
}

const SAMPLE_COUNT = 6;

/**
 * `/taglisting` rejects a bare root prefix ("FX") with "Invalid Input" — it
 * wants at least a sub-category. So the catalog totals are summed from the
 * per-sub-category counts instead.
 */
export function isListablePrefix(prefix: string): boolean {
  return prefix.includes(".");
}

export async function inventory(prefix: string): Promise<Inventory> {
  if (!isListablePrefix(prefix)) {
    return { prefix, tagCount: 0, samples: [] };
  }
  const cached = read<Inventory>("listing", prefix);
  if (cached) return cached;

  const result = await post<{ tags?: string[] }>(`${BASE_PATH}/taglisting`, {
    prefix,
  });
  const tags = result.tags ?? [];
  // Store the count and a sample rather than the tags themselves: FX.VOL
  // alone is ~79k of them, and nothing here needs the full list.
  const value: Inventory = {
    prefix,
    tagCount: tags.length,
    samples: tags.slice(0, SAMPLE_COUNT),
  };
  write("listing", prefix, value);
  return value;
}


export interface CatalogEntry {
  code: string;
  label: string;
  prefix: string;
  /** Null until this sub-category's free listing has been fetched. */
  tagCount: number | null;
}

export interface Catalog {
  entries: CatalogEntry[];
  totalTags: number;
  /** True while counts are still being filled in behind the scenes. */
  warming: boolean;
}

let warmingCatalog = false;

/**
 * The 24 FX sub-categories with their real tag counts.
 *
 * Counting them all is 24 listing calls. Those are free, but the client is
 * limited to one request per second, so a cold catalog takes ~24s to
 * complete. Rather than block the page on that, this returns whatever counts
 * are already cached and warms the rest in the background — the tab renders
 * instantly and fills in on the next poll. Cached for a week afterwards.
 */
export async function catalog(): Promise<Catalog> {
  const level = await browse("FX");
  const codes = Object.entries(level.fields);

  const entries: CatalogEntry[] = codes.map(([code, label]) => {
    const prefix = `FX.${code}`;
    return {
      code,
      label,
      prefix,
      tagCount: read<Inventory>("listing", prefix)?.tagCount ?? null,
    };
  });

  const missing = entries.filter((e) => e.tagCount === null);
  if (missing.length > 0 && !warmingCatalog) {
    warmingCatalog = true;
    void (async () => {
      try {
        for (const entry of missing) {
          await inventory(entry.prefix);
        }
      } catch (err) {
        console.warn("[citi] Catalog warm failed:", (err as Error).message);
      } finally {
        warmingCatalog = false;
      }
    })();
  }

  return {
    entries,
    totalTags: entries.reduce((sum, e) => sum + (e.tagCount ?? 0), 0),
    warming: missing.length > 0,
  };
}
