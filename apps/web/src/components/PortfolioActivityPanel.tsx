import { useEffect, useState } from "react";
import type { PortfolioActivitySnapshot } from "@ruff-term/shared";
import { fetchPortfolioActivity } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { SourceFooter } from "./SourceFooter";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGBP(value: number): string {
  return `£${Math.round(value).toLocaleString()}`;
}

export function PortfolioActivityPanel() {
  const [snapshot, setSnapshot] = useState<PortfolioActivitySnapshot | null>(
    null,
  );

  useEffect(() => {
    fetchPortfolioActivity()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  return (
    <div className="module-view">
      <div className="demo-banner">
        DEMO DATA — illustrative trading actions, not real Ruffer activity.
      </div>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Portfolio Activity</div>
          <div className="module-banner-sub">
            Week-to-date trading actions across the watchlist.
          </div>
        </div>
      </div>

      {!snapshot ? (
        <div className="empty-state">Loading activity…</div>
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi-tile">
              <div className="kpi-label">Gross buys/adds</div>
              <div className="kpi-value pct-up">
                {formatGBP(snapshot.totalBuysGBP)}
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Gross sells/trims</div>
              <div className="kpi-value pct-down">
                {formatGBP(snapshot.totalSellsGBP)}
              </div>
            </div>
            <div className="kpi-tile">
              <div className="kpi-label">Net flow</div>
              <div
                className={`kpi-value ${snapshot.netFlowGBP >= 0 ? "pct-up" : "pct-down"}`}
              >
                {formatGBP(snapshot.netFlowGBP)}
              </div>
            </div>
          </div>

          <div className="screener-toolbar">
            <button
              className="icon-btn"
              onClick={() =>
                downloadCsv("portfolio-activity", [
                  [
                    "Date",
                    "Ticker",
                    "Name",
                    "Action",
                    "Quantity",
                    "Price",
                    "Currency",
                    "Value (GBP)",
                    "Note",
                  ],
                  ...snapshot.actions.map((a) => [
                    a.date,
                    a.ticker,
                    a.name,
                    a.action,
                    a.quantity,
                    a.price,
                    a.currency,
                    a.valueGBP,
                    a.note,
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          </div>
          <table className="watchlist-table activity-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Ticker</th>
                <th>Name</th>
                <th>Action</th>
                <th className="num">Quantity</th>
                <th className="num">Price</th>
                <th className="num">Value (GBP)</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.actions.map((a) => (
                <tr key={a.id}>
                  <td>{formatDateTime(a.date)}</td>
                  <td className="ticker-cell">{a.ticker}</td>
                  <td className="short-name-cell">{a.name}</td>
                  <td
                    className={
                      a.action === "Buy" || a.action === "Add"
                        ? "pct-up"
                        : "pct-down"
                    }
                  >
                    {a.action}
                  </td>
                  <td className="num-cell">{a.quantity.toLocaleString()}</td>
                  <td className="num-cell">
                    {a.currency} {a.price.toFixed(2)}
                  </td>
                  <td className="num-cell">{formatGBP(a.valueGBP)}</td>
                  <td className="short-name-cell">{a.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <SourceFooter sources={["Demo data — no external source"]} />
    </div>
  );
}
