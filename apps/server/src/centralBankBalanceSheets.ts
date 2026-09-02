import https from "node:https";
import type { BalanceSheetPoint, CentralBankBalanceSheetSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";

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

/** FRED's server has a TLS/HTTP2 negotiation quirk that undici's global
 * `fetch` reliably trips on in some environments (connection reset before
 * headers) even though curl and Node's core https module reach it fine.
 * Use the core client here rather than fetch. */
function httpsGetText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "curl/8.0" } }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Request failed: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

async function fetchSeries(id: string, divisor: number): Promise<BalanceSheetPoint[]> {
  const text = await httpsGetText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`);
  const lines = text.trim().split("\n").slice(1);
  const points: BalanceSheetPoint[] = [];
  for (const line of lines) {
    const [date, value] = line.split(",");
    const n = Number(value);
    if (!date || !Number.isFinite(n)) continue;
    points.push({ date, valueBn: Math.round((n / divisor) * 100) / 100 });
  }
  // Last 2 years is plenty for a "how has the balance sheet moved" view.
  return points.slice(-104);
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
