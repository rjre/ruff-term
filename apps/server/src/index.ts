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
