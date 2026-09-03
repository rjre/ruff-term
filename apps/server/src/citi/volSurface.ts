import type { VolSurfacePoint, VolSurfaceSnapshot } from "@ruff-term/shared";
import { DATA_PATH } from "./config.js";
import { isConfigured, post } from "./client.js";
import { SMILE_POINTS, buildCurve } from "./smile.js";
import {
  getCachedTag,
  maxCallsSpent,
  putCachedTags,
  recordCalls,
  type CachedPoint,
} from "./store.js";

export const TENORS = [
  "ON", "1W", "2W", "1M", "2M", "3M", "6M", "9M", "1Y", "2Y", "3Y", "5Y",
];

/** Pairs exposed in the UI. Each (pair, tenor) is seven more metered tags, so
 * this list is deliberately short. */
export const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"];

function tagFor(pair: string, suffix: string, tenor: string): string {
  const [base, quote] = pair.split("/");
  return `FX.VOL.${base}.${quote}.${suffix}.${tenor}.IMPLIED.CITI`;
}

// --- Fetch ----------------------------------------------------------------

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
 * All seven smile points in ONE batched /data call. Citi meters /data at
 * roughly ten calls per tag, account-level and not reset by a new token, so
 * fetching them one at a time would burn the budget seven times as fast — and
 * a single exhausted tag fails the whole batch anyway.
 */
async function fetchSmile(
  pair: string,
  tenor: string,
  lookbackDays: number,
): Promise<Record<string, CachedPoint>> {
  const now = new Date();
  const start = new Date(now.getTime() - lookbackDays * 86_400_000);
  const tags = SMILE_POINTS.map((p) => tagFor(pair, p.suffix, tenor));

  // Bill the call before making it: Citi charges it whether or not it succeeds.
  recordCalls(tags);
  const result = await post<DataResponse>(DATA_PATH, {
    startDate: yyyymmdd(start),
    endDate: yyyymmdd(now),
    tags,
    pricePoints: "C",
    frequency: "DAILY",
  });

  const fetchedAt = new Date().toISOString();
  const fresh: Record<string, CachedPoint> = {};
  for (const tag of tags) {
    const series = result.body?.[tag];
    const dates = series?.x ?? [];
    const closes = series?.c ?? [];
    if (dates.length > 0 && closes.length === dates.length) {
      fresh[tag] = {
        date: dates[dates.length - 1],
        value: closes[closes.length - 1],
        fetchedAt,
      };
    }
  }
  if (Object.keys(fresh).length > 0) putCachedTags(fresh);
  return fresh;
}

// --- Public API -----------------------------------------------------------

/**
 * A vol tenor moves slowly at DAILY frequency, and every refresh costs one of
 * roughly ten lifetime calls per tag, so this is hours rather than seconds.
 */
const REFRESH_MS = 12 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 10;

function isFresh(point: CachedPoint | undefined): boolean {
  return (
    point !== undefined &&
    Date.now() - new Date(point.fetchedAt).getTime() < REFRESH_MS
  );
}

export async function getVolSurface(
  pair: string,
  tenor: string,
): Promise<VolSurfaceSnapshot> {
  const tags = SMILE_POINTS.map((p) => tagFor(pair, p.suffix, tenor));
  let note: string | null = null;

  // Only spend a call if what we hold has gone stale.
  if (!tags.every((tag) => isFresh(getCachedTag(tag)))) {
    if (!isConfigured()) {
      note = "Citi credentials are not configured on this server.";
    } else {
      try {
        await fetchSmile(pair, tenor, LOOKBACK_DAYS);
      } catch (err) {
        const message = (err as Error).message;
        note = /max calls per tag/i.test(message)
          ? "Citi's per-tag call quota for this tenor is exhausted; showing the last values retrieved."
          : `Citi fetch failed (${message.slice(0, 120)}); showing the last values retrieved.`;
        console.warn(`[citi] ${pair} ${tenor}: ${message}`);
      }
    }
  }

  const quotes: VolSurfacePoint[] = SMILE_POINTS.map((p) => {
    const cached = getCachedTag(tagFor(pair, p.suffix, tenor));
    return {
      u: p.u,
      label: p.label,
      volPct: cached?.value ?? null,
      kind: "quoted",
    };
  });

  const curve = buildCurve(quotes);
  if (curve.length === 0) {
    return {
      pair,
      tenor,
      asOfDate: null,
      quotes,
      curve,
      note:
        note ??
        "Citi returned too few quotes for this pair/tenor to fit a smile — it may not be entitled on these credentials.",
      callsSpent: maxCallsSpent(tags),
    };
  }

  const dates = tags
    .map((tag) => getCachedTag(tag)?.date)
    .filter((d): d is number => d !== undefined);
  const latest = dates.length > 0 ? Math.max(...dates) : null;

  return {
    pair,
    tenor,
    asOfDate: latest === null ? null : formatDate(latest),
    quotes,
    curve,
    note,
    callsSpent: maxCallsSpent(tags),
  };
}

function formatDate(yyyymmddInt: number): string {
  const s = String(yyyymmddInt);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
