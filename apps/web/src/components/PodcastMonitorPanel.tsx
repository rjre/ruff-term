import { useEffect, useState } from "react";
import type { PodcastMentionEntity, PodcastMonitorSnapshot } from "@ruff-term/shared";
import { fetchPodcastMonitor } from "../api/client";
import { SourceFooter } from "./SourceFooter";

function pctClass(value: number): string {
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

function EntityTable({ title, entities }: { title: string; entities: PodcastMentionEntity[] }) {
  const sorted = [...entities].sort((a, b) => b.mentions - a.mentions).slice(0, 15);
  return (
    <section className="portfolio-section">
      <h3 className="section-heading">{title}</h3>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Name</th>
            <th className="num">Mentions</th>
            <th className="num">Sentiment</th>
            <th className="num">30d momentum</th>
            <th className="num">Buy/Sell</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id}>
              <td className="ticker-cell">{e.label}</td>
              <td className="num-cell">{e.mentions.toLocaleString()}</td>
              <td className={`num-cell ${pctClass(e.avgSentiment)}`}>{e.avgSentiment.toFixed(2)}</td>
              <td className={`num-cell ${pctClass(e.momentumPct)}`}>
                {e.momentumPct > 0 ? "+" : ""}
                {e.momentumPct.toFixed(1)}%
              </td>
              <td className="num-cell">
                {e.buyMentions}/{e.sellMentions}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function PodcastMonitorPanel() {
  const [snapshot, setSnapshot] = useState<PodcastMonitorSnapshot | null>(null);

  useEffect(() => {
    fetchPodcastMonitor()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

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
