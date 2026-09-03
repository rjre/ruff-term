import type { G10GridSnapshot } from "@ruff-term/shared";
import { isConfigured, post } from "./client.js";
import { DATA_PATH } from "./config.js";
import { TAGS, buildGrid, usdRates } from "@ruff-term/shared";
import {
  getBaseline,
  getCachedTag,
  maxCallsSpent,
  putBaselines,
  putCachedTags,
  recordCalls,
  type BaselinePoint,
  type CachedPoint,
} from "./store.js";

interface DataResponse {
  body?: Record<string, { x?: number[]; c?: number[] }>;
}

function yyyymmdd(d: Date): number {
  return Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`,
  );
}

/**
 * Twelve-hour cache, like the vol surface and for the same reason: every
 * refresh spends one of roughly ten lifetime calls on each of these nine tags.
 * These are end-of-day closes, labelled as such — not a live spot feed.
 */
const REFRESH_MS = 12 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 12;

/**
 * A tag is only usable when we hold both its latest close and the baseline to
 * compare it against — one call supplies both, so a half-populated cache is
 * worth one call to complete rather than a change grid full of dashes.
 */
function isUsable(tag: string): boolean {
  const point: CachedPoint | undefined = getCachedTag(tag);
  if (point === undefined) return false;
  if (Date.now() - new Date(point.fetchedAt).getTime() >= REFRESH_MS) return false;
  return getBaseline(tag) !== undefined;
}

async function refresh(): Promise<void> {
  const now = new Date();
  const start = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);

  // Billed before the call: Citi charges it whether or not it succeeds.
  recordCalls(TAGS);
  const result = await post<DataResponse>(DATA_PATH, {
    startDate: yyyymmdd(start),
    endDate: yyyymmdd(now),
    tags: TAGS,
    pricePoints: "C",
    frequency: "DAILY",
  });

  const fetchedAt = new Date().toISOString();
  const fresh: Record<string, CachedPoint> = {};
  const nextBaselines: Record<string, BaselinePoint> = {};
  for (const tag of TAGS) {
    const series = result.body?.[tag];
    const dates = series?.x ?? [];
    const closes = series?.c ?? [];
    if (dates.length === 0 || closes.length !== dates.length) continue;
    fresh[tag] = {
      date: dates[dates.length - 1],
      value: closes[closes.length - 1],
      fetchedAt,
    };
    // The window's opening close is the comparison point — one call gives
    // both the level and the change.
    nextBaselines[tag] = { date: dates[0], value: closes[0] };
  }
  if (Object.keys(fresh).length > 0) {
    putCachedTags(fresh);
    putBaselines(nextBaselines);
  }
}

export async function getG10Grid(): Promise<G10GridSnapshot> {
  let note: string | null = null;

  if (!TAGS.every(isUsable)) {
    if (!isConfigured()) {
      note = "Citi credentials are not configured on this server.";
    } else {
      try {
        await refresh();
      } catch (err) {
        const message = (err as Error).message;
        note = /max calls per tag/i.test(message)
          ? "Citi's per-tag call quota for the spot legs is exhausted; showing the last values retrieved."
          : `Citi fetch failed (${message.slice(0, 120)}); showing the last values retrieved.`;
        console.warn(`[citi] G10 grid: ${message}`);
      }
    }
  }

  const latest = usdRates((tag) => getCachedTag(tag)?.value);
  const base = usdRates((tag) => getBaseline(tag)?.value);
  const { currencies, rates, changes, strength } = buildGrid(latest, base);

  const dates = TAGS.map((t) => getCachedTag(t)?.date).filter(
    (d): d is number => d !== undefined,
  );
  const baseDates = TAGS.map((t) => getBaseline(t)?.date).filter(
    (d): d is number => d !== undefined,
  );

  return {
    currencies,
    rates,
    changes,
    strength,
    asOfDate: dates.length > 0 ? formatDate(Math.max(...dates)) : null,
    baselineDate: baseDates.length > 0 ? formatDate(Math.min(...baseDates)) : null,
    legTags: TAGS,
    note,
    callsSpent: maxCallsSpent(TAGS),
  };
}

function formatDate(yyyymmddInt: number): string {
  const s = String(yyyymmddInt);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
