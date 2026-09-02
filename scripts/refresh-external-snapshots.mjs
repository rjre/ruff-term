#!/usr/bin/env node
/**
 * Regenerates apps/server/src/data/navMonitoringSnapshot.json and
 * podcastMonitorAggregates.json from local clones of rjre/nav-monitoring-
 * and rjre/podcast-monitor.
 *
 * Both source repos are private, so there's no public raw-file URL the
 * running server can poll at request time — the NAV Monitoring and Podcast
 * Monitor tabs work from a committed static snapshot instead. This script
 * is how that snapshot gets refreshed: pull the latest commit on each
 * source repo, re-derive the snapshot JSON from their current data files,
 * and (when run by the scheduled sync) commit + push the result if
 * anything changed. Run it by hand any time with:
 *
 *   node scripts/refresh-external-snapshots.mjs
 *
 * Requires the two repos already cloned locally with push/pull access
 * (e.g. via the Claude Code Remote `add_repo` tool). Paths default to
 * where this environment cloned them; override with
 * NAV_MONITORING_REPO_PATH / PODCAST_MONITOR_REPO_PATH for a different
 * checkout location.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const NAV_REPO = process.env.NAV_MONITORING_REPO_PATH ?? "/home/user/nav-monitoring-";
const PODCAST_REPO = process.env.PODCAST_MONITOR_REPO_PATH ?? "/home/user/rjre/podcast-monitor";

function log(msg) {
  console.log(`[refresh-external-snapshots] ${msg}`);
}

function gitPull(repoPath, label) {
  if (!existsSync(repoPath)) {
    log(`${label}: no local clone at ${repoPath} — skipping (clone it first, e.g. via add_repo)`);
    return false;
  }
  try {
    execFileSync("git", ["-C", repoPath, "pull", "--ff-only"], { stdio: "inherit" });
    return true;
  } catch (err) {
    log(`${label}: git pull failed — ${err.message}`);
    return false;
  }
}

function refreshNavMonitoring() {
  const navHistoryDir = path.join(NAV_REPO, "data", "nav_history");
  const companiesDir = path.join(NAV_REPO, "data", "companies");
  const metaPath = path.join(NAV_REPO, "data", "meta.json");

  if (!existsSync(navHistoryDir)) {
    log("nav-monitoring: data/nav_history not found — skipping regeneration");
    return false;
  }

  const tickers = readdirSync(navHistoryDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();

  const companies = tickers.map((ticker) => {
    const history = JSON.parse(readFileSync(path.join(navHistoryDir, `${ticker}.json`), "utf8"));
    const latest = history[history.length - 1] ?? {};

    let name = ticker;
    const companyPath = path.join(companiesDir, `${ticker}.json`);
    if (existsSync(companyPath)) {
      const meta = JSON.parse(readFileSync(companyPath, "utf8"));
      name = meta.name ?? ticker;
    }

    return {
      ticker,
      name,
      navPence: latest.nav_pence ?? null,
      navDate: latest.as_of_date ?? null,
      sharePricePence: latest.share_price_pence ?? null,
      discountPct: latest.discount_pct ?? null,
    };
  });

  let lastRefreshed = new Date().toISOString();
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    lastRefreshed = meta.last_refreshed ?? lastRefreshed;
  }

  const outPath = path.join(REPO_ROOT, "apps/server/src/data/navMonitoringSnapshot.json");
  writeFileSync(outPath, `${JSON.stringify({ lastRefreshed, companies }, null, 2)}\n`);
  log(`nav-monitoring: wrote ${companies.length} companies to ${path.relative(REPO_ROOT, outPath)}`);
  return true;
}

function trimEntity(e) {
  return {
    id: e.id,
    label: e.label,
    mentions: e.mentions,
    avg_sentiment: e.avg_sentiment,
    momentum_pct: e.momentum_pct,
    trend: e.trend,
    buy_mentions: e.buy_mentions,
    sell_mentions: e.sell_mentions,
  };
}

function refreshPodcastMonitor() {
  const aggPath = path.join(PODCAST_REPO, "data", "aggregates.json");
  if (!existsSync(aggPath)) {
    log("podcast-monitor: data/aggregates.json not found — skipping regeneration");
    return false;
  }

  const raw = JSON.parse(readFileSync(aggPath, "utf8"));
  const out = {
    generatedAt: raw.generated_at,
    globalAvgSentiment: raw.global_avg_sentiment,
    stocks: (raw.stocks ?? []).map(trimEntity),
    sectors: (raw.sectors ?? []).map(trimEntity),
    themes: (raw.themes ?? []).map(trimEntity),
  };

  const outPath = path.join(REPO_ROOT, "apps/server/src/data/podcastMonitorAggregates.json");
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  log(
    `podcast-monitor: wrote ${out.stocks.length} stocks / ${out.sectors.length} sectors / ${out.themes.length} themes to ${path.relative(REPO_ROOT, outPath)}`
  );
  return true;
}

gitPull(NAV_REPO, "nav-monitoring");
gitPull(PODCAST_REPO, "podcast-monitor");

const navOk = refreshNavMonitoring();
const podcastOk = refreshPodcastMonitor();

if (!navOk && !podcastOk) {
  log("Nothing refreshed — neither source repo is available in this environment.");
  process.exit(1);
}
