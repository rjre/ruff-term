import { useEffect, useRef, useState } from "react";
import type { WatchlistQuote } from "@ruff-term/shared";
import { fetchWatchlist } from "../api/client";
import { TickerSearch } from "./TickerSearch";

const STORAGE_KEY = "ruff-term:watchlist";
const POLL_MS = 30_000;

function loadStoredTickers(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function pctClass(value: number): string {
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

interface Props {
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}

export function Watchlist({ selectedTicker, onSelectTicker }: Props) {
  const [tickers, setTickers] = useState<string[]>(() => loadStoredTickers() ?? []);
  const [quotes, setQuotes] = useState<WatchlistQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const prevPrices = useRef<Map<string, number>>(new Map());
  const [flashes, setFlashes] = useState<Map<string, "up" | "down">>(new Map());
  const initialized = useRef(false);

  // Load default watchlist from server once, then persist locally.
  useEffect(() => {
    if (tickers.length > 0) return;
    fetchWatchlist()
      .then((data) => setTickers(data.map((q) => q.ticker)))
      .catch(() => {});
  }, [tickers.length]);

  useEffect(() => {
    if (tickers.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  }, [tickers]);

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchWatchlist(tickers);
        if (cancelled) return;

        if (initialized.current) {
          const nextFlashes = new Map<string, "up" | "down">();
          for (const q of data) {
            const prev = prevPrices.current.get(q.ticker);
            if (prev !== undefined && prev !== q.lastPrice) {
              nextFlashes.set(q.ticker, q.lastPrice > prev ? "up" : "down");
            }
          }
          if (nextFlashes.size > 0) {
            setFlashes(nextFlashes);
            setTimeout(() => setFlashes(new Map()), 900);
          }
        }

        for (const q of data) prevPrices.current.set(q.ticker, q.lastPrice);
        initialized.current = true;
        setQuotes(data);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tickers]);

  function addTicker(ticker: string) {
    setTickers((prev) => (prev.includes(ticker) ? prev : [...prev, ticker]));
    onSelectTicker(ticker);
  }

  function removeTicker(ticker: string) {
    setTickers((prev) => prev.filter((t) => t !== ticker));
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Watchlist</span>
        <div className="watchlist-toolbar">
          <div className="search-box">
            <TickerSearch onSelect={addTicker} compact />
          </div>
        </div>
      </div>
      <div className="panel-body">
        {loading && quotes.length === 0 ? (
          <div className="empty-state">Loading quotes…</div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">No tickers yet — search above to add one.</div>
        ) : (
          <table className="watchlist-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Short Name</th>
                <th className="num">Last Price</th>
                <th className="num">%1D</th>
                <th className="num">%2D</th>
                <th aria-label="remove" />
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const flash = flashes.get(q.ticker);
                return (
                  <tr
                    key={q.ticker}
                    className={q.ticker === selectedTicker ? "selected" : undefined}
                    onClick={() => onSelectTicker(q.ticker)}
                  >
                    <td className="ticker-cell">
                      {q.ticker}
                      <span className="ticker-exchange">{q.exchange}</span>
                    </td>
                    <td className="short-name-cell">{q.shortName}</td>
                    <td
                      className={`num-cell price-cell${flash ? ` flash-${flash}` : ""}`}
                    >
                      {formatPrice(q.lastPrice)}
                    </td>
                    <td className={`num-cell ${pctClass(q.changePct1d)}`}>
                      {formatPct(q.changePct1d)}
                    </td>
                    <td className={`num-cell ${pctClass(q.changePct2d)}`}>
                      {formatPct(q.changePct2d)}
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTicker(q.ticker);
                        }}
                        title="Remove from watchlist"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
