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
