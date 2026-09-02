import type { NewsItem, SearchResult, WatchlistQuote } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import {
  DEFAULT_WATCHLIST as DEFAULT_WATCHLIST_META,
  KNOWN_NAMES,
  mockHistory,
  mockMeta,
  mockNews,
  mockQuote,
  mockSearch,
  NEWS_QUERIES,
} from "./mockData.js";
import * as yahoo from "./yahoo/client.js";
import type { PriceBar } from "@ruff-term/shared";

const quoteCache = new TtlCache<WatchlistQuote>(20_000);
const historyCache = new TtlCache<PriceBar[]>(5 * 60_000);
const searchCache = new TtlCache<SearchResult[]>(5 * 60_000);
const newsCache = new TtlCache<NewsItem[]>(2 * 60_000);

export const DEFAULT_WATCHLIST = DEFAULT_WATCHLIST_META.map((w) => w.ticker);

/** A bar older than this is treated as a stale/closed-market close rather
 * than a live tick, and gets the "c" (close) suffix real terminals use. */
const STALE_THRESHOLD_SECONDS = 20 * 60;

async function loadQuote(ticker: string): Promise<WatchlistQuote> {
  const now = new Date().toISOString();

  try {
    const { meta, bars } = await yahoo.fetchChart(ticker, "10d");
    if (bars.length < 2) throw new Error("insufficient bars from Yahoo");

    const latest = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const prevPrev = bars.length >= 3 ? bars[bars.length - 3] : prev;

    const lastPrice = meta.regularMarketPrice ?? latest.close;
    const changePct1d = pctChange(prev.close, lastPrice);
    const changePct2d = pctChange(prevPrev.close, prev.close);
    const isStale = Date.now() / 1000 - meta.regularMarketTime > STALE_THRESHOLD_SECONDS;

    return {
      ticker,
      exchange: yahoo.exchangeCodeFor(ticker),
      shortName: KNOWN_NAMES[ticker] ?? meta.longName ?? meta.shortName ?? ticker,
      lastPrice,
      priceSuffix: isStale ? "c" : undefined,
      changePct1d,
      changePct2d,
      currency: meta.currency,
      updatedAt: now,
    };
  } catch (err) {
    console.warn(`[marketData] Falling back to mock data for ${ticker}:`, (err as Error).message);
    const mock = mockQuote(ticker);
    const metaFallback = mockMeta(ticker);
    return {
      ticker,
      exchange: metaFallback.exchange,
      shortName: KNOWN_NAMES[ticker] ?? ticker,
      lastPrice: mock.lastPrice,
      changePct1d: mock.changePct1d,
      changePct2d: mock.changePct2d,
      currency: metaFallback.currency,
      updatedAt: now,
    };
  }
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return Math.round(((to - from) / from) * 10000) / 100;
}

export async function getQuote(ticker: string): Promise<WatchlistQuote> {
  return quoteCache.getOrLoad(ticker, () => loadQuote(ticker));
}

export async function getWatchlistQuotes(tickers: string[]): Promise<WatchlistQuote[]> {
  return Promise.all(tickers.map(getQuote));
}

const RANGE_BY_DAYS = (days: number): string => {
  if (days <= 7) return "1mo";
  if (days <= 35) return "3mo";
  if (days <= 100) return "6mo";
  if (days <= 200) return "1y";
  if (days <= 500) return "2y";
  return "5y";
};

export async function getHistory(ticker: string, days: number): Promise<PriceBar[]> {
  return historyCache.getOrLoad(`${ticker}:${days}`, async () => {
    try {
      const { bars } = await yahoo.fetchChart(ticker, RANGE_BY_DAYS(days));
      if (bars.length === 0) throw new Error("no bars returned");
      return bars.slice(-days);
    } catch (err) {
      console.warn(`[marketData] History fallback to mock for ${ticker}:`, (err as Error).message);
      return mockHistory(ticker, days);
    }
  });
}

export async function search(query: string): Promise<SearchResult[]> {
  return searchCache.getOrLoad(query.toLowerCase(), async () => {
    try {
      const results = await yahoo.searchTickers(query);
      if (results.length === 0) return mockSearch(query);
      return results;
    } catch (err) {
      console.warn(`[marketData] Search fallback to mock for "${query}":`, (err as Error).message);
      return mockSearch(query);
    }
  });
}

const STOPWORDS = new Set(["inc", "corp", "corporation", "ltd", "limited", "co", "the", "group", "plc"]);

/** Yahoo's search endpoint pads out a query's "news" results with unrelated
 * trending stories when it has nothing specific to return, with no way to
 * tell the two apart from the response alone. Require the headline to
 * actually mention a real word from the query, so a quiet ticker shows no
 * news rather than someone else's football or healthcare story. */
function filterRelevant(items: NewsItem[], query: string): NewsItem[] {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (keywords.length === 0) return items;
  return items.filter((item) => {
    const headline = item.headline.toLowerCase();
    return keywords.some((k) => headline.includes(k));
  });
}

export async function getNews(ticker?: string): Promise<NewsItem[]> {
  return newsCache.getOrLoad(ticker ?? "__market__", async () => {
    try {
      if (!ticker) {
        // Market-wide tab: broad trending financial headlines are the point.
        const news = await yahoo.fetchNews("global stock markets");
        if (news.length === 0) return mockNews(undefined);
        return news;
      }

      // A bare/suffixed ticker symbol (e.g. "0788.HK") or a mangled
      // Bloomberg-style short name searches poorly on Yahoo and falls back
      // to irrelevant "trending" results, so prefer a clean company name.
      const query = NEWS_QUERIES[ticker] ?? ticker.split(".")[0];
      const news = filterRelevant(await yahoo.fetchNews(query), query);
      if (news.length === 0) return [];
      return news.map((n) => ({ ...n, tickers: [ticker] }));
    } catch (err) {
      console.warn(`[marketData] News fallback to mock:`, (err as Error).message);
      return mockNews(ticker);
    }
  });
}

/** News across every ticker currently on the watchlist, used as a stand-in
 * "portfolio newsflow" view until real Ruffer holdings data is wired in. */
export async function getPortfolioNews(tickers: string[]): Promise<NewsItem[]> {
  const perTicker = await Promise.all(tickers.map((t) => getNews(t)));
  const merged = perTicker.flat();
  const seen = new Set<string>();
  const deduped = merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return deduped.slice(0, 20);
}
