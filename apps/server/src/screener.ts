import type { ScreenerRow, ScreenerSnapshot } from "@ruff-term/shared";
import universe from "./data/screenerUniverse.json" with { type: "json" };
import { TtlCache } from "./cache.js";
import * as yahoo from "./yahoo/client.js";

interface UniverseEntry {
  ticker: string;
  name: string;
  sector: string;
}

const cache = new TtlCache<ScreenerSnapshot>(15 * 60_000);

function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return Math.round(((to - from) / from) * 10000) / 100;
}

function baseBefore(bars: { time: number; close: number }[], cutoffSeconds: number) {
  let base: { time: number; close: number } | null = null;
  for (const b of bars) {
    if (b.time < cutoffSeconds) base = b;
    else break;
  }
  return base;
}

async function loadRow(entry: UniverseEntry): Promise<ScreenerRow | null> {
  try {
    const { meta, bars } = await yahoo.fetchChart(entry.ticker, "1y");
    if (bars.length < 2) return null;

    const latest = bars[bars.length - 1];
    const lastPrice = meta.regularMarketPrice ?? latest.close;
    const prev = bars[bars.length - 2];

    const now = Date.now();
    const weekAgo = (now - 7 * 86_400_000) / 1000;
    const monthAgo = (now - 30 * 86_400_000) / 1000;
    const threeMonthAgo = (now - 90 * 86_400_000) / 1000;
    const yearStart = Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000;

    const weekBase = baseBefore(bars, weekAgo) ?? bars[0];
    const monthBase = baseBefore(bars, monthAgo) ?? bars[0];
    const threeMonthBase = baseBefore(bars, threeMonthAgo) ?? bars[0];
    const yearBase = baseBefore(bars, yearStart) ?? bars[0];

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
  const rows = (await Promise.all((universe as UniverseEntry[]).map(loadRow))).filter(
    (r): r is ScreenerRow => r !== null
  );
  return { asOf: new Date().toISOString(), rows };
}

export async function getScreenerSnapshot(): Promise<ScreenerSnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
