import type {
  CentralBankBalanceSheetSnapshot,
  CftcPositioningSnapshot,
  ChartsOfTheDaySnapshot,
  CorrelationMatrixSnapshot,
  FxSnapshot,
  GlobalMarketsCalendarSnapshot,
  GlobalMarketsGuideCountry,
  HistoryResponse,
  ImpactedNewsItem,
  MacroSnapshot,
  NavMonitoringSnapshot,
  NewsItem,
  OwnershipSnapshot,
  PodcastMonitorSnapshot,
  PortfolioActivitySnapshot,
  PortfolioSnapshot,
  ResearchItem,
  ScreenerSnapshot,
  SearchResult,
  ShortPositionsSnapshot,
  UkGiltYieldSnapshot,
  UstActivitySnapshot,
  WatchlistQuote,
} from "@ruff-term/shared";

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

export function fetchResearch(): Promise<ResearchItem[]> {
  return getJson("/api/research");
}

export function fetchPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  return getJson("/api/portfolio");
}

export function fetchPortfolioActivity(): Promise<PortfolioActivitySnapshot> {
  return getJson("/api/portfolio/activity");
}

export function fetchImpact(): Promise<ImpactedNewsItem[]> {
  return getJson("/api/impact");
}

export function fetchMacro(): Promise<MacroSnapshot> {
  return getJson("/api/macro");
}

export function fetchChartsOfTheDay(): Promise<ChartsOfTheDaySnapshot> {
  return getJson("/api/charts-of-the-day");
}

export function fetchUstActivity(): Promise<UstActivitySnapshot> {
  return getJson("/api/ust-activity");
}

export function fetchFx(): Promise<FxSnapshot> {
  return getJson("/api/fx");
}

export function fetchCommodities(): Promise<MacroSnapshot> {
  return getJson("/api/commodities");
}

export function fetchRns(): Promise<NewsItem[]> {
  return getJson("/api/rns");
}

export function fetchUkGiltYields(): Promise<UkGiltYieldSnapshot> {
  return getJson("/api/uk-gilt-yields");
}

export function fetchGlobalMarketsCalendar(): Promise<GlobalMarketsCalendarSnapshot> {
  return getJson("/api/global-markets-calendar");
}

export function fetchGlobalMarketsGuide(): Promise<GlobalMarketsGuideCountry[]> {
  return getJson("/api/global-markets-guide");
}

export function fetchNavMonitoring(): Promise<NavMonitoringSnapshot> {
  return getJson("/api/nav-monitoring");
}

export function fetchPodcastMonitor(): Promise<PodcastMonitorSnapshot> {
  return getJson("/api/podcast-monitor");
}

export function fetchScreener(): Promise<ScreenerSnapshot> {
  return getJson("/api/screener");
}

export function fetchCftcPositioning(): Promise<CftcPositioningSnapshot> {
  return getJson("/api/cftc-positioning");
}

export function fetchShortPositions(): Promise<ShortPositionsSnapshot> {
  return getJson("/api/short-positions");
}

export function fetchOwnership(): Promise<OwnershipSnapshot> {
  return getJson("/api/ownership");
}

export function fetchCentralBankBalanceSheets(): Promise<CentralBankBalanceSheetSnapshot> {
  return getJson("/api/central-bank-balance-sheets");
}

export function fetchCorrelationMatrix(days: number): Promise<CorrelationMatrixSnapshot> {
  return getJson(`/api/correlation?days=${days}`);
}
