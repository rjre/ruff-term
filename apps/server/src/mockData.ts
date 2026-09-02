import type { NewsItem, PriceBar, SearchResult } from "@ruff-term/shared";

/** Known names for our seed watchlist so mock mode still looks realistic. */
export const KNOWN_NAMES: Record<string, string> = {
  AAPL: "Apple Inc",
  MSFT: "Microsoft Corp",
  AMZN: "Amazon.com Inc",
  GOOGL: "Alphabet Inc-A",
  NVDA: "Nvidia Corp",
  "BRK.B": "Berkshire Hathaway-B",
  JPM: "JPMorgan Chase & Co",
  XOM: "Exxon Mobil Corp",
  UNH: "Unitedhealth Group",
  V: "Visa Inc-A",
  TSLA: "Tesla Inc",
  META: "Meta Platforms-A",
};

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
    ([ticker, name]) =>
      ticker.includes(q) || name.toUpperCase().includes(q)
  );
  const results = entries.map(([ticker, name]) => ({
    ticker,
    name,
    exchange: "US",
    market: "stocks",
  }));
  if (results.length === 0) {
    results.push({
      ticker: q,
      name: `${q} (mock result)`,
      exchange: "US",
      market: "stocks",
    });
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
  const tickers = ticker ? [ticker] : Object.keys(KNOWN_NAMES).slice(0, 3);
  return MOCK_HEADLINES.map((headline, i) => ({
    id: `${seed}-${i}`,
    headline: `${ticker ?? "Market"} ${headline}`,
    source: "Mock Wire",
    url: "#",
    publishedAt: new Date(Date.now() - i * 3600_000 * (1 + rand() * 3)).toISOString(),
    tickers,
  }));
}
