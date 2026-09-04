import type { ScreenerRow, ScreenerSnapshot } from "@ruff-term/shared";
import universe from "./data/screenerUniverse.json" with { type: "json" };
import { LiveCache } from "./cache.js";
import { mapLimit, YAHOO_CONCURRENCY } from "./concurrency.js";
import {
  baseBeforeOrFirst,
  daysAgoSeconds,
  pctChange,
  yearStartSeconds,
} from "./series.js";
import * as yahoo from "./yahoo/client.js";

interface UniverseEntry {
  ticker: string;
  name: string;
  sector: string;
}

// Fetched only on mount (tab visit or the header's Refresh button, which
// fully remounts the active view), never polled — a TTL cache here would
// just make Refresh look like it does nothing. Safe to always fetch live:
// mapLimit + YAHOO_CONCURRENCY already pace the 65-symbol universe to 8
// in flight at a time, and fetchChart itself has its own 15s per-symbol
// cache — this cache was redundant with both, not an extra safety net.
const cache = new LiveCache<ScreenerSnapshot>();

async function loadRow(entry: UniverseEntry): Promise<ScreenerRow | null> {
  try {
    const { meta, bars } = await yahoo.fetchChart(entry.ticker, "1y");
    if (bars.length < 2) return null;

    const latest = bars[bars.length - 1];
    const lastPrice = meta.regularMarketPrice ?? latest.close;
    const prev = bars[bars.length - 2];

    const weekBase = baseBeforeOrFirst(bars, daysAgoSeconds(7));
    const monthBase = baseBeforeOrFirst(bars, daysAgoSeconds(30));
    const threeMonthBase = baseBeforeOrFirst(bars, daysAgoSeconds(90));
    const yearBase = baseBeforeOrFirst(bars, yearStartSeconds());

    const high52w = Math.max(...bars.map((b) => b.high));
    const low52w = Math.min(...bars.map((b) => b.low));

    return {
      ticker: entry.ticker,
      name: entry.name,
      sector: entry.sector,
      exchange: yahoo.exchangeCodeFor(entry.ticker),
      currency: meta.currency,
      lastPrice,
      changePct1d: pctChange(prev.close, lastPrice),
      changePct1w: pctChange(weekBase.close, lastPrice),
      changePct1m: pctChange(monthBase.close, lastPrice),
      changePct3m: pctChange(threeMonthBase.close, lastPrice),
      changePctYtd: pctChange(yearBase.close, lastPrice),
      pctFrom52wHigh: pctChange(high52w, lastPrice),
      pctFrom52wLow: pctChange(low52w, lastPrice),
      updatedAt: new Date(meta.regularMarketTime * 1000).toISOString(),
    };
  } catch (err) {
    console.warn(`[screener] Skipping ${entry.ticker}:`, (err as Error).message);
    return null;
  }
}

async function loadSnapshot(): Promise<ScreenerSnapshot> {
  const entries = universe as UniverseEntry[];
  const results = await mapLimit(entries, YAHOO_CONCURRENCY, loadRow);

  const rows: ScreenerRow[] = [];
  const skipped: string[] = [];
  results.forEach((row, i) => {
    if (row) rows.push(row);
    else skipped.push(entries[i].ticker);
  });

  if (skipped.length > 0) {
    console.warn(`[screener] ${skipped.length} symbol(s) unpriced: ${skipped.join(", ")}`);
  }
  return { asOf: new Date().toISOString(), rows, skipped };
}

export async function getScreenerSnapshot(): Promise<ScreenerSnapshot> {
  return cache.get("snapshot", loadSnapshot);
}
