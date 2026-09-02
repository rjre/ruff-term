import type { NewsItem, SearchResult, WatchlistQuote } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import { KNOWN_NAMES, mockHistory, mockNews, mockQuote, mockSearch } from "./mockData.js";
import * as polygon from "./polygon/client.js";
import type { PriceBar } from "@ruff-term/shared";

const quoteCache = new TtlCache<WatchlistQuote>(60_000);
const historyCache = new TtlCache<PriceBar[]>(5 * 60_000);
const searchCache = new TtlCache<SearchResult[]>(5 * 60_000);
const newsCache = new TtlCache<NewsItem[]>(2 * 60_000);

export const DEFAULT_WATCHLIST = Object.keys(KNOWN_NAMES);

function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return Math.round(((to - from) / from) * 10000) / 100;
}

async function loadQuote(ticker: string): Promise<WatchlistQuote> {
  const now = new Date().toISOString();

  if (!polygon.hasApiKey()) {
    const mock = mockQuote(ticker);
    return {
      ticker,
      exchange: "US",
      shortName: KNOWN_NAMES[ticker] ?? ticker,
      lastPrice: mock.lastPrice,
      changePct1d: mock.changePct1d,
      changePct2d: mock.changePct2d,
      currency: "USD",
      updatedAt: now,
    };
  }

  try {
    const [bars, details] = await Promise.all([
      polygon.fetchDailyBars(ticker, 3),
      polygon.fetchTickerDetails(ticker).catch(() => ({
        name: KNOWN_NAMES[ticker] ?? ticker,
        exchange: "US",
        currency: "USD",
      })),
    ]);

    if (bars.length < 2) throw new Error("insufficient bars from Polygon");

    const latest = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const prevPrev = bars.length >= 3 ? bars[bars.length - 3] : prev;

    return {
      ticker,
      exchange: details.exchange,
      shortName: details.name,
      lastPrice: latest.close,
      changePct1d: pctChange(prev.close, latest.close),
      changePct2d: pctChange(prevPrev.close, prev.close),
      currency: details.currency,
      updatedAt: now,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[marketData] Falling back to mock data for ${ticker}:`, (err as Error).message);
    const mock = mockQuote(ticker);
    return {
      ticker,
      exchange: "US",
      shortName: KNOWN_NAMES[ticker] ?? ticker,
      lastPrice: mock.lastPrice,
      changePct1d: mock.changePct1d,
      changePct2d: mock.changePct2d,
      currency: "USD",
      updatedAt: now,
    };
  }
}

export async function getQuote(ticker: string): Promise<WatchlistQuote> {
  return quoteCache.getOrLoad(ticker, () => loadQuote(ticker));
}

export async function getWatchlistQuotes(tickers: string[]): Promise<WatchlistQuote[]> {
  return Promise.all(tickers.map(getQuote));
}

export async function getHistory(ticker: string, days: number): Promise<PriceBar[]> {
  return historyCache.getOrLoad(`${ticker}:${days}`, async () => {
    if (!polygon.hasApiKey()) return mockHistory(ticker, days);
    try {
      const bars = await polygon.fetchDailyBars(ticker, days);
      if (bars.length === 0) throw new Error("no bars returned");
      return bars;
    } catch (err) {
      console.warn(`[marketData] History fallback to mock for ${ticker}:`, (err as Error).message);
      return mockHistory(ticker, days);
    }
  });
}

export async function search(query: string): Promise<SearchResult[]> {
  return searchCache.getOrLoad(query.toLowerCase(), async () => {
    if (!polygon.hasApiKey()) return mockSearch(query);
    try {
      const results = await polygon.searchTickers(query);
      if (results.length === 0) return mockSearch(query);
      return results;
    } catch (err) {
      console.warn(`[marketData] Search fallback to mock for "${query}":`, (err as Error).message);
      return mockSearch(query);
    }
  });
}

export async function getNews(ticker?: string): Promise<NewsItem[]> {
  return newsCache.getOrLoad(ticker ?? "__market__", async () => {
    if (!polygon.hasApiKey()) return mockNews(ticker);
    try {
      const news = await polygon.fetchNews(ticker);
      if (news.length === 0) return mockNews(ticker);
      return news;
    } catch (err) {
      console.warn(`[marketData] News fallback to mock:`, (err as Error).message);
      return mockNews(ticker);
    }
  });
}
