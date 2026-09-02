import type { NewsItem, PriceBar, SearchResult } from "@ruff-term/shared";

/** Default global watchlist. Ticker is the real Yahoo Finance symbol
 * (verified to resolve); exchange/currency are used only when Yahoo is
 * unreachable and we fall back to mock data. */
export const DEFAULT_WATCHLIST: Array<{
  ticker: string;
  shortName: string;
  /** Plain company name used when querying news search — Yahoo's search
   * falls back to irrelevant "trending" results for mangled Bloomberg-style
   * short names (e.g. "CHINA TOWER CO-H" or a bare suffixed ticker). */
  newsQuery: string;
  exchange: string;
  currency: string;
}> = [
  { ticker: "VPK.AS", shortName: "VOPAK", newsQuery: "Vopak", exchange: "NA", currency: "EUR" },
  { ticker: "FLNG", shortName: "FLEX LNG LTD", newsQuery: "Flex LNG", exchange: "US", currency: "USD" },
  { ticker: "SFL", shortName: "SFL CORP LTD", newsQuery: "SFL Corporation", exchange: "US", currency: "USD" },
  { ticker: "DAC", shortName: "DANAOS CORP", newsQuery: "Danaos Corporation", exchange: "US", currency: "USD" },
  {
    ticker: "0788.HK",
    shortName: "CHINA TOWER CO-H",
    newsQuery: "China Tower",
    exchange: "HK",
    currency: "HKD",
  },
  { ticker: "SOBO", shortName: "SOUTH BOW CORP", newsQuery: "South Bow Corporation", exchange: "US", currency: "USD" },
  {
    ticker: "RRR",
    shortName: "RED ROCK RESOR-A",
    newsQuery: "Red Rock Resorts",
    exchange: "US",
    currency: "USD",
  },
  {
    ticker: "AZJ.AX",
    shortName: "AURIZON HOLDINGS",
    newsQuery: "Aurizon Holdings",
    exchange: "AU",
    currency: "AUD",
  },
  {
    ticker: "AM",
    shortName: "ANTERO MIDSTREAM",
    newsQuery: "Antero Midstream",
    exchange: "US",
    currency: "USD",
  },
  { ticker: "0001.HK", shortName: "CKH HOLDINGS", newsQuery: "CK Hutchison", exchange: "HK", currency: "HKD" },
  { ticker: "ML.PA", shortName: "MICHELIN", newsQuery: "Michelin", exchange: "FP", currency: "EUR" },
  {
    ticker: "NSIS-B.CO",
    shortName: "NOVONESIS (NOVOZ)",
    newsQuery: "Novonesis",
    exchange: "DC",
    currency: "DKK",
  },
  { ticker: "1605.T", shortName: "INPEX CORP", newsQuery: "Inpex Corporation", exchange: "JP", currency: "JPY" },
  { ticker: "BCE.TO", shortName: "BCE INC", newsQuery: "BCE Inc", exchange: "CN", currency: "CAD" },
  { ticker: "DTM", shortName: "DT MIDSTREAM", newsQuery: "DT Midstream", exchange: "US", currency: "USD" },
  {
    ticker: "CNR.TO",
    shortName: "CAN NATL RAILWAY",
    newsQuery: "Canadian National Railway",
    exchange: "CN",
    currency: "CAD",
  },
  { ticker: "TRP.TO", shortName: "TC ENERGY CORP", newsQuery: "TC Energy", exchange: "CN", currency: "CAD" },
  { ticker: "BHP.AX", shortName: "BHP GROUP LTD", newsQuery: "BHP Group", exchange: "AU", currency: "AUD" },
  {
    ticker: "CNQ.TO",
    shortName: "CAN NATURAL RES",
    newsQuery: "Canadian Natural Resources",
    exchange: "CN",
    currency: "CAD",
  },
];

export const KNOWN_NAMES: Record<string, string> = Object.fromEntries(
  DEFAULT_WATCHLIST.map((w) => [w.ticker, w.shortName])
);

export const NEWS_QUERIES: Record<string, string> = Object.fromEntries(
  DEFAULT_WATCHLIST.map((w) => [w.ticker, w.newsQuery])
);

const KNOWN_META: Record<string, { exchange: string; currency: string }> = Object.fromEntries(
  DEFAULT_WATCHLIST.map((w) => [w.ticker, { exchange: w.exchange, currency: w.currency }])
);

/** Simple deterministic PRNG (mulberry32) seeded from a string, so a given
 * ticker always renders the same mock numbers within a process lifetime
 * instead of jumping around on every request. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function mockMeta(ticker: string): { exchange: string; currency: string } {
  return KNOWN_META[ticker] ?? { exchange: "US", currency: "USD" };
}

export function mockQuote(ticker: string): {
  lastPrice: number;
  changePct1d: number;
  changePct2d: number;
} {
  const rand = seededRandom(ticker + new Date().toISOString().slice(0, 10));
  const basePrice = 20 + rand() * 480;
  const changePct1d = (rand() - 0.5) * 6;
  const changePct2d = (rand() - 0.5) * 6;
  return {
    lastPrice: Math.round(basePrice * 100) / 100,
    changePct1d: Math.round(changePct1d * 100) / 100,
    changePct2d: Math.round(changePct2d * 100) / 100,
  };
}

export function mockHistory(ticker: string, days: number): PriceBar[] {
  const rand = seededRandom(ticker);
  let price = 20 + rand() * 480;
  const bars: PriceBar[] = [];
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 86400;
  for (let i = days; i >= 0; i--) {
    const drift = (rand() - 0.48) * price * 0.03;
    const open = price;
    price = Math.max(1, price + drift);
    const close = price;
    const high = Math.max(open, close) * (1 + rand() * 0.01);
    const low = Math.min(open, close) * (1 - rand() * 0.01);
    bars.push({
      time: now - i * dayInSeconds,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(rand() * 5_000_000) + 100_000,
    });
  }
  return bars;
}

export function mockSearch(query: string): SearchResult[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const entries = Object.entries(KNOWN_NAMES).filter(
    ([ticker, name]) => ticker.includes(q) || name.toUpperCase().includes(q)
  );
  const results = entries.map(([ticker, name]) => ({
    ticker,
    name,
    exchange: mockMeta(ticker).exchange,
    market: "stocks",
  }));
  if (results.length === 0) {
    results.push({ ticker: q, name: `${q} (mock result)`, exchange: "US", market: "stocks" });
  }
  return results.slice(0, 10);
}

const MOCK_HEADLINES = [
  "shares move on broad market volatility",
  "analysts weigh in ahead of next earnings report",
  "trading volume picks up in afternoon session",
  "reports steady demand across core markets",
  "management comments on capital allocation plans",
];

export function mockNews(ticker: string | undefined): NewsItem[] {
  const seed = ticker ?? "MARKET";
  const rand = seededRandom(seed);
  const tickers = ticker ? [ticker] : DEFAULT_WATCHLIST.slice(0, 3).map((w) => w.ticker);
  const label = ticker ? KNOWN_NAMES[ticker] ?? ticker : "Market";
  return MOCK_HEADLINES.map((headline, i) => ({
    id: `${seed}-${i}`,
    headline: `${label} ${headline}`,
    source: "Mock Wire",
    url: "#",
    publishedAt: new Date(Date.now() - i * 3600_000 * (1 + rand() * 3)).toISOString(),
    tickers,
  }));
}
