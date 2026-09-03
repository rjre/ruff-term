import { useEffect, useMemo, useState } from "react";
import type { ScreenerRow } from "@ruff-term/shared";
import { fetchScreener } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
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

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SortKey = keyof Pick<
  ScreenerRow,
  | "changePct1d"
  | "changePct1w"
  | "changePct1m"
  | "changePct3m"
  | "changePctYtd"
  | "pctFrom52wHigh"
  | "pctFrom52wLow"
>;

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "changePct1d", label: "%1D" },
  { key: "changePct1w", label: "%1W" },
  { key: "changePct1m", label: "%1M" },
  { key: "changePct3m", label: "%3M" },
  { key: "changePctYtd", label: "%YTD" },
  { key: "pctFrom52wHigh", label: "% from 52w high" },
  { key: "pctFrom52wLow", label: "% from 52w low" },
];

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function ScreenerPanel({ onSelectTicker }: Props) {
  const [rows, setRows] = useState<ScreenerRow[] | null>(null);
  const [sector, setSector] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("changePctYtd");
  const [descending, setDescending] = useState(true);

  useEffect(() => {
    fetchScreener()
      .then((data) => setRows(data.rows))
      .catch(() => setRows([]));
  }, []);

  const sectors = useMemo(() => {
    if (!rows) return [];
    return ["All", ...Array.from(new Set(rows.map((r) => r.sector))).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    let scoped =
      sector === "All" ? rows : rows.filter((r) => r.sector === sector);
    const q = query.trim().toLowerCase();
    if (q) {
      scoped = scoped.filter(
        (r) =>
          r.ticker.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q),
      );
    }
    return scoped
      .slice()
      .sort((a, b) =>
        descending ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey],
      );
  }, [rows, sector, query, sortKey, descending]);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Screener</div>
          <div className="module-banner-sub">
            Momentum screener over a curated ~65-name liquid large-cap universe,
            live Yahoo Finance prices. No valuation metrics (P/E, market cap,
            dividend yield) — those require a paid fundamentals feed, not
            free/keyless.
          </div>
        </div>
      </div>

      <div className="screener-toolbar">
        <input
          className="search-input"
          style={{ maxWidth: 200 }}
          placeholder="Filter ticker/name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="guide-select-label" htmlFor="screener-sector">
          Sector
        </label>
        <select
          id="screener-sector"
          className="search-input"
          style={{ maxWidth: 220 }}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        >
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="guide-select-label" htmlFor="screener-sort">
          Sort by
        </label>
        <select
          id="screener-sort"
          className="search-input"
          style={{ maxWidth: 200 }}
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <button className="toggle-btn" onClick={() => setDescending((d) => !d)}>
          {descending ? "Highest first" : "Lowest first"}
        </button>

        <button
          className="icon-btn"
          disabled={!rows}
          onClick={() =>
            downloadCsv("screener", [
              [
                "Ticker",
                "Name",
                "Sector",
                "Exchange",
                "Last",
                "%1D",
                "%1W",
                "%1M",
                "%3M",
                "%YTD",
                "%52wHigh",
                "%52wLow",
                "Updated",
              ],
              ...filtered.map((r) => [
                r.ticker,
                r.name,
                r.sector,
                r.exchange,
                r.lastPrice,
                r.changePct1d,
                r.changePct1w,
                r.changePct1m,
                r.changePct3m,
                r.changePctYtd,
                r.pctFrom52wHigh,
                r.pctFrom52wLow,
                r.updatedAt,
              ]),
            ])
          }
        >
          Export CSV
        </button>

        {rows && (
          <span className="screener-count">{filtered.length} names</span>
        )}
      </div>

      {rows === null ? (
        <div className="empty-state">Loading screener…</div>
      ) : (
        <table className="watchlist-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Name</th>
              <th>Sector</th>
              <th className="num">Last</th>
              <th className="num">%1D</th>
              <th className="num">%1W</th>
              <th className="num">%1M</th>
              <th className="num">%3M</th>
              <th className="num">%YTD</th>
              <th className="num">%52w High</th>
              <th className="num">%52w Low</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.ticker}
                className={
                  onSelectTicker ? "screener-row-clickable" : undefined
                }
                onClick={
                  onSelectTicker ? () => onSelectTicker(r.ticker) : undefined
                }
              >
                <td className="ticker-cell">
                  {r.ticker}
                  <span className="ticker-exchange">{r.exchange}</span>
                </td>
                <td className="short-name-cell">{r.name}</td>
                <td className="short-name-cell">{r.sector}</td>
                <td className="num-cell price-cell">
                  <div>{r.lastPrice.toFixed(2)}</div>
                  <div className="price-updated">
                    {formatUpdated(r.updatedAt)}
                  </div>
                </td>
                <td className={`num-cell ${pctClass(r.changePct1d)}`}>
                  {formatSignedPct(r.changePct1d)}
                </td>
                <td className={`num-cell ${pctClass(r.changePct1w)}`}>
                  {formatSignedPct(r.changePct1w)}
                </td>
                <td className={`num-cell ${pctClass(r.changePct1m)}`}>
                  {formatSignedPct(r.changePct1m)}
                </td>
                <td className={`num-cell ${pctClass(r.changePct3m)}`}>
                  {formatSignedPct(r.changePct3m)}
                </td>
                <td className={`num-cell ${pctClass(r.changePctYtd)}`}>
                  {formatSignedPct(r.changePctYtd)}
                </td>
                <td className={`num-cell ${pctClass(r.pctFrom52wHigh)}`}>
                  {formatSignedPct(r.pctFrom52wHigh)}
                </td>
                <td className={`num-cell ${pctClass(r.pctFrom52wLow)}`}>
                  {formatSignedPct(r.pctFrom52wLow)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SourceFooter
        sources={["Yahoo Finance (live prices, curated universe)"]}
      />
    </div>
  );
}
