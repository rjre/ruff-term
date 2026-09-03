import fs from "node:fs";
import path from "node:path";
import { CACHE_DIR } from "./config.js";

/**
 * A tiny JSON file store. Deliberately synchronous: these files are small,
 * written a few times an hour, and a lost write means re-spending a metered
 * API call — correctness matters far more than the microseconds.
 */
function file(name: string): string {
  return path.join(CACHE_DIR, name);
}

function read<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file(name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function write(name: string, value: unknown): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    // Write-then-rename so a crash mid-write can't truncate the ledger.
    const tmp = `${file(name)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
    fs.renameSync(tmp, file(name));
  } catch (err) {
    console.warn(`[citi] Could not persist ${name}:`, (err as Error).message);
  }
}

export interface CachedPoint {
  /** yyyyMMdd of the observation. */
  date: number;
  value: number;
  /** When we fetched it. */
  fetchedAt: string;
}

export interface BaselinePoint {
  date: number;
  value: number;
}

const VALUES_FILE = "tag-values.json";
const BASELINES_FILE = "tag-baselines.json";
const LEDGER_FILE = "call-ledger.json";

let values = read<Record<string, CachedPoint>>(VALUES_FILE, {});
let baselines = read<Record<string, BaselinePoint>>(BASELINES_FILE, {});
const ledger = read<Record<string, number>>(LEDGER_FILE, {});

export function getCachedTag(tag: string): CachedPoint | undefined {
  return values[tag];
}

export function putCachedTags(next: Record<string, CachedPoint>): void {
  values = { ...values, ...next };
  write(VALUES_FILE, values);
}

/**
 * The opening close of the window a tag was last fetched over, used as the
 * comparison point for change grids.
 *
 * Persisted for the same reason the values are: after a restart the cached
 * values still look fresh, so nothing refetches — and an in-memory baseline
 * would leave the change grid permanently empty with no way to refill it
 * short of spending another metered call.
 */
export function getBaseline(tag: string): BaselinePoint | undefined {
  return baselines[tag];
}

export function putBaselines(next: Record<string, BaselinePoint>): void {
  baselines = { ...baselines, ...next };
  write(BASELINES_FILE, baselines);
}

/**
 * Records that a /data call named these tags. Citi bills the call against
 * every tag in the batch whether or not the call succeeded, so this is called
 * on failure too. The ledger informs; it never vetoes a call — the limit and
 * its reset window are inferred rather than documented, and refusing a
 * request the API might have honoured would be worse.
 */
export function recordCalls(tags: string[]): void {
  for (const tag of tags) ledger[tag] = (ledger[tag] ?? 0) + 1;
  write(LEDGER_FILE, ledger);
}

const CONNECTS_FILE = "stream-connects.json";
const DAY_MS = 24 * 60 * 60 * 1000;

let connects = read<number[]>(CONNECTS_FILE, []);

/**
 * Timestamps of streaming websocket connects, persisted for the same reason
 * the /data ledger is: Citi allows roughly 100 connects per user per 24h and
 * only one live connection per login, and `tsx watch` restarts the server on
 * every save. An in-memory count would reset each time and hide the drain.
 */
export function recordConnect(): void {
  const cutoff = Date.now() - DAY_MS;
  connects = [...connects.filter((t) => t > cutoff), Date.now()];
  write(CONNECTS_FILE, connects);
}

export function connectsInLastDay(): number {
  const cutoff = Date.now() - DAY_MS;
  return connects.filter((t) => t > cutoff).length;
}

export function callsSpent(tag: string): number {
  return ledger[tag] ?? 0;
}

/** Highest number of calls spent on any tag in the batch. */
export function maxCallsSpent(tags: string[]): number {
  return tags.reduce((max, tag) => Math.max(max, callsSpent(tag)), 0);
}
