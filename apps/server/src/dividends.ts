import type { DividendHistoryLine, DividendsSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import { KNOWN_NAMES } from "./mockData.js";
import * as yahoo from "./yahoo/client.js";

const cache = new TtlCache<DividendsSnapshot>(6 * 60 * 60_000);

function isoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Median gap between consecutive payments, projected forward from the last
 * one — a rough "next expected" estimate, not a confirmed declared date. */
function estimateNextDate(dates: number[]): string | null {
  if (dates.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
  gaps.sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)];
  const last = dates[dates.length - 1];
  return isoDate(last + medianGap);
}

async function loadLine(ticker: string): Promise<DividendHistoryLine | null> {
  try {
    const [payments, chart] = await Promise.all([
      yahoo.fetchDividends(ticker, "2y"),
      yahoo.fetchChart(ticker, "5d"),
    ]);
    if (payments.length === 0) return null;
    return {
      ticker,
      shortName: KNOWN_NAMES[ticker] ?? ticker,
      currency: chart.meta.currency,
      payments: payments.slice(-6).map((p) => ({ date: isoDate(p.date), amount: p.amount })),
      estimatedNextDate: estimateNextDate(payments.map((p) => p.date)),
    };
  } catch (err) {
    console.warn(`[dividends] Skipping ${ticker}:`, (err as Error).message);
    return null;
  }
}

async function loadSnapshot(tickers: string[]): Promise<DividendsSnapshot> {
  const lines = (await Promise.all(tickers.map(loadLine))).filter(
    (l): l is DividendHistoryLine => l !== null
  );
  return { asOf: new Date().toISOString(), lines };
}

export async function getDividends(tickers: string[]): Promise<DividendsSnapshot> {
  return cache.getOrLoad(tickers.slice().sort().join(","), () => loadSnapshot(tickers));
}
