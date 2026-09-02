import { useEffect, useState } from "react";
import type { NewsItem } from "@ruff-term/shared";
import { fetchNews } from "../api/client";
import { SentimentDot } from "./SentimentDot";
import { SourceFooter } from "./SourceFooter";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function HeadlinesPanel() {
  const [items, setItems] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    fetchNews()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Financial Headlines</div>
          <div className="module-banner-sub">
            Broad market news, not filtered to any one ticker. The colored dot is a rough
            keyword-based tone read, not real sentiment analysis.
          </div>
        </div>
      </div>
      {items === null ? (
        <div className="empty-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No headlines available.</div>
      ) : (
        <ul className="news-list">
          {items.map((item) => (
            <li key={item.id} className="news-item">
              <a href={item.url} target="_blank" rel="noreferrer">
                <SentimentDot headline={item.headline} />
                {item.headline}
              </a>
              <div className="news-meta">
                {item.source} · {timeAgo(item.publishedAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
      <SourceFooter sources={["Yahoo Finance"]} />
    </div>
  );
}
