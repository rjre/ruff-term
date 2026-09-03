import { useEffect, useState } from "react";
import type {
  ChartsOfTheDaySnapshot,
  NewsItem,
  ScreenerRow,
  WatchlistQuote,
} from "@ruff-term/shared";
import {
  fetchChartsOfTheDay,
  fetchNews,
  fetchScreener,
  fetchWatchlist,
} from "../api/client";
import { NewsTickerChips } from "./NewsTickerChips";
import { SentimentDot } from "./SentimentDot";
import { SourceFooter } from "./SourceFooter";
import { formatSignedPct, pctClass } from "../lib/format";

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

function MoverRow({
  label,
  name,
  exchange,
  pct,
  onSelectTicker,
}: {
  label: string;
  name?: string;
  exchange?: string;
  pct: number;
  onSelectTicker?: (ticker: string) => void;
}) {
  return (
    <div
      className={`brief-mover-row${onSelectTicker ? " brief-mover-row-clickable" : ""}`}
      onClick={onSelectTicker ? () => onSelectTicker(label) : undefined}
    >
      <span className="ticker-cell">
        {label}
        {exchange ? <span className="ticker-exchange">{exchange}</span> : null}
        {name ? <span className="short-name-cell brief-mover-name"> {name}</span> : null}
      </span>
      <span className={`num-cell ${pctClass(pct)}`}>
        {formatSignedPct(pct)}
      </span>
    </div>
  );
}

const INVESTOR_QUOTES: Array<{ quote: string; author: string }> = [
  { quote: "Be fearful when others are greedy, and greedy when others are fearful.", author: "Warren Buffett" },
  { quote: "The four most dangerous words in investing are: 'this time it's different.'", author: "Sir John Templeton" },
  { quote: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" },
  { quote: "In the short run, the market is a voting machine. In the long run, it's a weighing machine.", author: "Benjamin Graham" },
  { quote: "Risk comes from not knowing what you're doing.", author: "Warren Buffett" },
  { quote: "The investor's chief problem — and even his worst enemy — is likely to be himself.", author: "Benjamin Graham" },
  { quote: "Markets can remain irrational longer than you can remain solvent.", author: "John Maynard Keynes" },
  { quote: "Know what you own, and know why you own it.", author: "Peter Lynch" },
  { quote: "The big money is not in the buying and selling, but in the waiting.", author: "Charlie Munger" },
  { quote: "It is not the strongest of the species that survives, but the one most responsive to change.", author: "Charles Darwin" },
  { quote: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { quote: "The trend is your friend until the end when it bends.", author: "Ed Seykota" },
  { quote: "Bull markets are born on pessimism, grow on skepticism, mature on optimism, and die on euphoria.", author: "Sir John Templeton" },
  { quote: "Diversification is protection against ignorance. It makes little sense if you know what you are doing.", author: "Warren Buffett" },
  { quote: "The four most expensive words in the English language are 'this time it's different.'", author: "Sir John Templeton" },
  { quote: "Price is what you pay. Value is what you get.", author: "Warren Buffett" },
  { quote: "The intelligent investor is a realist who sells to optimists and buys from pessimists.", author: "Benjamin Graham" },
  { quote: "Never invest in a business you cannot understand.", author: "Warren Buffett" },
  { quote: "The most important quality for an investor is temperament, not intellect.", author: "Warren Buffett" },
  { quote: "Every once in a while, the market does something so stupid it takes your breath away.", author: "Jim Cramer" },
];

/** Deterministic pick from the day's date, so it changes once per day and is
 * stable across reloads/users on the same day — no server round trip. */
function quoteOfTheDay(): { quote: string; author: string } {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return INVESTOR_QUOTES[dayIndex % INVESTOR_QUOTES.length];
}

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function MorningBriefPanel({ onSelectTicker }: Props) {
  const [watchlist, setWatchlist] = useState<WatchlistQuote[] | null>(null);
  const [screener, setScreener] = useState<ScreenerRow[] | null>(null);
  const [regime, setRegime] = useState<ChartsOfTheDaySnapshot | null>(null);
  const [headlines, setHeadlines] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    fetchWatchlist()
      .then(setWatchlist)
      .catch(() => setWatchlist([]));
    fetchScreener()
      .then((s) => setScreener(s.rows))
      .catch(() => setScreener([]));
    fetchChartsOfTheDay()
      .then(setRegime)
      .catch(() => setRegime(null));
    fetchNews()
      .then((n) => setHeadlines(n.slice(0, 6)))
      .catch(() => setHeadlines([]));
  }, []);

  const loading = watchlist === null || screener === null || headlines === null;

  const portfolioMovers = watchlist
    ? [...watchlist]
        .sort((a, b) => Math.abs(b.changePct1d) - Math.abs(a.changePct1d))
        .slice(0, 5)
    : [];

  const gainers = screener
    ? [...screener].sort((a, b) => b.changePct1d - a.changePct1d).slice(0, 5)
    : [];
  const losers = screener
    ? [...screener].sort((a, b) => a.changePct1d - b.changePct1d).slice(0, 5)
    : [];

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Morning Brief</div>
          <div className="module-banner-sub">
            The one page to open first — what moved, what's leading, what's in
            the news. Generated fresh on every load from data already live
            elsewhere in the terminal.
          </div>
        </div>
      </div>

      {(() => {
        const q = quoteOfTheDay();
        return (
          <div className="daily-quote">
            <span className="daily-quote-mark">“</span>
            {q.quote}
            <span className="daily-quote-author">— {q.author}</span>
          </div>
        );
      })()}

      {loading ? (
        <div className="empty-state">Building this morning's brief…</div>
      ) : (
        <>
          {regime && (
            <div className="kpi-row">
              <div className="kpi-tile">
                <div className="kpi-label">Regime signal</div>
                <div className="kpi-value">
                  {regimeSignal(regime.growthAvgPct, regime.protectionAvgPct)}
                </div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Growth proxies avg</div>
                <div className={`kpi-value ${pctClass(regime.growthAvgPct)}`}>
                  {formatSignedPct(regime.growthAvgPct)}
                </div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Protection proxies avg</div>
                <div
                  className={`kpi-value ${pctClass(regime.protectionAvgPct)}`}
                >
                  {formatSignedPct(regime.protectionAvgPct)}
                </div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">Top newsflow theme</div>
                <div className="kpi-value">
                  {regime.newsThemes[0]?.theme ?? "—"}
                </div>
              </div>
            </div>
          )}

          <div className="portfolio-grid">
            <section className="portfolio-section">
              <h3 className="section-heading">
                Portfolio watchlist — biggest moves today
              </h3>
              <div className="brief-mover-list">
                {portfolioMovers.map((q) => (
                  <MoverRow
                    key={q.ticker}
                    label={q.ticker}
                    name={q.shortName}
                    exchange={q.exchange}
                    pct={q.changePct1d}
                    onSelectTicker={onSelectTicker}
                  />
                ))}
              </div>
            </section>

            <section className="portfolio-section">
              <h3 className="section-heading">
                Broad market — top gainers / losers
              </h3>
              <div className="brief-mover-list">
                {gainers.map((r) => (
                  <MoverRow
                    key={r.ticker}
                    label={r.ticker}
                    name={r.name}
                    exchange={r.exchange}
                    pct={r.changePct1d}
                    onSelectTicker={onSelectTicker}
                  />
                ))}
              </div>
              <div className="brief-mover-list" style={{ marginTop: 10 }}>
                {losers.map((r) => (
                  <MoverRow
                    key={r.ticker}
                    label={r.ticker}
                    name={r.name}
                    exchange={r.exchange}
                    pct={r.changePct1d}
                    onSelectTicker={onSelectTicker}
                  />
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
                  <NewsTickerChips
                    tickers={item.tickers}
                    onSelectTicker={onSelectTicker}
                  />
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
