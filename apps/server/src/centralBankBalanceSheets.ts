import type { BalanceSheetPoint, CentralBankBalanceSheetSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import { fetchFredSeries } from "./fred.js";

/**
 * Central bank total assets from FRED's public CSV export (free, keyless,
 * no API key required for the graph-download endpoint). The Bank of England
 * does not publish an equivalent single free machine-readable weekly total
 * assets series, so it's omitted here rather than approximated.
 */
const SERIES: Array<{ bank: string; id: string; currency: string; divisor: number }> = [
  { bank: "Federal Reserve", id: "WALCL", currency: "USD", divisor: 1000 },
  { bank: "European Central Bank", id: "ECBASSETSW", currency: "EUR", divisor: 1000 },
  // JPNASSETS is reported in units of ¥100 million, so /10 gives ¥bn.
  { bank: "Bank of Japan", id: "JPNASSETS", currency: "JPY", divisor: 10 },
];

const cache = new TtlCache<CentralBankBalanceSheetSnapshot>(6 * 60 * 60_000);

async function fetchSeries(id: string, divisor: number): Promise<BalanceSheetPoint[]> {
  const points = await fetchFredSeries(id);
  // Last 2 years is plenty for a "how has the balance sheet moved" view.
  return points.slice(-104).map((p) => ({ date: p.date, valueBn: Math.round((p.value / divisor) * 100) / 100 }));
}

async function loadSnapshot(): Promise<CentralBankBalanceSheetSnapshot> {
  const series = await Promise.all(
    SERIES.map(async (s) => {
      try {
        const points = await fetchSeries(s.id, s.divisor);
        return {
          bank: s.bank,
          currency: s.currency,
          sourceUrl: `https://fred.stlouisfed.org/series/${s.id}`,
          points,
        };
      } catch (err) {
        console.warn(`[centralBankBalanceSheets] Skipping ${s.bank}:`, (err as Error).message);
        return { bank: s.bank, currency: s.currency, sourceUrl: `https://fred.stlouisfed.org/series/${s.id}`, points: [] };
      }
    })
  );
  return { asOf: new Date().toISOString(), series: series.filter((s) => s.points.length > 0) };
}

export async function getCentralBankBalanceSheets(): Promise<CentralBankBalanceSheetSnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
