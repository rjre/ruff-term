import type { ChartsOfTheDaySnapshot, RegimeBarometerLine } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import { DEFAULT_WATCHLIST, getPortfolioNews, getQuote } from "./marketData.js";
import { classifyHeadline } from "./newsThemes.js";

/** Liquid, real proxies for Ruffer's own public "growth" vs "protection"
 * asset-allocation categories (see the TM Ruffer Portfolio factsheet), used
 * to read today's market regime rather than any single stock. */
const REGIME_PROXIES: Array<{ ticker: string; label: string; group: "Growth" | "Protection" }> = [
  { ticker: "SPY", label: "S&P 500 (SPY)", group: "Growth" },
  { ticker: "QQQ", label: "Nasdaq 100 (QQQ)", group: "Growth" },
  { ticker: "EEM", label: "Emerging Mkts (EEM)", group: "Growth" },
  { ticker: "EFA", label: "Developed ex-US (EFA)", group: "Growth" },
  { ticker: "GLD", label: "Gold (GLD)", group: "Protection" },
  { ticker: "TLT", label: "20yr+ Treasuries (TLT)", group: "Protection" },
  { ticker: "IEF", label: "7-10yr Treasuries (IEF)", group: "Protection" },
  { ticker: "FXY", label: "Japanese Yen (FXY)", group: "Protection" },
];

const cache = new TtlCache<ChartsOfTheDaySnapshot>(60_000);

async function loadSnapshot(): Promise<ChartsOfTheDaySnapshot> {
  const [barometerResults, news] = await Promise.all([
    Promise.all(
      REGIME_PROXIES.map(async (p): Promise<RegimeBarometerLine | null> => {
        try {
          const quote = await getQuote(p.ticker);
          return { ticker: p.ticker, label: p.label, group: p.group, changePct1d: quote.changePct1d };
        } catch {
          return null;
        }
      })
    ),
    getPortfolioNews(DEFAULT_WATCHLIST),
  ]);

  const regimeBarometer = barometerResults.filter((l): l is RegimeBarometerLine => l !== null);
  const growthLines = regimeBarometer.filter((l) => l.group === "Growth");
  const protectionLines = regimeBarometer.filter((l) => l.group === "Protection");
  const avg = (lines: RegimeBarometerLine[]) =>
    lines.length ? Math.round((lines.reduce((s, l) => s + l.changePct1d, 0) / lines.length) * 100) / 100 : 0;

  const themeCounts = new Map<string, number>();
  for (const item of news) {
    const theme = classifyHeadline(item.headline);
    themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
  }
  const newsThemes = [...themeCounts.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);

  return {
    asOf: new Date().toISOString(),
    regimeBarometer,
    growthAvgPct: avg(growthLines),
    protectionAvgPct: avg(protectionLines),
    newsThemes,
  };
}

export async function getChartsOfTheDay(): Promise<ChartsOfTheDaySnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
