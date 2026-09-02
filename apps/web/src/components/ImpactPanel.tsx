import { useEffect, useState } from "react";
import type { ImpactedNewsItem } from "@ruff-term/shared";
import { fetchImpact } from "../api/client";
import { SourceFooter } from "./SourceFooter";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ImpactPanel() {
  const [items, setItems] = useState<ImpactedNewsItem[] | null>(null);

  useEffect(() => {
    fetchImpact()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Ruffer Impact</div>
          <div className="module-banner-sub">
            Today's portfolio newsflow, reframed against the fund's disclosed allocation and holdings.
          </div>
        </div>
      </div>
      {items === null ? (
        <div className="empty-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No newsflow to analyse right now.</div>
      ) : (
        <ul className="impact-list">
          {items.map((item) => (
            <li key={item.id} className="impact-item">
              <div className="impact-headline-row">
                <a href={item.url} target="_blank" rel="noreferrer" className="impact-headline">
                  {item.headline}
                </a>
                <span className={`impact-badge impact-badge-${item.impactSource}`}>
                  {item.impactSource === "claude" ? "Claude" : "Rule-based"}
                </span>
              </div>
              <div className="news-meta">
                {item.source} · {timeAgo(item.publishedAt)}
                {item.tickers.length > 0 ? ` · ${item.tickers.join(", ")}` : ""}
              </div>
              <p className="impact-text">{item.impact}</p>
            </li>
          ))}
        </ul>
      )}
      <SourceFooter
        sources={[
          "Yahoo Finance (news)",
          "Ruffer Portfolio snapshot (ruffer.co.uk)",
          "impact text: Claude when ANTHROPIC_API_KEY is set, else rule-based heuristic",
        ]}
      />
    </div>
  );
}
