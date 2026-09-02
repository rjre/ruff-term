import { useEffect, useState } from "react";
import type { ChartsOfTheDaySnapshot, NewsItem, ScreenerRow, WatchlistQuote } from "@ruff-term/shared";
import { fetchChartsOfTheDay, fetchNews, fetchScreener, fetchWatchlist } from "../api/client";
import { SentimentDot } from "./SentimentDot";
import { SourceFooter } from "./SourceFooter";

function pctClass(value: number): string {
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function regimeSignal(growthAvg: number, protectionAvg: number): string {
  const gap = growthAvg - protectionAvg;
  if (Math.abs(gap) < 0.15) return "Mixed";
  return gap > 0 ? "Growth leading" : "Protection leading";
}

function MoverRow({ label, exchange, pct }: { label: string; exchange?: string; pct: number }) {
  return (
    <div className="brief-mover-row">
      <span className="ticker-cell">
        {label}
        {exchange ? <span className="ticker-exchange">{exchange}</span> : null}
      </span>
      <span className={`num-cell ${pctClass(pct)}`}>{formatSignedPct(pct)}</span>
    </div>
  );
}

export function MorningBriefPanel() {
  const [watchlist, setWatchlist] = useState<WatchlistQuote[] | null>(null);
  const [screener, setScreener] = useState<ScreenerRow[] | null>(null);
  const [regime, setRegime] = useState<ChartsOfTheDaySnapshot | null>(null);
  const [headlines, setHeadlines] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    fetchWatchlist().then(setWatchlist).catch(() => setWatchlist([]));
    fetchScreener().then((s) => setScreener(s.rows)).catch(() => setScreener([]));
    fetchChartsOfTheDay().then(setRegime).catch(() => setRegime(null));
    fetchNews().then((n) => setHeadlines(n.slice(0, 6))).catch(() => setHeadlines([]));
  }, []);

  const loading = watchlist === null || screener === null || headlines === null;

  const portfolioMovers = watchlist
    ? [...watchlist].sort((a, b) => Math.abs(b.changePct1d) - Math.abs(a.changePct1d)).slice(0, 5)
    : [];

  const gainers = screener ? [...screener].sort((a, b) => b.changePct1d - a.changePct1d).slice(0, 5) : [];
  const losers = screener ? [...screener].sort((a, b) => a.changePct1d - b.changePct1d).slice(0, 5) : [];

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Morning Brief</div>
          <div className="module-banner-sub">
            The one page to open first — what moved, what's leading, what's in the news. Generated
            fresh on every load from data already live elsewhere in the terminal.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Building this morning's brief…</div>
      ) : (
        <>
          {regime && (
            <div className="kpi-row">
              <div className="kpi-tile">
                <div className="kpi-label">Regime signal</div>
                <div className="kpi-value">{regimeSignal(regime.growthAvgPct, regime.protectionAvgPct)}</div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Growth proxies avg</div>
                <div className={`kpi-value ${pctClass(regime.growthAvgPct)}`}>
                  {formatSignedPct(regime.growthAvgPct)}
                </div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Protection proxies avg</div>
                <div className={`kpi-value ${pctClass(regime.protectionAvgPct)}`}>
                  {formatSignedPct(regime.protectionAvgPct)}
                </div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Top newsflow theme</div>
                <div className="kpi-value">{regime.newsThemes[0]?.theme ?? "—"}</div>
              </div>
            </div>
          )}

          <div className="portfolio-grid">
            <section className="portfolio-section">
              <h3 className="section-heading">Portfolio watchlist — biggest moves today</h3>
              <div className="brief-mover-list">
                {portfolioMovers.map((q) => (
                  <MoverRow key={q.ticker} label={q.ticker} exchange={q.exchange} pct={q.changePct1d} />
                ))}
              </div>
            </section>

            <section className="portfolio-section">
              <h3 className="section-heading">Broad market — top gainers / losers</h3>
              <div className="brief-mover-list">
                {gainers.map((r) => (
                  <MoverRow key={r.ticker} label={r.ticker} exchange={r.exchange} pct={r.changePct1d} />
                ))}
              </div>
              <div className="brief-mover-list" style={{ marginTop: 10 }}>
                {losers.map((r) => (
                  <MoverRow key={r.ticker} label={r.ticker} exchange={r.exchange} pct={r.changePct1d} />
                ))}
              </div>
            </section>
          </div>

          <h3 className="section-heading" style={{ marginTop: 24 }}>
            Top headlines
          </h3>
          <ul className="news-list">
            {headlines.map((item) => (
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
        </>
      )}

      <SourceFooter
        sources={[
          "Yahoo Finance (prices, news)",
          "Regime signal from Charts of the Day (live ETF proxies)",
        ]}
      />
    </div>
  );
}
