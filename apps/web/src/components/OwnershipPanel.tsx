import { useEffect, useState } from "react";
import type { OwnershipSnapshot } from "@ruff-term/shared";
import { fetchOwnership } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";

function codeClass(acquiredDisposed: "A" | "D"): string {
  return acquiredDisposed === "A" ? "pct-up" : "pct-down";
}

export function OwnershipPanel() {
  const [snapshot, setSnapshot] = useState<OwnershipSnapshot | null>(null);

  useEffect(() => {
    fetchOwnership()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  if (!snapshot) {
    return (
      <div className="module-view">
        <div className="empty-state">Loading insider transactions…</div>
      </div>
    );
  }

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">
            Ownership &amp; Insider Activity
          </div>
          <div className="module-banner-sub">
            Section 16 insider transactions (Form 4) for the US-listed watchlist
            names, straight from SEC EDGAR.
          </div>
        </div>
      </div>

      <div className="note-banner">
        Only US-domestic issuers file Form 4. Foreign private issuers on the
        watchlist (SFL, South Bow) are exempt under Exchange Act Rule 3a12-3 and
        simply show no rows below.
      </div>

      {snapshot.transactions.length === 0 ? (
        <div className="empty-state">No recent Form 4 transactions found.</div>
      ) : (
        <>
          <div className="screener-toolbar">
            <button
              className="icon-btn"
              onClick={() =>
                downloadCsv("ownership-insider", [
                  [
                    "Ticker",
                    "Reporting owner",
                    "Role",
                    "Date",
                    "Transaction",
                    "Code",
                    "Shares",
                    "Price",
                    "Owned after",
                  ],
                  ...snapshot.transactions.map((t) => [
                    t.ticker,
                    t.ownerName,
                    t.officerTitle ??
                      (t.isDirector
                        ? "Director"
                        : t.isOfficer
                          ? "Officer"
                          : ""),
                    t.transactionDate,
                    t.transactionCodeLabel,
                    t.transactionCode,
                    t.shares,
                    t.pricePerShare ?? "",
                    t.sharesOwnedAfter,
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
                <th>Ticker</th>
                <th>Reporting owner</th>
                <th>Role</th>
                <th>Date</th>
                <th>Transaction</th>
                <th className="num">Shares</th>
                <th className="num">Price</th>
                <th className="num">Owned after</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.transactions.map((t, i) => (
                <tr key={`${t.ticker}-${t.transactionDate}-${i}`}>
                  <td className="ticker-cell">{t.ticker}</td>
                  <td className="short-name-cell">{t.ownerName}</td>
                  <td className="short-name-cell">
                    {t.officerTitle ??
                      (t.isDirector
                        ? "Director"
                        : t.isOfficer
                          ? "Officer"
                          : "—")}
                  </td>
                  <td>{t.transactionDate}</td>
                  <td className={codeClass(t.acquiredDisposed)}>
                    {t.transactionCodeLabel} ({t.transactionCode})
                  </td>
                  <td className="num-cell">{t.shares.toLocaleString()}</td>
                  <td className="num-cell">
                    {t.pricePerShare ? `$${t.pricePerShare.toFixed(2)}` : "—"}
                  </td>
                  <td className="num-cell">
                    {t.sharesOwnedAfter.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="source-footer">
        Source:{" "}
        <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
          {snapshot.sourceLabel}
        </a>
      </div>
    </div>
  );
}
