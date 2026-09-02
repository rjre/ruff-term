import { useEffect, useState } from "react";
import type { NewsItem } from "@ruff-term/shared";
import { fetchRns } from "../api/client";
import { SourceFooter } from "./SourceFooter";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function RnsFeedPanel() {
  const [items, setItems] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    fetchRns()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="module-view">
      <div className="demo-banner">
        Not the official LSE RNS feed — there is no free/keyless RNS API. This is general company
        news for large UK-listed names via Yahoo, as a working stand-in. Real regulatory RNS filings
        need a licensed source (LSEG RNS, ticker.app, or Investegate's API).
      </div>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">RNS Newsfeed</div>
          <div className="module-banner-sub">UK-listed company news.</div>
        </div>
      </div>
      {items === null ? (
        <div className="empty-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No news available.</div>
      ) : (
        <ul className="news-list">
          {items.map((item) => (
            <li key={item.id} className="news-item">
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.headline}
              </a>
              <div className="news-meta">
                {item.source} · {timeAgo(item.publishedAt)}
                {item.tickers.length > 0 ? ` · ${item.tickers.join(", ")}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
      <SourceFooter sources={["Yahoo Finance (company news, not official RNS)"]} />
    </div>
  );
}
