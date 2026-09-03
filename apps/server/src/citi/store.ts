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

const VALUES_FILE = "tag-values.json";
const LEDGER_FILE = "call-ledger.json";

let values = read<Record<string, CachedPoint>>(VALUES_FILE, {});
const ledger = read<Record<string, number>>(LEDGER_FILE, {});

export function getCachedTag(tag: string): CachedPoint | undefined {
  return values[tag];
}

export function putCachedTags(next: Record<string, CachedPoint>): void {
  values = { ...values, ...next };
  write(VALUES_FILE, values);
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

export function callsSpent(tag: string): number {
  return ledger[tag] ?? 0;
}

/** Highest number of calls spent on any tag in the batch. */
export function maxCallsSpent(tags: string[]): number {
  return tags.reduce((max, tag) => Math.max(max, callsSpent(tag)), 0);
}
