import { useEffect, useState } from "react";
import type { NewsItem } from "@ruff-term/shared";
import { fetchNews, fetchPortfolioNews } from "../api/client";
import { NewsTickerChips } from "./NewsTickerChips";
import { SentimentDot } from "./SentimentDot";

interface Props {
  ticker: string | null;
  watchlistTickers: string[];
  onSelectTicker?: (ticker: string) => void;
}

type Mode = "portfolio" | "market";

interface LoadedNews {
  /** The ticker/mode/watchlist combination these items answer. */
  key: string;
  news: NewsItem[];
}

/** Stable empty array — `news` feeds memoized children. */
const EMPTY_NEWS: NewsItem[] = [];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NewsFeed({ ticker, watchlistTickers, onSelectTicker }: Props) {
  const [mode, setMode] = useState<Mode>("portfolio");
  // Stored with the request it answers, so "loading" is derived rather than
  // set by the effect — and a slow response for a previous ticker or mode
  // can't overwrite the current one.
  const [loaded, setLoaded] = useState<LoadedNews | null>(null);

  const requestKey = `${ticker ?? ""}|${mode}|${watchlistTickers.join(",")}`;
  const news = loaded?.key === requestKey ? loaded.news : EMPTY_NEWS;
  const loading = loaded?.key !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const load = ticker
      ? fetchNews(ticker)
      : mode === "portfolio"
        ? fetchPortfolioNews(watchlistTickers)
        : fetchNews();

    load
      .then((items) => !cancelled && setLoaded({ key: requestKey, news: items }))
      .catch(
        () => !cancelled && setLoaded({ key: requestKey, news: EMPTY_NEWS }),
      );
    return () => {
      cancelled = true;
    };
  }, [ticker, mode, watchlistTickers, requestKey]);

  const title = ticker
    ? `${ticker} — News`
    : mode === "portfolio"
      ? "Portfolio Newsflow"
      : "Market News";

  return (
    <div className="panel">
      <div className="panel-header">
        <span>{title}</span>
        {!ticker ? (
          <div className="news-mode-toggle">
            <button
              className={`toggle-btn${mode === "portfolio" ? " active" : ""}`}
              onClick={() => setMode("portfolio")}
            >
              Portfolio
            </button>
            <button
              className={`toggle-btn${mode === "market" ? " active" : ""}`}
              onClick={() => setMode("market")}
            >
              Market
            </button>
          </div>
        ) : null}
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
      </div>
    </div>
  );
}
