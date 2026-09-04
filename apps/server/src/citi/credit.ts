import type {
  CreditCurveResult,
  CreditHistoricSnapshot,
  CreditIndexDef,
  CreditSeriesPoint,
  CreditSeriesResult,
} from "@ruff-term/shared";
import { CDS_INDICES, CREDIT_CURVES, CREDIT_HISTORIC_TAGS, SOVEREIGN_INDICES } from "@ruff-term/shared";
import { isConfigured, post } from "./client.js";
import { DATA_PATH } from "./config.js";
import {
  type CachedSeries,
  getCachedSeries,
  maxCallsSpent,
  putCachedSeries,
  recordCalls,
} from "./store.js";

interface DataResponse {
  body?: Record<string, { x?: number[]; c?: number[] }>;
}

/**
 * Daily closes only move once a day, so there is nothing to gain from
 * refetching inside a day — only budget to lose. Unlike the FX legs and vol
 * surface, this pulls a long history in one call rather than just the latest
 * point, so a fresh fetch is worth far more of the ~10-call lifetime budget
 * per tag; 24h keeps it to at most one call a day even under active dev.
 */
const REFRESH_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_YEARS = 10;

function yyyymmdd(d: Date): number {
  return Number(
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`,
  );
}

function formatDate(yyyymmddInt: number): string {
  const s = String(yyyymmddInt);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function isFresh(cached: CachedSeries | undefined): boolean {
  return cached !== undefined && Date.now() - new Date(cached.fetchedAt).getTime() < REFRESH_MS;
}

async function refresh(): Promise<void> {
  const now = new Date();
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - LOOKBACK_YEARS);

  // Billed before the call: Citi charges it whether or not it succeeds.
  recordCalls(CREDIT_HISTORIC_TAGS);
  const result = await post<DataResponse>(DATA_PATH, {
    startDate: yyyymmdd(start),
    endDate: yyyymmdd(now),
    tags: CREDIT_HISTORIC_TAGS,
    pricePoints: "C",
    frequency: "DAILY",
  });

  const fetchedAt = new Date().toISOString();
  const fresh: Record<string, CachedSeries> = {};
  for (const tag of CREDIT_HISTORIC_TAGS) {
    const tagSeries = result.body?.[tag];
    const dates = tagSeries?.x ?? [];
    const closes = tagSeries?.c ?? [];
    if (dates.length === 0 || closes.length !== dates.length) continue;
    fresh[tag] = {
      points: dates.map((date, i) => ({ date, value: closes[i] })),
      fetchedAt,
    };
  }
  if (Object.keys(fresh).length > 0) putCachedSeries(fresh);
}

function seriesFor(tag: string): CreditSeriesPoint[] {
  const cached = getCachedSeries(tag);
  if (!cached) return [];
  return [...cached.points]
    .sort((a, b) => a.date - b.date)
    .map((p) => ({ date: formatDate(p.date), value: p.value }));
}

function buildIndex(def: CreditIndexDef): CreditSeriesResult {
  const points = seriesFor(def.tag);
  const last = points.at(-1);
  return {
    key: def.key,
    label: def.label,
    region: def.region,
    tenor: def.tenor,
    tag: def.tag,
    latest: last?.value ?? null,
    latestDate: last?.date ?? null,
    series: points,
  };
}

function buildCurve(curveDef: (typeof CREDIT_CURVES)[number]): CreditCurveResult {
  const perPoint = curveDef.points.map((p) => ({ tenor: p.tenor, series: seriesFor(p.tag) }));
  const dates = perPoint.map((p) => p.series.at(-1)?.date).filter((d): d is string => d !== undefined);
  return {
    key: curveDef.key,
    label: curveDef.label,
    region: curveDef.region,
    asOfDate: dates.length > 0 ? dates.sort().at(-1)! : null,
    points: perPoint.map((p) => ({ tenor: p.tenor, value: p.series.at(-1)?.value ?? null })),
  };
}

export async function getCreditHistoric(): Promise<CreditHistoricSnapshot> {
  let note: string | null = null;

  if (!CREDIT_HISTORIC_TAGS.every((tag) => isFresh(getCachedSeries(tag)))) {
    if (!isConfigured()) {
      note = "Citi credentials are not configured on this server.";
    } else {
      try {
        await refresh();
      } catch (err) {
        const message = (err as Error).message;
        note = /max calls per tag/i.test(message)
          ? "Citi's per-tag call quota is exhausted; showing the last values retrieved."
          : `Citi fetch failed (${message.slice(0, 120)}); showing the last values retrieved.`;
        console.warn(`[citi] Credit historic: ${message}`);
      }
    }
  }

  const indices = CDS_INDICES.map(buildIndex);
  const sovereigns = SOVEREIGN_INDICES.map(buildIndex);
  const curves = CREDIT_CURVES.map(buildCurve);

  const allLatestDates = [...indices, ...sovereigns]
    .map((i) => i.latestDate)
    .filter((d): d is string => d !== null);

  return {
    asOfDate: allLatestDates.length > 0 ? allLatestDates.sort().at(-1)! : null,
    lookbackYears: LOOKBACK_YEARS,
    indices,
    sovereigns,
    curves,
    note,
    callsSpent: maxCallsSpent(CREDIT_HISTORIC_TAGS),
  };
}
