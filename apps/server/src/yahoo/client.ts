import type { NewsItem, PriceBar, SearchResult } from "@ruff-term/shared";
import { TtlCache } from "../cache.js";

// Yahoo Finance's public (unofficial, keyless) endpoints. No API key needed,
// but Yahoo's edge blocks requests without a browser-like User-Agent.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/** Cap on a single upstream request. Without one, a hung connection hangs
 * the API request behind it indefinitely — and because TtlCache shares one
 * in-flight load per key, it would hang every caller waiting on that key. */
const REQUEST_TIMEOUT_MS = 10_000;

const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with full jitter. A flat delay is worse than useless
 * for a rate limit: a burst of symbols all sleep the same 400ms and then
 * collide again on the retry. */
function backoffMs(attempt: number): number {
  return Math.round(Math.random() * 400 * 2 ** attempt);
}

async function yahooGet<T>(url: string, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout = (err as Error).name === "TimeoutError";
    if (isTimeout && attempt < MAX_RETRIES) {
      await sleep(backoffMs(attempt));
      return yahooGet<T>(url, attempt + 1);
    }
    throw isTimeout
      ? new Error(`Yahoo request timed out after ${REQUEST_TIMEOUT_MS}ms`)
      : (err as Error);
  }

  if (res.status === 429 && attempt < MAX_RETRIES) {
    await sleep(backoffMs(attempt));
    return yahooGet<T>(url, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Yahoo request failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Map a Yahoo ticker suffix to the Bloomberg-style exchange code shown next
 * to a ticker (e.g. "VOD.L" -> "LN"). Falls back to "US" for bare US symbols. */
const SUFFIX_TO_EXCHANGE: Record<string, string> = {
  L: "LN",
  HK: "HK",
  T: "JP",
  AX: "AU",
  TO: "CN",
  V: "CN",
  PA: "FP",
  AS: "NA",
  DE: "GY",
  SW: "SW",
  MI: "IM",
  CO: "DC",
  ST: "SS",
  OL: "NO",
  SI: "SP",
  KS: "KS",
  SS: "CH",
  SZ: "CH",
  NZ: "NZ",
  SA: "BZ",
  MC: "SM",
  BR: "BB",
  IR: "ID",
};

export function exchangeCodeFor(symbol: string): string {
  const dot = symbol.lastIndexOf(".");
  if (dot === -1) return "US";
  const suffix = symbol.slice(dot + 1).toUpperCase();
  return SUFFIX_TO_EXCHANGE[suffix] ?? suffix;
}

interface YahooChartMeta {
  currency: string;
  symbol: string;
  fullExchangeName?: string;
  exchangeName?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice: number;
  regularMarketTime: number;
  chartPreviousClose?: number;
  previousClose?: number;
}

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: YahooChartMeta;
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
      events?: {
        dividends?: Record<string, { amount: number; date: number }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

export interface ChartData {
  meta: YahooChartMeta;
  bars: PriceBar[];
}

/**
 * Shared per-symbol chart cache.
 *
 * Snapshot modules each cache their own finished payload, but several ask
 * Yahoo for the same symbol independently — EURUSD=X, GBPUSD=X, USDJPY=X and
 * AUDUSD=X are each fetched by both macro.ts and fx.ts, and the watchlist and
 * screener overlap too. Caching one layer lower collapses those into a single
 * upstream request, and TtlCache's in-flight sharing means simultaneous
 * callers wait on it rather than racing.
 *
 * The TTL sits just under the tightest snapshot TTL in the app (fx, 20s), so
 * nothing renders staler than it would have. Entries are shared by reference:
 * callers must treat `bars` and `meta` as read-only.
 */
const CHART_TTL_MS = 15_000;
const chartCache = new TtlCache<ChartData>(CHART_TTL_MS);

/** OHLCV bars plus live-ish quote metadata for one symbol. `range` is a
 * Yahoo range token (e.g. "5d", "6mo", "1y"); `interval` a Yahoo bar size
 * (e.g. "1d", "5m", "30m") — defaults to daily bars. */
export async function fetchChart(
  symbol: string,
  range: string,
  interval = "1d"
): Promise<ChartData> {
  return chartCache.getOrLoad(`${symbol}|${range}|${interval}`, () =>
    loadChart(symbol, range, interval)
  );
}

async function loadChart(
  symbol: string,
  range: string,
  interval: string
): Promise<ChartData> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=${interval}&range=${range}`;
  const data = await yahooGet<YahooChartResponse>(url);
  const result = data.chart.result?.[0];
  if (!result) {
    throw new Error(data.chart.error?.description ?? `No chart data for ${symbol}`);
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators.quote[0];
  const bars: PriceBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = quote.close[i];
    if (close == null) continue;
    bars.push({
      time: timestamps[i],
      open: quote.open[i] ?? close,
      high: quote.high[i] ?? close,
      low: quote.low[i] ?? close,
      close,
      volume: quote.volume[i] ?? 0,
    });
  }

  return { meta: result.meta, bars };
}

export interface DividendPayment {
  date: number; // unix seconds
  amount: number;
}

/** Real historical dividend payments — from the same chart endpoint used for
 * price bars, via its `events=div` param. Unlike quoteSummary/v7 endpoints,
 * this one isn't gated behind Yahoo's auth crumb. */
export async function fetchDividends(symbol: string, range: string): Promise<DividendPayment[]> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=${range}&events=div`;
  const data = await yahooGet<YahooChartResponse>(url);
  const result = data.chart.result?.[0];
  if (!result) throw new Error(data.chart.error?.description ?? `No chart data for ${symbol}`);
  const dividends = result.events?.dividends ?? {};
  return Object.values(dividends).sort((a, b) => a.date - b.date);
}

interface YahooSearchResponse {
  quotes?: Array<{
    symbol: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    quoteType?: string;
  }>;
  news?: Array<{
    uuid: string;
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: number;
  }>;
}

export async function searchTickers(query: string): Promise<SearchResult[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query
  )}&quotesCount=8&newsCount=0`;
  const data = await yahooGet<YahooSearchResponse>(url);
  return (data.quotes ?? [])
    .filter((q) => q.quoteType === "EQUITY")
    .map((q) => ({
      ticker: q.symbol,
      name: q.longname ?? q.shortname ?? q.symbol,
      exchange: exchangeCodeFor(q.symbol),
      market: "stocks",
    }));
}

export async function fetchNews(query: string): Promise<NewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query
  )}&quotesCount=0&newsCount=12`;
  const data = await yahooGet<YahooSearchResponse>(url);
  return (data.news ?? []).map((n) => ({
    id: n.uuid,
    headline: n.title,
    source: n.publisher,
    url: n.link,
    publishedAt: new Date(n.providerPublishTime * 1000).toISOString(),
    tickers: [],
  }));
}
