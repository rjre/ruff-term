import { useEffect, useMemo, useState } from "react";
import type { NewsItem } from "@ruff-term/shared";
import { fetchNews } from "../api/client";
import { NewsTickerChips } from "./NewsTickerChips";
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

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function HeadlinesPanel({ onSelectTicker }: Props) {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchNews()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => {
    if (!items) return items;
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.headline.toLowerCase().includes(q) ||
        item.tickers.some((t) => t.toLowerCase().includes(q)),
    );
  }, [items, filter]);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Financial Headlines</div>
          <div className="module-banner-sub">
            Broad market news, not filtered to any one ticker. The colored dot
            is a rough keyword-based tone read, not real sentiment analysis.
          </div>
        </div>
      </div>
      {items !== null && items.length > 0 && (
        <div className="screener-toolbar">
          <input
            className="search-input"
            style={{ maxWidth: 280 }}
            placeholder="Filter headlines…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className="screener-count">
            {filtered?.length ?? 0} of {items.length}
          </span>
        </div>
      )}
      {items === null ? (
        <div className="empty-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No headlines available.</div>
      ) : filtered?.length === 0 ? (
        <div className="empty-state">No headlines match "{filter}".</div>
      ) : (
        <ul className="news-list">
          {filtered?.map((item) => (
            <li key={item.id} className="news-item">
              <a href={item.url} target="_blank" rel="noreferrer">
                <SentimentDot headline={item.headline} />
                {item.headline}
              </a>
              <div className="news-meta">
                {item.source} · {timeAgo(item.publishedAt)}
                <NewsTickerChips
                  tickers={item.tickers}
                  onSelectTicker={onSelectTicker}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <SourceFooter sources={["Yahoo Finance"]} />
    </div>
  );
}
