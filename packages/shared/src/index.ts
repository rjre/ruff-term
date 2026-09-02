export interface WatchlistQuote {
  /** Primary ticker symbol, e.g. "AAPL" */
  ticker: string;
  /** Exchange/market suffix shown next to the ticker, e.g. "US", "LN", "HK" */
  exchange: string;
  shortName: string;
  lastPrice: number;
  /** Currency/unit suffix shown after the price, e.g. "c" for pence/cents */
  priceSuffix?: string;
  changePct1d: number;
  changePct2d: number;
  currency: string;
  updatedAt: string;
}

export interface SearchResult {
  ticker: string;
  name: string;
  exchange: string;
  market: string;
}

export interface PriceBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoryResponse {
  ticker: string;
  bars: PriceBar[];
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  tickers: string[];
}

export interface ApiErrorBody {
  error: string;
}

export interface ResearchItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  author: string;
  publishedAt: string;
  readTimeMinutes: number;
}

export interface AllocationLine {
  /** Top-level grouping (e.g. "Inflation" / "Protection" / "Growth") used to
   * color-code the breakdown chart. */
  category: string;
  label: string;
  pct: number;
}

export interface MagnitudeLine {
  label: string;
  pct: number;
}

export interface PerformanceFigure {
  period: string;
  valuePct: number;
}

export interface PortfolioHolding {
  name: string;
  pct: number;
}

export interface MacroLine {
  ticker: string;
  label: string;
  lastPrice: number;
  currency: string;
  /** true for rate/yield/vol index values that are already a "%" level, not a price */
  isRateLevel: boolean;
  changePct1d: number;
  netChange1d: number;
  changePctMtd: number;
  changePctYtd: number;
}

export interface MacroPanel {
  title: string;
  lines: MacroLine[];
}

export interface MacroSnapshot {
  asOf: string;
  panels: MacroPanel[];
}

export interface RegimeBarometerLine {
  ticker: string;
  label: string;
  group: "Growth" | "Protection";
  changePct1d: number;
}

export interface NewsThemeCount {
  theme: string;
  count: number;
}

export interface ChartsOfTheDaySnapshot {
  asOf: string;
  regimeBarometer: RegimeBarometerLine[];
  growthAvgPct: number;
  protectionAvgPct: number;
  newsThemes: NewsThemeCount[];
}

export interface G10Line {
  pair: string;
  ticker: string;
  lastPrice: number;
  changePct1d: number;
}

export interface FxSnapshot {
  asOf: string;
  g10: G10Line[];
}

export interface NavMonitoringCompany {
  ticker: string;
  name: string;
  navPence: number | null;
  navDate: string | null;
  sharePricePence: number | null;
  discountPct: number | null;
}

export interface NavMonitoringSnapshot {
  lastRefreshed: string;
  companies: NavMonitoringCompany[];
}

export interface PodcastMentionEntity {
  id: string;
  label: string;
  mentions: number;
  avgSentiment: number;
  momentumPct: number;
  trend: string;
  buyMentions: number;
  sellMentions: number;
}

export interface PodcastMonitorSnapshot {
  generatedAt: string;
  globalAvgSentiment: number;
  stocks: PodcastMentionEntity[];
  sectors: PodcastMentionEntity[];
  themes: PodcastMentionEntity[];
}

export interface UkGiltYieldLine {
  tenorYears: number;
  yieldPct: number;
  changeBp1d: number;
}

export interface UkGiltYieldSnapshot {
  asOfDate: string;
  lines: UkGiltYieldLine[];
  sourceLabel: string;
  sourceUrl: string;
}

export interface TreasuryEtfLine {
  ticker: string;
  label: string;
  lastPrice: number;
  changePct1d: number;
  volume: number;
  currency: string;
}

export interface UstVolumeLine {
  label: string;
  parValueBn: number;
}

export interface UstActivitySnapshot {
  asOf: string;
  etfs: TreasuryEtfLine[];
  demoVolumeBySubtype: UstVolumeLine[];
  demoVolumeByMaturity: UstVolumeLine[];
  sourceLabel: string;
  sourceUrl: string;
}

export interface PortfolioAction {
  id: string;
  date: string;
  ticker: string;
  name: string;
  action: "Buy" | "Sell" | "Add" | "Trim";
  quantity: number;
  price: number;
  currency: string;
  valueGBP: number;
  note: string;
}

export interface PortfolioActivitySnapshot {
  weekStart: string;
  actions: PortfolioAction[];
  totalBuysGBP: number;
  totalSellsGBP: number;
  netFlowGBP: number;
}

export interface ImpactedNewsItem extends NewsItem {
  /** 1-2 sentence take on what this headline means for the Ruffer portfolio. */
  impact: string;
  /** Whether the impact text came from a live model call or a rule-based fallback. */
  impactSource: "claude" | "heuristic";
}

export interface PortfolioSnapshot {
  fundName: string;
  /** ISO date the underlying factsheet is "as of". */
  asOfDate: string;
  sourceLabel: string;
  sourceUrl: string;
  fundSizeGBPm: number;
  performance: PerformanceFigure[];
  assetAllocation: AllocationLine[];
  currencyAllocation: MagnitudeLine[];
  geographicalEquityAllocation: MagnitudeLine[];
  topHoldings: PortfolioHolding[];
}
