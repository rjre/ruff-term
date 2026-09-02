import type { HistoryResponse, NewsItem, SearchResult, WatchlistQuote } from "@ruff-term/shared";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed: ${path} (${res.status})`);
  return (await res.json()) as T;
}

export function fetchWatchlist(tickers?: string[]): Promise<WatchlistQuote[]> {
  const qs = tickers && tickers.length ? `?tickers=${tickers.join(",")}` : "";
  return getJson(`/api/watchlist${qs}`);
}

export function fetchHistory(ticker: string, days = 90): Promise<HistoryResponse> {
  return getJson(`/api/history/${encodeURIComponent(ticker)}?days=${days}`);
}

export function fetchSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return Promise.resolve([]);
  return getJson(`/api/search?q=${encodeURIComponent(query)}`);
}

export function fetchNews(ticker?: string): Promise<NewsItem[]> {
  const qs = ticker ? `?ticker=${encodeURIComponent(ticker)}` : "";
  return getJson(`/api/news${qs}`);
}

export function fetchPortfolioNews(tickers: string[]): Promise<NewsItem[]> {
  const qs = tickers.length ? `?tickers=${tickers.join(",")}` : "";
  return getJson(`/api/news/portfolio${qs}`);
}
