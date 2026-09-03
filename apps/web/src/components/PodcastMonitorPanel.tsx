import { useEffect, useMemo, useState } from "react";
import type { PodcastMentionEntity, PodcastMonitorSnapshot } from "@ruff-term/shared";
import { fetchPodcastMonitor } from "../api/client";
import { SourceFooter } from "./SourceFooter";

function pctClass(value: number): string {
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

function trendBadge(trend: string): { label: string; className: string } {
  switch (trend) {
    case "rising":
      return { label: "▲ Rising", className: "pct-up" };
    case "falling":
      return { label: "▼ Falling", className: "pct-down" };
    case "flat":
      return { label: "– Flat", className: "pct-flat" };
    case "new":
      return { label: "NEW", className: "pct-flat" };
    default:
      return { label: "—", className: "pct-flat" };
  }
}

type SortKey = "mentions" | "avgSentiment" | "momentumPct" | "buySellSkew";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "mentions", label: "Mentions" },
  { key: "avgSentiment", label: "Sentiment" },
  { key: "momentumPct", label: "30d momentum" },
  { key: "buySellSkew", label: "Buy/Sell skew" },
];

function sortValue(e: PodcastMentionEntity, key: SortKey): number {
  if (key === "buySellSkew") return e.buyMentions - e.sellMentions;
  return e[key];
}

function EntityTable({
  title,
  entities,
}: {
  title: string;
  entities: PodcastMentionEntity[];
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("mentions");
  const [descending, setDescending] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped = q
      ? entities.filter((e) => e.label.toLowerCase().includes(q))
      : entities;
    return scoped
      .slice()
      .sort((a, b) =>
        descending
          ? sortValue(b, sortKey) - sortValue(a, sortKey)
          : sortValue(a, sortKey) - sortValue(b, sortKey),
      );
  }, [entities, query, sortKey, descending]);

  const visible = showAll ? filtered : filtered.slice(0, 15);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setDescending((d) => !d);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return descending ? " ▾" : " ▴";
  }

  return (
    <section className="portfolio-section">
      <div className="podcast-table-header">
        <h3 className="section-heading" style={{ marginBottom: 0 }}>
          {title}
        </h3>
        <input
          className="search-input"
          style={{ maxWidth: 160 }}
          placeholder="Filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Name</th>
            {SORT_OPTIONS.map((o) => (
              <th
                key={o.key}
                className="num sortable-th"
                onClick={() => toggleSort(o.key)}
              >
                {o.label}
                {sortIndicator(o.key)}
              </th>
            ))}
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((e) => {
            const badge = trendBadge(e.trend);
            return (
              <tr key={e.id}>
                <td className="ticker-cell">{e.label}</td>
                <td className="num-cell">{e.mentions.toLocaleString()}</td>
                <td className={`num-cell ${pctClass(e.avgSentiment)}`}>
                  {e.avgSentiment.toFixed(2)}
                </td>
                <td className={`num-cell ${pctClass(e.momentumPct)}`}>
                  {e.momentumPct > 0 ? "+" : ""}
                  {e.momentumPct.toFixed(1)}%
                </td>
                <td className="num-cell">
                  {e.buyMentions}/{e.sellMentions}
                </td>
                <td className={badge.className} style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {badge.label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length > 15 && (
        <button
          className="icon-btn"
          style={{ marginTop: 8 }}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show top 15" : `Show all ${filtered.length}`}
        </button>
      )}
    </section>
  );
}

function topBySkew(
  entities: PodcastMentionEntity[],
  direction: "bullish" | "bearish",
): PodcastMentionEntity | null {
  const withMentions = entities.filter((e) => e.buyMentions + e.sellMentions >= 3);
  if (withMentions.length === 0) return null;
  return withMentions.reduce((best, e) => {
    const skew = e.buyMentions - e.sellMentions;
    const bestSkew = best.buyMentions - best.sellMentions;
    if (direction === "bullish") return skew > bestSkew ? e : best;
    return skew < bestSkew ? e : best;
  });
}

export function PodcastMonitorPanel() {
  const [snapshot, setSnapshot] = useState<PodcastMonitorSnapshot | null>(null);

  useEffect(() => {
    fetchPodcastMonitor()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  const mostBullish = snapshot ? topBySkew(snapshot.stocks, "bullish") : null;
  const mostBearish = snapshot ? topBySkew(snapshot.stocks, "bearish") : null;
  const topRiser = snapshot
    ? [...snapshot.stocks]
        .filter((s) => s.trend === "rising")
        .sort((a, b) => b.momentumPct - a.momentumPct)[0]
    : null;

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Podcast Monitor</div>
          <div className="module-banner-sub">
            What financial podcasts are talking about — stocks, sectors and themes by mention
            volume, sentiment and momentum.
            {snapshot ? ` Generated ${new Date(snapshot.generatedAt).toLocaleString()}.` : ""}
          </div>
        </div>
      </div>
      {snapshot === null ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi-tile">
              <div className="kpi-label">Global avg sentiment</div>
              <div className={`kpi-value ${pctClass(snapshot.globalAvgSentiment)}`}>
                {snapshot.globalAvgSentiment.toFixed(2)}
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Most bullish mention skew</div>
              <div className="kpi-value">
                {mostBullish ? `${mostBullish.label} (${mostBullish.buyMentions}/${mostBullish.sellMentions})` : "—"}
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Most bearish mention skew</div>
              <div className="kpi-value">
                {mostBearish ? `${mostBearish.label} (${mostBearish.buyMentions}/${mostBearish.sellMentions})` : "—"}
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Fastest-rising chatter</div>
              <div className="kpi-value">
                {topRiser ? `${topRiser.label} +${topRiser.momentumPct.toFixed(0)}%` : "—"}
              </div>
            </div>
          </div>
          <div className="portfolio-grid">
            <EntityTable title="Top stocks by mentions" entities={snapshot.stocks} />
            <EntityTable title="Top sectors by mentions" entities={snapshot.sectors} />
          </div>
          <div className="portfolio-grid" style={{ marginTop: 20 }}>
            <EntityTable title="Top themes by mentions" entities={snapshot.themes} />
          </div>
        </>
      )}
      <SourceFooter sources={["rjre/podcast-monitor (static snapshot of committed aggregates.json)"]} />
    </div>
  );
}
