import type { NewsItem } from "@ruff-term/shared";
import { LiveCache } from "./cache.js";
import { mapLimit, YAHOO_CONCURRENCY } from "./concurrency.js";
import { includesWord } from "./textMatch.js";
import * as yahoo from "./yahoo/client.js";

/**
 * There is no free, keyless official RNS (Regulatory News Service) feed —
 * the real thing is licensed either straight from LSEG or through a paid
 * aggregator (ticker.app, Investegate's API via Apify, etc). This is an
 * honest stand-in: general company news for a set of large UK-listed
 * companies via Yahoo, NOT the official RNS regulatory filing feed. Real
 * RNS integration needs one of those licensed sources.
 */
const UK_LISTED_COMPANIES: Array<{ ticker: string; name: string }> = [
  { ticker: "SHEL.L", name: "Shell" },
  { ticker: "BP.L", name: "BP" },
  { ticker: "HSBA.L", name: "HSBC" },
  { ticker: "AZN.L", name: "AstraZeneca" },
  { ticker: "ULVR.L", name: "Unilever" },
  { ticker: "DGE.L", name: "Diageo" },
  { ticker: "GSK.L", name: "GSK" },
  { ticker: "VOD.L", name: "Vodafone" },
  { ticker: "BA.L", name: "BAE Systems" },
  { ticker: "RIO.L", name: "Rio Tinto" },
  { ticker: "BARC.L", name: "Barclays" },
  { ticker: "LLOY.L", name: "Lloyds Banking Group" },
  { ticker: "NG.L", name: "National Grid" },
  { ticker: "TSCO.L", name: "Tesco" },
  { ticker: "RR.L", name: "Rolls-Royce" },
];

const STOPWORDS = new Set(["group", "banking", "plc"]);

function filterRelevant(items: NewsItem[], name: string): NewsItem[] {
  const keywords = name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return items.filter((item) => keywords.some((k) => includesWord(item.headline, k)));
}

// Fetched only on mount (tab visit or the header's Refresh button, which
// fully remounts the active view), never polled — a TTL cache here would
// just make Refresh look like it does nothing. `fetchNews` has no cache of
// its own (unlike fetchChart's 15s one), so this paces the 15 companies
// through YAHOO_CONCURRENCY rather than firing them all at once.
const cache = new LiveCache<NewsItem[]>();

async function loadFeed(): Promise<NewsItem[]> {
  const perCompany = await mapLimit(
    UK_LISTED_COMPANIES,
    YAHOO_CONCURRENCY,
    async (c): Promise<NewsItem[]> => {
      try {
        const news = await yahoo.fetchNews(c.name);
        return filterRelevant(news, c.name).map((n) => ({ ...n, tickers: [c.ticker] }));
      } catch (err) {
        console.warn(`[rns] Skipping ${c.name}:`, (err as Error).message);
        return [];
      }
    },
  );

  const merged = perCompany.flat();
  const seen = new Set<string>();
  const deduped = merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return deduped.slice(0, 30);
}

export async function getRnsFeed(): Promise<NewsItem[]> {
  return cache.get("feed", loadFeed);
}
