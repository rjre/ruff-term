import { useEffect, useState } from "react";
import type { NewsItem } from "@ruff-term/shared";
import { fetchNews } from "../api/client";

interface Props {
  ticker: string | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NewsFeed({ ticker }: Props) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNews(ticker ?? undefined)
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>{ticker ? `${ticker} — News` : "Market News"}</span>
      </div>
      <div className="panel-body">
        {loading ? (
          <div className="empty-state">Loading news…</div>
        ) : news.length === 0 ? (
          <div className="empty-state">No news available.</div>
        ) : (
          <ul className="news-list">
            {news.map((item) => (
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
      </div>
    </div>
  );
}
