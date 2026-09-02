import { useEffect, useState } from "react";
import type { NavMonitoringSnapshot } from "@ruff-term/shared";
import { fetchNavMonitoring } from "../api/client";
import { SourceFooter } from "./SourceFooter";

function pctClass(value: number | null): string {
  if (value === null) return "pct-flat";
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

export function NavMonitoringPanel() {
  const [snapshot, setSnapshot] = useState<NavMonitoringSnapshot | null>(null);

  useEffect(() => {
    fetchNavMonitoring()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  const companies = snapshot
    ? [...snapshot.companies].sort((a, b) => (a.discountPct ?? 0) - (b.discountPct ?? 0))
    : [];

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
        Snapshot copied from rjre/nav-monitoring-'s committed data — the latest OFFICIAL NAV per
        company, not that repo's own live roll-forward estimate (which needs its Streamlit app
        running).
      </div>
      {snapshot === null ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <table className="watchlist-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Name</th>
              <th className="num">NAV (p)</th>
              <th>NAV date</th>
              <th className="num">Share price (p)</th>
              <th className="num">Discount/Premium</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.ticker}>
                <td className="ticker-cell">{c.ticker}</td>
                <td className="short-name-cell">{c.name}</td>
                <td className="num-cell">{c.navPence?.toFixed(2) ?? "—"}</td>
                <td className="short-name-cell">{c.navDate ?? "—"}</td>
                <td className="num-cell">{c.sharePricePence?.toFixed(2) ?? "—"}</td>
                <td className={`num-cell ${pctClass(c.discountPct)}`}>
                  {c.discountPct != null ? `${c.discountPct.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <SourceFooter sources={["rjre/nav-monitoring- (static snapshot of committed data)"]} />
    </div>
  );
}
