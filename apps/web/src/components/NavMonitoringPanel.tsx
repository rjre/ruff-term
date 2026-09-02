import { useEffect, useMemo, useState } from "react";
import type {
  NavMonitoringCompany,
  NavMonitoringSnapshot,
} from "@ruff-term/shared";
import { fetchNavMonitoring } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { SourceFooter } from "./SourceFooter";

function pctClass(value: number | null): string {
  if (value === null) return "pct-flat";
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

type SortKey = "ticker" | "navPence" | "sharePricePence" | "discountPct";

const SORT_ACCESSORS: Record<
  SortKey,
  (c: NavMonitoringCompany) => string | number
> = {
  ticker: (c) => c.ticker,
  navPence: (c) => c.navPence ?? 0,
  sharePricePence: (c) => c.sharePricePence ?? 0,
  discountPct: (c) => c.discountPct ?? 0,
};

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function NavMonitoringPanel({ onSelectTicker }: Props) {
  const [snapshot, setSnapshot] = useState<NavMonitoringSnapshot | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("discountPct");
  const [descending, setDescending] = useState(false);

  useEffect(() => {
    fetchNavMonitoring()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  const companies = useMemo(() => {
    if (!snapshot) return [];
    const accessor = SORT_ACCESSORS[sortKey];
    return [...snapshot.companies].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : av - (bv as number);
      return descending ? -cmp : cmp;
    });
  }, [snapshot, sortKey, descending]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setDescending((d) => !d);
    } else {
      setSortKey(key);
      setDescending(false);
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return descending ? " ▾" : " ▴";
  }

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">NAV Monitoring</div>
          <div className="module-banner-sub">
            UK investment trust premium/discount to last-reported NAV.
            {snapshot ? ` Refreshed ${snapshot.lastRefreshed}.` : ""}
          </div>
        </div>
      </div>
      <div className="demo-banner">
        Snapshot copied from rjre/nav-monitoring-'s committed data — the latest
        OFFICIAL NAV per company, not that repo's own live roll-forward estimate
        (which needs its Streamlit app running).
      </div>
      {snapshot === null ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          <div className="screener-toolbar">
            <button
              className="icon-btn"
              onClick={() =>
                downloadCsv("nav-monitoring", [
                  [
                    "Ticker",
                    "Name",
                    "NAV (p)",
                    "NAV date",
                    "Share price (p)",
                    "Discount/Premium %",
                  ],
                  ...companies.map((c) => [
                    c.ticker,
                    c.name,
                    c.navPence ?? "",
                    c.navDate ?? "",
                    c.sharePricePence ?? "",
                    c.discountPct ?? "",
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          </div>
          <table className="watchlist-table">
            <thead>
              <tr>
                <th
                  className="sortable-th"
                  onClick={() => toggleSort("ticker")}
                >
                  Ticker{sortIndicator("ticker")}
                </th>
                <th>Name</th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("navPence")}
                >
                  NAV (p){sortIndicator("navPence")}
                </th>
                <th>NAV date</th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("sharePricePence")}
                >
                  Share price (p){sortIndicator("sharePricePence")}
                </th>
                <th
                  className="num sortable-th"
                  onClick={() => toggleSort("discountPct")}
                >
                  Discount/Premium{sortIndicator("discountPct")}
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.ticker}>
                  <td className="ticker-cell">
                    {onSelectTicker ? (
                      <button
                        className="ticker-cell-btn"
                        onClick={() => onSelectTicker(`${c.ticker}.L`)}
                      >
                        {c.ticker}
                      </button>
                    ) : (
                      c.ticker
                    )}
                  </td>
                  <td className="short-name-cell">{c.name}</td>
                  <td className="num-cell">{c.navPence?.toFixed(2) ?? "—"}</td>
                  <td className="short-name-cell">{c.navDate ?? "—"}</td>
                  <td className="num-cell">
                    {c.sharePricePence?.toFixed(2) ?? "—"}
                  </td>
                  <td className={`num-cell ${pctClass(c.discountPct)}`}>
                    {c.discountPct != null
                      ? `${c.discountPct.toFixed(2)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <SourceFooter
        sources={["rjre/nav-monitoring- (static snapshot of committed data)"]}
      />
    </div>
  );
}
