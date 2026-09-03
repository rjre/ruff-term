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
import { includesWord } from "./textMatch.js";
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

/** Last bar strictly before `cutoffSeconds`, from ascending-sorted bars. */
function baseBefore(bars: PriceBar[], cutoffSeconds: number): PriceBar | null {
  let base: PriceBar | null = null;
  for (const b of bars) {
    if (b.time < cutoffSeconds) base = b;
    else break;
  }
  return base;
}

async function loadQuote(ticker: string): Promise<WatchlistQuote> {
  const now = new Date().toISOString();

  try {
    const { meta, bars } = await yahoo.fetchChart(ticker, "1y");
    if (bars.length < 2) throw new Error("insufficient bars from Yahoo");

    const latest = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const prevPrev = bars.length >= 3 ? bars[bars.length - 3] : prev;

    const lastPrice = meta.regularMarketPrice ?? latest.close;
    const changePct1d = pctChange(prev.close, lastPrice);
    const changePct2d = pctChange(prevPrev.close, prev.close);
    const isStale = Date.now() / 1000 - meta.regularMarketTime > STALE_THRESHOLD_SECONDS;

    const nowMs = Date.now();
    const weekBase = baseBefore(bars, (nowMs - 7 * 86_400_000) / 1000) ?? bars[0];
    const monthBase = baseBefore(bars, (nowMs - 30 * 86_400_000) / 1000) ?? bars[0];
    const sixMonthBase = baseBefore(bars, (nowMs - 182 * 86_400_000) / 1000) ?? bars[0];
    const yearBase = baseBefore(bars, (nowMs - 365 * 86_400_000) / 1000) ?? bars[0];

    return {
      ticker,
      exchange: yahoo.exchangeCodeFor(ticker),
      shortName: KNOWN_NAMES[ticker] ?? meta.longName ?? meta.shortName ?? ticker,
      lastPrice,
      priceSuffix: isStale ? "c" : undefined,
      changePct1d,
      changePct2d,
      changePct1w: pctChange(weekBase.close, lastPrice),
      changePct1m: pctChange(monthBase.close, lastPrice),
      changePct6m: pctChange(sixMonthBase.close, lastPrice),
      changePct1y: pctChange(yearBase.close, lastPrice),
      currency: meta.currency,
      // The real per-quote tick time from Yahoo, not when we happened to
      // fetch it — the two can diverge by many hours once a market closes.
      updatedAt: new Date(meta.regularMarketTime * 1000).toISOString(),
      volume: latest.volume,
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
      changePct1w: mock.changePct1w,
      changePct1m: mock.changePct1m,
      changePct6m: mock.changePct6m,
      changePct1y: mock.changePct1y,
      currency: metaFallback.currency,
      updatedAt: now,
      volume: mock.volume,
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
  if (days <= 1300) return "5y";
  if (days <= 2600) return "10y";
  return "max";
};

/** "1D"/"1W" chart ranges need real intraday bar spacing — a single daily
 * bar (or seven of them) isn't a useful chart. */
const INTRADAY_BY_DAYS: Record<number, { range: string; interval: string }> = {
  1: { range: "1d", interval: "5m" },
  7: { range: "5d", interval: "30m" },
};

export async function getHistory(ticker: string, days: number): Promise<PriceBar[]> {
  return historyCache.getOrLoad(`${ticker}:${days}`, async () => {
    try {
      const intraday = INTRADAY_BY_DAYS[days];
      if (intraday) {
        const { bars } = await yahoo.fetchChart(ticker, intraday.range, intraday.interval);
        if (bars.length === 0) throw new Error("no intraday bars returned");
        return bars;
      }
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
  return items.filter((item) => keywords.some((k) => includesWord(item.headline, k)));
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
