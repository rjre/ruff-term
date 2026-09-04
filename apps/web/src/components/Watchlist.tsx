import { useEffect, useMemo, useState } from "react";
import type { WatchlistQuote } from "@ruff-term/shared";
import { fetchWatchlist } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { TickerSearch } from "./TickerSearch";
import { formatQuoteTimestamp, pctClass } from "../lib/format";
import { usePriceFlashes } from "../lib/priceFlash";
import { PriceStamp } from "./PriceStamp";
import { WatchlistHeatmap } from "./WatchlistHeatmap";

const LEGACY_KEY = "ruff-term:watchlist";
const LISTS_KEY = "ruff-term:watchlists";
const ACTIVE_KEY = "ruff-term:activeWatchlist";
const DEFAULT_LIST_NAME = "Default";
const POLL_MS = 30_000;

/** Stable empty arrays so derived values keep their identity across renders
 * — both are memo/effect inputs. */
const EMPTY_TICKERS: string[] = [];
const EMPTY_QUOTES: WatchlistQuote[] = [];

interface FetchedQuotes {
  /** The comma-joined ticker list these quotes answer. */
  key: string;
  quotes: WatchlistQuote[];
}

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

function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

type SortKey =
  | "ticker"
  | "shortName"
  | "lastPrice"
  | "volume"
  | "changePct1d"
  | "changePct2d"
  | "changePct1w"
  | "changePct1m"
  | "changePct6m"
  | "changePct1y";

const SORT_ACCESSORS: Record<SortKey, (q: WatchlistQuote) => string | number> =
  {
    ticker: (q) => q.ticker,
    shortName: (q) => q.shortName,
    lastPrice: (q) => q.lastPrice,
    volume: (q) => q.volume,
    changePct1d: (q) => q.changePct1d,
    changePct2d: (q) => q.changePct2d,
    changePct1w: (q) => q.changePct1w,
    changePct1m: (q) => q.changePct1m,
    changePct6m: (q) => q.changePct6m,
    changePct1y: (q) => q.changePct1y,
  };

type ChangePeriod =
  | "changePct1d"
  | "changePct2d"
  | "changePct1w"
  | "changePct1m"
  | "changePct6m"
  | "changePct1y";

const CHANGE_PERIODS: Array<{ key: ChangePeriod; label: string }> = [
  { key: "changePct1d", label: "1D" },
  { key: "changePct2d", label: "2D" },
  { key: "changePct1w", label: "1W" },
  { key: "changePct1m", label: "1M" },
  { key: "changePct6m", label: "6M" },
  { key: "changePct1y", label: "1Y" },
];

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
  // Quotes are stored with the ticker set they answer, so an empty or
  // just-changed list reads as "loading" without an effect clearing state
  // first — and a slow response for a previous list can't paint over a new
  // one.
  const [fetched, setFetched] = useState<FetchedQuotes | null>(null);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDesc, setSortDesc] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "heatmap">("table");
  const [heatmapPeriod, setHeatmapPeriod] = useState<ChangePeriod>("changePct1d");

  // Memoized because it is an effect dependency: on the `?? []` path this
  // would otherwise be a fresh array every render, re-running the poll effect
  // and re-firing onTickersChange indefinitely.
  const tickers = useMemo(
    () => lists[activeList] ?? EMPTY_TICKERS,
    [lists, activeList],
  );
  const tickersKey = tickers.join(",");
  const quotes = fetched?.key === tickersKey ? fetched.quotes : EMPTY_QUOTES;
  const loading = tickers.length > 0 && fetched?.key !== tickersKey;

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
     
  }, [tickers, onTickersChange]);

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;
    const key = tickers.join(",");

    async function poll() {
      try {
        const data = await fetchWatchlist(tickers);
        if (!cancelled) setFetched({ key, quotes: data });
      } catch {
        // Leave the last good quotes on screen — for a polling terminal the
        // previous print beats a blank table — and retry on the next tick.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tickers]);

  const flashes = usePriceFlashes(
    useMemo(
      () => quotes.map((q) => ({ key: q.ticker, value: q.lastPrice })),
      [quotes],
    ),
  );

  const syntheticQuotes = useMemo(
    () => quotes.filter((q) => q.synthetic),
    [quotes],
  );

  // Log-scaled volume for tile sizing: raw volume across a watchlist can
  // span several orders of magnitude, and a linear treemap weight would let
  // the single most-traded name swallow the map while everything else
  // collapses to slivers.
  const heatTiles = useMemo(
    () =>
      quotes.map((q) => ({
        key: q.ticker,
        ticker: q.ticker,
        shortName: q.shortName,
        weight: Math.log10(Math.max(q.volume, 0) + 10),
        changePct: q[heatmapPeriod],
      })),
    [quotes, heatmapPeriod],
  );

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
          <div className="chart-toolbar-group">
            <button
              className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
            <button
              className={`toggle-btn ${viewMode === "heatmap" ? "active" : ""}`}
              onClick={() => setViewMode("heatmap")}
            >
              Heatmap
            </button>
          </div>
          {viewMode === "heatmap" && (
            <div className="chart-toolbar-group">
              {CHANGE_PERIODS.map((p) => (
                <button
                  key={p.key}
                  className={`toggle-btn ${heatmapPeriod === p.key ? "active" : ""}`}
                  onClick={() => setHeatmapPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
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
                  "Volume",
                  "%1D",
                  "%2D",
                  "%1W",
                  "%1M",
                  "%6M",
                  "%1Y",
                  "Updated",
                  "Simulated",
                ],
                ...sortedQuotes.map((q) => [
                  q.ticker,
                  q.exchange,
                  q.shortName,
                  q.lastPrice,
                  q.currency,
                  q.volume,
                  q.changePct1d,
                  q.changePct2d,
                  q.changePct1w,
                  q.changePct1m,
                  q.changePct6m,
                  q.changePct1y,
                  q.updatedAt,
                  q.synthetic ? "yes" : "no",
                ]),
              ])
            }
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="panel-body">
        {syntheticQuotes.length > 0 && (
          <div className="demo-banner">
            Yahoo did not return a price for{" "}
            {syntheticQuotes.map((q) => q.ticker).join(", ")} —{" "}
            {syntheticQuotes.length === 1 ? "it shows" : "they show"} a
            simulated value, not a real market print.
          </div>
        )}
        {loading && quotes.length === 0 ? (
          <div className="empty-state">Loading quotes…</div>
        ) : quotes.length === 0 ? (
          <div className="empty-state">
            No tickers yet — search above to add one.
          </div>
        ) : viewMode === "heatmap" ? (
          <WatchlistHeatmap tiles={heatTiles} onSelect={onSelectTicker} />
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
                  onClick={() => toggleSort("volume")}
                >
                  Volume{sortIndicator("volume")}
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
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("changePct1w")}
                >
                  %1W{sortIndicator("changePct1w")}
                </th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("changePct1m")}
                >
                  %1M{sortIndicator("changePct1m")}
                </th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("changePct6m")}
                >
                  %6M{sortIndicator("changePct6m")}
                </th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("changePct1y")}
                >
                  %1Y{sortIndicator("changePct1y")}
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
                      title={
                        q.synthetic
                          ? `${q.ticker}: upstream price feed unavailable — simulated value, not a real market print`
                          : `${q.currency} · updated ${formatQuoteTimestamp(q.updatedAt)}`
                      }
                    >
                      <div>
                        {formatPrice(q.lastPrice)}
                        {q.priceSuffix ? (
                          <span className="price-suffix">{q.priceSuffix}</span>
                        ) : null}
                      </div>
                      <PriceStamp at={q.updatedAt} synthetic={q.synthetic} />
                    </td>
                    <td className="num-cell">{formatVolume(q.volume)}</td>
                    <td className={`num-cell ${pctClass(q.changePct1d)}`}>
                      {formatPct(q.changePct1d)}
                    </td>
                    <td className={`num-cell ${pctClass(q.changePct2d)}`}>
                      {formatPct(q.changePct2d)}
                    </td>
                    <td className={`num-cell ${pctClass(q.changePct1w)}`}>
                      {formatPct(q.changePct1w)}
                    </td>
                    <td className={`num-cell ${pctClass(q.changePct1m)}`}>
                      {formatPct(q.changePct1m)}
                    </td>
                    <td className={`num-cell ${pctClass(q.changePct6m)}`}>
                      {formatPct(q.changePct6m)}
                    </td>
                    <td className={`num-cell ${pctClass(q.changePct1y)}`}>
                      {formatPct(q.changePct1y)}
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
