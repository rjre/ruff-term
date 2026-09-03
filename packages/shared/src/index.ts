/**
 * True when a payload is fabricated fallback data rather than a real market
 * print — the upstream feed failed and the server substituted a plausible
 * shape so the UI keeps working. Anything carrying this MUST be labelled as
 * simulated wherever it is shown: an unmarked invented price is worse than a
 * blank cell.
 */
export interface MaybeSynthetic {
  synthetic?: boolean;
}

export interface WatchlistQuote extends MaybeSynthetic {
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
  changePct1w: number;
  changePct1m: number;
  changePct6m: number;
  changePct1y: number;
  currency: string;
  updatedAt: string;
  /** Shares traded on the most recent session. */
  volume: number;
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

export interface HistoryResponse extends MaybeSynthetic {
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
  /** Real quote tick time from the data source, not fetch time. */
  updatedAt: string;
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
  /** Real quote tick time from the data source, not fetch time. */
  updatedAt: string;
}

export interface FxSnapshot {
  asOf: string;
  g10: G10Line[];
}

export interface VolSurfacePoint {
  /** Puts and calls on one increasing axis: put delta for puts, 100 - call
   * delta for calls, 50 at the money. */
  u: number;
  label: string;
  volPct: number | null;
  /** "quoted" is a real Citi print; the rest come off the fitted spline, with
   * the 5-delta wings extrapolated past the quoted 10-90 range. */
  kind: "quoted" | "interpolated" | "extrapolated";
}

export interface VolSurfaceSnapshot {
  pair: string;
  tenor: string;
  /** Date of the underlying prints, not of the fetch. */
  asOfDate: string | null;
  /** The seven points Citi actually publishes. */
  quotes: VolSurfacePoint[];
  /** The full 5-delta ladder fitted through them. Empty if too few quotes. */
  curve: VolSurfacePoint[];
  /** Set when the data is stale or unavailable, and why. */
  note: string | null;
  /** Metered /data calls spent on this tenor's tags, against a limit of ~10. */
  callsSpent: number;
}

export interface GuideSection {
  label: string;
  text: string;
}

export interface GlobalMarketsGuideCountry {
  name: string;
  region: string | null;
  currency: string | null;
  timeZone: string | null;
  primaryExchange: string | null;
  website: string | null;
  hours: string | null;
  hoursSections: GuideSection[];
  primaryEquityIndex: string | null;
  bloombergTicker: string | null;
}

export interface MarketHolidayDay {
  date: string;
  preciousMetalsNote: string | null;
  currenciesClosed: string[];
}

export interface GlobalMarketsCalendarSnapshot {
  live: boolean;
  days: MarketHolidayDay[];
  sourceLabel: string;
  sourceUrl: string;
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
  /** Real quote tick time from the data source, not fetch time. */
  updatedAt: string;
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
}

export interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string;
  exchange: string;
  currency: string;
  lastPrice: number;
  changePct1d: number;
  changePct1w: number;
  changePct1m: number;
  changePct3m: number;
  changePctYtd: number;
  pctFrom52wHigh: number;
  pctFrom52wLow: number;
  /** Real quote tick time from the data source, not fetch time. */
  updatedAt: string;
}

export interface ScreenerSnapshot {
  asOf: string;
  rows: ScreenerRow[];
  /** Universe symbols the loader could not price this run (delisted, renamed
   * or upstream error). Surfaced so a shrinking table is visible rather than
   * silent. */
  skipped: string[];
}

export interface CftcPositioningLine {
  label: string;
  contractMarketCode: string;
  reportDate: string;
  openInterest: number;
  noncommLong: number;
  noncommShort: number;
  netNoncommPosition: number;
  netNoncommChange1w: number;
}

export interface CftcPositioningSnapshot {
  asOf: string;
  lines: CftcPositioningLine[];
  sourceLabel: string;
  sourceUrl: string;
}

export interface ShortPositionLine {
  name: string;
  isin: string;
  netShortPct: number;
  positionDate: string;
}

export interface ShortPositionHistoryPoint {
  netShortPct: number;
  positionDate: string;
}

export interface ShortPositionsSnapshot {
  asOf: string;
  top: ShortPositionLine[];
  history: Record<string, ShortPositionHistoryPoint[]>;
  sourceLabel: string;
  sourceUrl: string;
}

export interface InsiderTransaction {
  ticker: string;
  ownerName: string;
  isOfficer: boolean;
  isDirector: boolean;
  officerTitle: string | null;
  transactionDate: string;
  transactionCode: string;
  transactionCodeLabel: string;
  shares: number;
  pricePerShare: number | null;
  acquiredDisposed: "A" | "D";
  sharesOwnedAfter: number;
  filingUrl: string;
}

export interface OwnershipSnapshot {
  asOf: string;
  tickers: string[];
  transactions: InsiderTransaction[];
  sourceLabel: string;
  sourceUrl: string;
}

export interface BalanceSheetPoint {
  date: string;
  valueBn: number;
}

export interface CentralBankBalanceSheetSeries {
  bank: string;
  currency: string;
  sourceUrl: string;
  points: BalanceSheetPoint[];
}

export interface CentralBankBalanceSheetSnapshot {
  asOf: string;
  series: CentralBankBalanceSheetSeries[];
}

export interface InflationExpectationLine {
  label: string;
  valuePct: number;
  changeBp1d: number;
  asOfDate: string;
}

export interface InflationExpectationsSnapshot {
  lines: InflationExpectationLine[];
}

export interface DividendHistoryPayment {
  date: string;
  amount: number;
}

export interface DividendHistoryLine {
  ticker: string;
  shortName: string;
  currency: string;
  payments: DividendHistoryPayment[];
  estimatedNextDate: string | null;
}

export interface DividendsSnapshot {
  asOf: string;
  lines: DividendHistoryLine[];
}

export interface TreasuryAuctionLine {
  securityType: string;
  securityTerm: string;
  cusip: string;
  announcementDate: string;
  auctionDate: string;
  issueDate: string;
}

export interface TreasuryAuctionsSnapshot {
  asOf: string;
  auctions: TreasuryAuctionLine[];
}

export interface CorrelationMatrixSnapshot {
  asOf: string;
  tickers: string[];
  labels: string[];
  matrix: number[][];
  rangeDays: number;
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
