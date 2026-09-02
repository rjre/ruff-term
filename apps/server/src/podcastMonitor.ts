import type { PodcastMentionEntity, PodcastMonitorSnapshot } from "@ruff-term/shared";
import raw from "./data/podcastMonitorAggregates.json" with { type: "json" };

interface RawEntity {
  id: string;
  label: string;
  mentions: number;
  avg_sentiment: number;
  momentum_pct: number;
  trend: string;
  buy_mentions: number;
  sell_mentions: number;
}

function mapEntity(e: RawEntity): PodcastMentionEntity {
  return {
    id: e.id,
    label: e.label,
    mentions: e.mentions,
    avgSentiment: e.avg_sentiment,
    momentumPct: e.momentum_pct,
    trend: e.trend,
    buyMentions: e.buy_mentions,
    sellMentions: e.sell_mentions,
  };
}

/**
 * Static snapshot copied from rjre/podcast-monitor's data/aggregates.json
 * (its own pre-computed output — keyword-tagged, zero-API-cost pipeline by
 * default). Not re-run here; this is exactly what that repo had committed
 * at copy time.
 */
export function getPodcastMonitorSnapshot(): PodcastMonitorSnapshot {
  const data = raw as {
    generatedAt: string;
    globalAvgSentiment: number;
    stocks: RawEntity[];
    sectors: RawEntity[];
    themes: RawEntity[];
  };
  return {
    generatedAt: data.generatedAt,
    globalAvgSentiment: data.globalAvgSentiment,
    stocks: data.stocks.map(mapEntity),
    sectors: data.sectors.map(mapEntity),
    themes: data.themes.map(mapEntity),
  };
}
