import { useEffect, useMemo, useRef, useState } from "react";
import type { WatchlistQuote } from "@ruff-term/shared";
import { fetchWatchlist } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { TickerSearch } from "./TickerSearch";

const LEGACY_KEY = "ruff-term:watchlist";
const LISTS_KEY = "ruff-term:watchlists";
const ACTIVE_KEY = "ruff-term:activeWatchlist";
const DEFAULT_LIST_NAME = "Default";
const POLL_MS = 30_000;

function loadLists(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        return parsed;
    }
  } catch {
    // fall through to legacy migration
  }
  // Migrate a pre-multi-watchlist single list, if one exists.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy)) return { [DEFAULT_LIST_NAME]: legacy };
    }
  } catch {
    // ignore
  }
  return { [DEFAULT_LIST_NAME]: [] };
}

function loadActiveList(lists: Record<string, string[]>): string {
  const stored = localStorage.getItem(ACTIVE_KEY);
  if (stored && stored in lists) return stored;
  return Object.keys(lists)[0] ?? DEFAULT_LIST_NAME;
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

type SortKey =
  | "ticker"
  | "shortName"
  | "lastPrice"
  | "changePct1d"
  | "changePct2d";

const SORT_ACCESSORS: Record<SortKey, (q: WatchlistQuote) => string | number> =
  {
    ticker: (q) => q.ticker,
    shortName: (q) => q.shortName,
    lastPrice: (q) => q.lastPrice,
    changePct1d: (q) => q.changePct1d,
    changePct2d: (q) => q.changePct2d,
  };

interface Props {
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onTickersChange?: (tickers: string[]) => void;
}

export function Watchlist({
  selectedTicker,
  onSelectTicker,
  onTickersChange,
}: Props) {
  const [lists, setLists] = useState<Record<string, string[]>>(() =>
    loadLists(),
  );
  const [activeList, setActiveList] = useState<string>(() =>
    loadActiveList(loadLists()),
  );
  const [quotes, setQuotes] = useState<WatchlistQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const prevPrices = useRef<Map<string, number>>(new Map());
  const [flashes, setFlashes] = useState<Map<string, "up" | "down">>(new Map());
  const initialized = useRef(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDesc, setSortDesc] = useState(true);

  const tickers = lists[activeList] ?? [];

  function updateActiveTickers(next: string[]) {
    setLists((prev) => ({ ...prev, [activeList]: next }));
  }

  // First-ever run only: no lists exist with any tickers yet, seed from the
  // server's default watchlist.
  useEffect(() => {
    const anyTickers = Object.values(lists).some((l) => l.length > 0);
    if (anyTickers) return;
    fetchWatchlist()
      .then((data) =>
        setLists((prev) => ({
          ...prev,
          [activeList]: data.map((q) => q.ticker),
        })),
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  }, [lists]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeList);
  }, [activeList]);

  useEffect(() => {
    onTickersChange?.(tickers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers, onTickersChange]);

  useEffect(() => {
    if (tickers.length === 0) {
      setQuotes([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    initialized.current = false;

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

  const sortedQuotes = useMemo(() => {
    if (!sortKey) return quotes;
    const accessor = SORT_ACCESSORS[sortKey];
    return quotes.slice().sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : av - (bv as number);
      return sortDesc ? -cmp : cmp;
    });
  }, [quotes, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDesc ? " ▾" : " ▴";
  }

  function addTicker(ticker: string) {
    if (!tickers.includes(ticker)) updateActiveTickers([...tickers, ticker]);
    onSelectTicker(ticker);
  }

  function removeTicker(ticker: string) {
    updateActiveTickers(tickers.filter((t) => t !== ticker));
  }

  function createList() {
    const name = window.prompt("New watchlist name:")?.trim();
    if (!name || name in lists) return;
    setLists((prev) => ({ ...prev, [name]: [] }));
    setActiveList(name);
  }

  function deleteList() {
    const names = Object.keys(lists);
    if (names.length <= 1) return;
    if (!window.confirm(`Delete watchlist "${activeList}"?`)) return;
    const { [activeList]: _removed, ...rest } = lists;
    setLists(rest);
    setActiveList(Object.keys(rest)[0]);
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="watchlist-selector">
          <select
            className="search-input watchlist-select"
            value={activeList}
            onChange={(e) => setActiveList(e.target.value)}
          >
            {Object.keys(lists).map((name) => (
              <option key={name} value={name}>
                {name} ({lists[name].length})
              </option>
            ))}
          </select>
          <button
            className="icon-btn"
            onClick={createList}
            title="New watchlist"
          >
            +
          </button>
          <button
            className="icon-btn"
            onClick={deleteList}
            title="Delete this watchlist"
            disabled={Object.keys(lists).length <= 1}
          >
            −
          </button>
        </div>
        <div className="watchlist-toolbar">
          <div className="search-box">
            <TickerSearch onSelect={addTicker} compact />
          </div>
          <button
            className="icon-btn"
            disabled={quotes.length === 0}
            title="Export this watchlist as CSV"
            onClick={() =>
              downloadCsv(`watchlist-${activeList}`, [
                [
                  "Ticker",
                  "Exchange",
                  "Short Name",
                  "Last Price",
                  "Currency",
                  "%1D",
                  "%2D",
                ],
                ...sortedQuotes.map((q) => [
                  q.ticker,
                  q.exchange,
                  q.shortName,
                  q.lastPrice,
                  q.currency,
                  q.changePct1d,
                  q.changePct2d,
                ]),
              ])
            }
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="panel-body">
        {loading && quotes.length === 0 ? (
          <div className="empty-state">Loading quotes…</div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            No tickers yet — search above to add one.
          </div>
        ) : (
          <table className="watchlist-table">
            <thead>
              <tr>
                <th
                  className="sortable-th"
                  onClick={() => toggleSort("ticker")}
                >
                  Ticker{sortIndicator("ticker")}
                </th>
                <th
                  className="sortable-th"
                  onClick={() => toggleSort("shortName")}
                >
                  Short Name{sortIndicator("shortName")}
                </th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("lastPrice")}
                >
                  Last Price{sortIndicator("lastPrice")}
                </th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("changePct1d")}
                >
                  %1D{sortIndicator("changePct1d")}
                </th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("changePct2d")}
                >
                  %2D{sortIndicator("changePct2d")}
                </th>
                <th aria-label="remove" />
              </tr>
            </thead>
            <tbody>
              {sortedQuotes.map((q) => {
                const flash = flashes.get(q.ticker);
                return (
                  <tr
                    key={q.ticker}
                    className={
                      q.ticker === selectedTicker ? "selected" : undefined
                    }
                    onClick={() => onSelectTicker(q.ticker)}
                  >
                    <td className="ticker-cell">
                      {q.ticker}
                      <span className="ticker-exchange">{q.exchange}</span>
                    </td>
                    <td className="short-name-cell">{q.shortName}</td>
                    <td
                      className={`num-cell price-cell${flash ? ` flash-${flash}` : ""}`}
                      title={`${q.currency} · updated ${new Date(q.updatedAt).toLocaleTimeString()}`}
                    >
                      {formatPrice(q.lastPrice)}
                      {q.priceSuffix ? (
                        <span className="price-suffix">{q.priceSuffix}</span>
                      ) : null}
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
