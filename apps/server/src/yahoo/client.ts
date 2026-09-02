import type { NewsItem, PriceBar, SearchResult } from "@ruff-term/shared";

// Yahoo Finance's public (unofficial, keyless) endpoints. No API key needed,
// but Yahoo's edge blocks requests without a browser-like User-Agent.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function yahooGet<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 429 && attempt < 2) {
    await sleep(400 * (attempt + 1));
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

/** Daily OHLCV bars plus live-ish quote metadata for one symbol. `range` is a
 * Yahoo range token (e.g. "5d", "6mo", "1y"). */
export async function fetchChart(symbol: string, range: string): Promise<ChartData> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=${range}`;
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
