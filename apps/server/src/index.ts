import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  DEFAULT_WATCHLIST,
  getHistory,
  getNews,
  getPortfolioNews,
  getWatchlistQuotes,
  search,
} from "./marketData.js";
import { getChartsOfTheDay } from "./chartsOfTheDay.js";
import { getCommoditiesSnapshot } from "./commodities.js";
import { getFxSnapshot } from "./fx.js";
import { getPortfolioImpact } from "./impact.js";
import { getMacroSnapshot } from "./macro.js";
import { getNavMonitoringSnapshot } from "./navMonitoring.js";
import { getPodcastMonitorSnapshot } from "./podcastMonitor.js";
import { getPortfolioSnapshot } from "./portfolio.js";
import { getPortfolioActivity } from "./portfolioActivity.js";
import { getResearch } from "./research.js";
import { getRnsFeed } from "./rns.js";
import { getUkGiltYields } from "./ukGilts.js";
import { getUstActivity } from "./ustActivity.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/api/health", async () => ({
  ok: true,
  dataSource: "yahoo",
}));

app.get("/api/watchlist", async (req) => {
  const query = req.query as { tickers?: string };
  const tickers = query.tickers ? query.tickers.split(",").filter(Boolean) : DEFAULT_WATCHLIST;
  return getWatchlistQuotes(tickers);
});

app.get("/api/history/:ticker", async (req, reply) => {
  const { ticker } = req.params as { ticker: string };
  const query = req.query as { days?: string };
  const days = Math.min(Math.max(Number(query.days ?? "90"), 5), 500);
  if (!ticker) {
    reply.code(400);
    return { error: "ticker is required" };
  }
  const bars = await getHistory(ticker.toUpperCase(), days);
  return { ticker: ticker.toUpperCase(), bars };
});

app.get("/api/search", async (req) => {
  const query = req.query as { q?: string };
  if (!query.q) return [];
  return search(query.q);
});

app.get("/api/news", async (req) => {
  const query = req.query as { ticker?: string };
  return getNews(query.ticker?.toUpperCase());
});

app.get("/api/news/portfolio", async (req) => {
  const query = req.query as { tickers?: string };
  const tickers = query.tickers ? query.tickers.split(",").filter(Boolean) : DEFAULT_WATCHLIST;
  return getPortfolioNews(tickers);
});

app.get("/api/research", async () => getResearch());

app.get("/api/portfolio", async () => getPortfolioSnapshot());

app.get("/api/portfolio/activity", async () => getPortfolioActivity());

app.get("/api/impact", async (req) => {
  const query = req.query as { tickers?: string };
  const tickers = query.tickers ? query.tickers.split(",").filter(Boolean) : DEFAULT_WATCHLIST;
  const [news, portfolio] = await Promise.all([getPortfolioNews(tickers), getPortfolioSnapshot()]);
  return getPortfolioImpact(news.slice(0, 12), portfolio);
});

app.get("/api/macro", async () => getMacroSnapshot());

app.get("/api/charts-of-the-day", async () => getChartsOfTheDay());

app.get("/api/ust-activity", async () => getUstActivity());

app.get("/api/fx", async () => getFxSnapshot());

app.get("/api/commodities", async () => getCommoditiesSnapshot());

app.get("/api/rns", async () => getRnsFeed());

app.get("/api/nav-monitoring", async () => getNavMonitoringSnapshot());

app.get("/api/podcast-monitor", async () => getPodcastMonitorSnapshot());

app.get("/api/uk-gilt-yields", async (_req, reply) => {
  try {
    return await getUkGiltYields();
  } catch (err) {
    reply.code(502);
    return { error: (err as Error).message };
  }
});

const port = Number(process.env.PORT ?? 4000);
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`ruff-term server listening on :${port} (data source: yahoo, mock fallback on error)`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
