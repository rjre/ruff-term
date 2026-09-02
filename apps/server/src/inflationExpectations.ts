import type { InflationExpectationLine, InflationExpectationsSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import { fetchFredSeries } from "./fred.js";

/**
 * Market-implied inflation expectations, straight from FRED — directly
 * relevant to a fund whose "Inflation" sleeve exists specifically to
 * protect against this. Breakeven rates are TIPS-derived (nominal minus
 * real Treasury yield at matched maturity), not a survey or forecast.
 */
const SERIES: Array<{ id: string; label: string }> = [
  { id: "T5YIE", label: "5Y Breakeven Inflation" },
  { id: "T10YIE", label: "10Y Breakeven Inflation" },
  { id: "T5YIFR", label: "5Y5Y Forward Inflation" },
  { id: "DFII10", label: "10Y TIPS Real Yield" },
];

const cache = new TtlCache<InflationExpectationsSnapshot>(6 * 60 * 60_000);

async function loadLine(series: { id: string; label: string }): Promise<InflationExpectationLine | null> {
  try {
    const points = await fetchFredSeries(series.id);
    if (points.length === 0) return null;
    const latest = points[points.length - 1];
    const prev = points.length >= 2 ? points[points.length - 2] : null;
    return {
      label: series.label,
      valuePct: latest.value,
      changeBp1d: prev ? Math.round((latest.value - prev.value) * 100) : 0,
      asOfDate: latest.date,
    };
  } catch (err) {
    console.warn(`[inflationExpectations] Skipping ${series.label}:`, (err as Error).message);
    return null;
  }
}

async function loadSnapshot(): Promise<InflationExpectationsSnapshot> {
  const lines = (await Promise.all(SERIES.map(loadLine))).filter(
    (l): l is InflationExpectationLine => l !== null
  );
  return { lines };
}

export async function getInflationExpectations(): Promise<InflationExpectationsSnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
