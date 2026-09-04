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
import { getCentralBankBalanceSheets } from "./centralBankBalanceSheets.js";
import { getCentralBankMeetings } from "./centralBankMeetings.js";
import { getCftcPositioning } from "./cftcPositioning.js";
import { getChartsOfTheDay } from "./chartsOfTheDay.js";
import { getCommoditiesSnapshot } from "./commodities.js";
import { getCorrelationMatrix } from "./correlation.js";
import { getDividends } from "./dividends.js";
import { getFxSnapshot } from "./fx.js";
import { getG10Grid } from "./citi/g10.js";
import { TAGS as G10_TAGS } from "@ruff-term/shared";
import { citiStream, type LiveTick } from "./citi/streaming.js";
import * as citiTags from "./citi/tags.js";
import {
  PAIRS as VOL_PAIRS,
  TENORS as VOL_TENORS,
  getVolSurface,
} from "./citi/volSurface.js";
import { getGlobalMarketsCalendar } from "./globalMarketsCalendar.js";
import { getGlobalMarketsGuide } from "./globalMarketsGuide.js";
import { getPortfolioImpact } from "./impact.js";
import { getInflationExpectations } from "./inflationExpectations.js";
import { getMacroSnapshot } from "./macro.js";
import { getNavMonitoringSnapshot } from "./navMonitoring.js";
import { getOwnershipSnapshot } from "./ownership.js";
import { getPodcastMonitorSnapshot } from "./podcastMonitor.js";
import { getPortfolioSnapshot } from "./portfolio.js";
import { getPortfolioActivity } from "./portfolioActivity.js";
import { getResearch } from "./research.js";
import { getRnsFeed } from "./rns.js";
import { getScreenerSnapshot } from "./screener.js";
import { getShortPositions } from "./shortPositions.js";
import { getTreasuryAuctions } from "./treasuryAuctions.js";
import { getUkGiltYields } from "./ukGilts.js";
import { getUstActivity } from "./ustActivity.js";

const OWNERSHIP_TICKERS = ["FLNG", "SFL", "DAC", "SOBO", "RRR", "AM", "DTM"];

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
  const days = Math.min(Math.max(Number(query.days ?? "90"), 1), 20_000);
  if (!ticker) {
    reply.code(400);
    return { error: "ticker is required" };
  }
  const { bars, synthetic } = await getHistory(ticker.toUpperCase(), days);
  return { ticker: ticker.toUpperCase(), bars, synthetic };
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

app.get("/api/inflation-expectations", async () => getInflationExpectations());

app.get("/api/charts-of-the-day", async () => getChartsOfTheDay());

app.get("/api/ust-activity", async () => getUstActivity());

app.get("/api/fx", async () => getFxSnapshot());

/**
 * Citi Velocity implied-vol smile. Fetched on demand per (pair, tenor) and
 * cached to disk for 12h: Citi meters this endpoint at roughly ten calls per
 * tag for the life of the account, so it is not something to poll.
 */
app.get("/api/fx/vol-surface", async (req, reply) => {
  const query = req.query as { pair?: string; tenor?: string };
  const pair = query.pair ?? VOL_PAIRS[0];
  const tenor = query.tenor ?? "1M";
  if (!VOL_PAIRS.includes(pair) || !VOL_TENORS.includes(tenor)) {
    reply.code(400);
    return { error: "unsupported pair or tenor" };
  }
  return getVolSurface(pair, tenor);
});

app.get("/api/fx/vol-surface/options", async () => ({
  pairs: VOL_PAIRS,
  tenors: VOL_TENORS,
}));

/**
 * Citi Data tab.
 *
 * /catalog and /browse hit `/tagbrowsing` and `/taglisting`, the two
 * endpoints Citi does NOT meter — so the tag tree can be explored freely.
 * /g10 is the one metered call here, cached to disk for 12h like the vol
 * surface.
 */
app.get("/api/citi/browse", async (req) => {
  const query = req.query as { prefix?: string };
  const prefix = (query.prefix ?? "FX").toUpperCase();
  const level = await citiTags.browse(prefix);
  return { prefix, ...level };
});

app.get("/api/citi/inventory", async (req) => {
  const query = req.query as { prefix?: string };
  const prefix = (query.prefix ?? "FX").toUpperCase();
  return citiTags.inventory(prefix);
});

app.get("/api/citi/catalog", async () => citiTags.catalog());

app.get("/api/citi/g10", async () => getG10Grid());

app.get("/api/citi/stream/status", async () => ({
  ...citiStream.getState(),
  ticks: [...citiStream.getLatest().values()],
}));

/**
 * Live G10 spot ticks, pushed over Server-Sent Events.
 *
 * The streaming websocket does NOT draw on the per-tag /data budget, so this
 * is the one place in the app where Citi data can update continuously. It
 * does have its own limits — one connection per login, ~100 connects a day —
 * so the upstream socket is opened on the first browser subscriber and closed
 * again once the last one goes away.
 */
app.get("/api/citi/stream", (req, reply) => {
  citiStream.want(G10_TAGS);

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Without this an intermediate proxy will happily buffer the whole stream.
    "X-Accel-Buffering": "no",
  });

  function send(event: string, data: unknown): void {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const detach = citiStream.attach();
  // Seed the client with whatever has already arrived, so a late joiner is
  // not staring at an empty grid until the next minute ticks.
  send("state", citiStream.getState());
  send("ticks", [...citiStream.getLatest().values()]);

  const onTicks = (ticks: LiveTick[]) => send("ticks", ticks);
  const onState = (state: unknown) => send("state", state);
  citiStream.on("ticks", onTicks);
  citiStream.on("state", onState);

  // Comment frames keep intermediaries from dropping an idle connection —
  // MI01 means a quiet market can go a full minute with nothing to say.
  const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);

  req.raw.on("close", () => {
    clearInterval(heartbeat);
    citiStream.off("ticks", onTicks);
    citiStream.off("state", onState);
    detach();
  });
});

app.get("/api/commodities", async () => getCommoditiesSnapshot());

app.get("/api/rns", async () => getRnsFeed());

app.get("/api/global-markets-calendar", async () => getGlobalMarketsCalendar());

app.get("/api/global-markets-guide", async () => getGlobalMarketsGuide());

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

app.get("/api/dividends", async (req) => {
  const query = req.query as { tickers?: string };
  const tickers = query.tickers ? query.tickers.split(",").filter(Boolean) : DEFAULT_WATCHLIST;
  return getDividends(tickers);
});

app.get("/api/screener", async () => getScreenerSnapshot());

app.get("/api/cftc-positioning", async () => getCftcPositioning());

app.get("/api/short-positions", async (_req, reply) => {
  try {
    return await getShortPositions();
  } catch (err) {
    reply.code(502);
    return { error: (err as Error).message };
  }
});

app.get("/api/ownership", async () => getOwnershipSnapshot(OWNERSHIP_TICKERS));

app.get("/api/central-bank-balance-sheets", async () => getCentralBankBalanceSheets());

app.get("/api/central-bank-meetings", async () => getCentralBankMeetings());

app.get("/api/treasury-auctions", async (_req, reply) => {
  try {
    return await getTreasuryAuctions();
  } catch (err) {
    reply.code(502);
    return { error: (err as Error).message };
  }
});

app.get("/api/correlation", async (req) => {
  const query = req.query as { days?: string };
  const days = Number(query.days ?? "180");
  return getCorrelationMatrix(days);
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
