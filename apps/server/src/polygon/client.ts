import type { NewsItem, PriceBar, SearchResult } from "@ruff-term/shared";

const POLYGON_BASE = "https://api.polygon.io";

export function hasApiKey(): boolean {
  return Boolean(process.env.POLYGON_API_KEY);
}

async function polygonGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error("POLYGON_API_KEY not configured");

  const url = new URL(POLYGON_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Polygon ${path} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface PolygonAggsResponse {
  results?: Array<{
    t: number; // ms epoch
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  }>;
}

/** Daily bars for `days` most recent trading days, oldest first. Polygon's
 * free tier only serves end-of-day data, so "latest" here means the most
 * recent completed trading session, not a live intraday price. */
export async function fetchDailyBars(ticker: string, days: number): Promise<PriceBar[]> {
  const to = new Date();
  const from = new Date();
  // Pad the window generously to absorb weekends/holidays.
  from.setDate(from.getDate() - Math.ceil(days * 2.2) - 5);

  const data = await polygonGet<PolygonAggsResponse>(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${isoDate(from)}/${isoDate(to)}`,
    { adjusted: "true", sort: "asc", limit: "500" }
  );

  const bars: PriceBar[] = (data.results ?? []).map((r) => ({
    time: Math.floor(r.t / 1000),
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v,
  }));

  return bars.slice(-days);
}

interface PolygonTickerDetailsResponse {
  results?: {
    name?: string;
    primary_exchange?: string;
    currency_name?: string;
  };
}

export async function fetchTickerDetails(
  ticker: string
): Promise<{ name: string; exchange: string; currency: string }> {
  const data = await polygonGet<PolygonTickerDetailsResponse>(
    `/v3/reference/tickers/${encodeURIComponent(ticker)}`
  );
  return {
    name: data.results?.name ?? ticker,
    exchange: mapExchange(data.results?.primary_exchange),
    currency: (data.results?.currency_name ?? "usd").toUpperCase(),
  };
}

function mapExchange(primaryExchange?: string): string {
  switch (primaryExchange) {
    case "XNAS":
      return "US";
    case "XNYS":
      return "US";
    case "ARCX":
      return "US";
    default:
      return "US";
  }
}

interface PolygonTickerSearchResponse {
  results?: Array<{
    ticker: string;
    name: string;
    primary_exchange?: string;
    market?: string;
  }>;
}

export async function searchTickers(query: string): Promise<SearchResult[]> {
  const data = await polygonGet<PolygonTickerSearchResponse>("/v3/reference/tickers", {
    search: query,
    active: "true",
    limit: "10",
  });
  return (data.results ?? []).map((r) => ({
    ticker: r.ticker,
    name: r.name,
    exchange: mapExchange(r.primary_exchange),
    market: r.market ?? "stocks",
  }));
}

interface PolygonNewsResponse {
  results?: Array<{
    id: string;
    title: string;
    publisher?: { name?: string };
    article_url: string;
    published_utc: string;
    tickers?: string[];
  }>;
}

export async function fetchNews(ticker?: string): Promise<NewsItem[]> {
  const params: Record<string, string> = { limit: "12", order: "desc", sort: "published_utc" };
  if (ticker) params.ticker = ticker;
  const data = await polygonGet<PolygonNewsResponse>("/v2/reference/news", params);
  return (data.results ?? []).map((r) => ({
    id: r.id,
    headline: r.title,
    source: r.publisher?.name ?? "Unknown",
    url: r.article_url,
    publishedAt: r.published_utc,
    tickers: r.tickers ?? [],
  }));
}
