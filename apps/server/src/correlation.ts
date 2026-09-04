import type { CorrelationMatrixSnapshot } from "@ruff-term/shared";
import { LiveCache } from "./cache.js";
import * as yahoo from "./yahoo/client.js";

/**
 * Cross-asset correlation matrix — a macro/multi-asset risk view (how do
 * equities, rates, gold, oil, the dollar and vol actually move together
 * right now), computed from Yahoo daily closes. More useful for a
 * macro-driven fund than correlating single stocks against each other.
 */
const INSTRUMENTS: Array<{ ticker: string; label: string }> = [
  { ticker: "^GSPC", label: "S&P 500" },
  { ticker: "QQQ", label: "Nasdaq 100" },
  { ticker: "^FTSE", label: "FTSE 100" },
  { ticker: "^STOXX50E", label: "Euro Stoxx 50" },
  { ticker: "EEM", label: "EM Equities" },
  { ticker: "IEF", label: "US 7-10Y Treasuries" },
  { ticker: "IGLT.L", label: "UK Gilts" },
  { ticker: "GLD", label: "Gold" },
  { ticker: "CL=F", label: "Crude Oil" },
  { ticker: "UUP", label: "US Dollar" },
  { ticker: "^VIX", label: "VIX" },
];

const RANGE_MAP: Record<number, string> = { 90: "3mo", 180: "6mo", 365: "1y" };

// Fetched only on mount (tab visit, a range-toggle click, or the header's
// Refresh button, which fully remounts the active view), never polled — a
// TTL cache here would just make Refresh look like it does nothing. Safe to
// always fetch live: each of the 11 instruments goes through fetchChart,
// which has its own 15s per-symbol cache and comfortably tolerates this many
// concurrent requests (the screener does 65 at once, paced, without issue).
const cache = new LiveCache<CorrelationMatrixSnapshot>();

function dailyLogReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push(Math.log(closes[i] / closes[i - 1]));
  return out;
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  const av = a.slice(-n);
  const bv = b.slice(-n);
  const meanA = av.reduce((s, v) => s + v, 0) / n;
  const meanB = bv.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = av[i] - meanA;
    const db = bv[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

async function loadSnapshot(rangeDays: number): Promise<CorrelationMatrixSnapshot> {
  const range = RANGE_MAP[rangeDays] ?? "6mo";

  const results = await Promise.all(
    INSTRUMENTS.map(async (inst) => {
      try {
        const { bars } = await yahoo.fetchChart(inst.ticker, range);
        return { inst, returns: dailyLogReturns(bars.map((b) => b.close)) };
      } catch (err) {
        console.warn(`[correlation] Skipping ${inst.ticker}:`, (err as Error).message);
        return { inst, returns: [] as number[] };
      }
    })
  );

  const valid = results.filter((r) => r.returns.length > 10);
  const matrix = valid.map((r1) => valid.map((r2) => Math.round(pearson(r1.returns, r2.returns) * 100) / 100));

  return {
    asOf: new Date().toISOString(),
    tickers: valid.map((r) => r.inst.ticker),
    labels: valid.map((r) => r.inst.label),
    matrix,
    rangeDays,
  };
}

export async function getCorrelationMatrix(rangeDays: number): Promise<CorrelationMatrixSnapshot> {
  const key = RANGE_MAP[rangeDays] ? String(rangeDays) : "180";
  return cache.get(key, () => loadSnapshot(RANGE_MAP[rangeDays] ? rangeDays : 180));
}
