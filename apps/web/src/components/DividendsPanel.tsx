import { useEffect, useState } from "react";
import type { DividendsSnapshot } from "@ruff-term/shared";
import { fetchDividends } from "../api/client";
import { SourceFooter } from "./SourceFooter";

export function DividendsPanel() {
  const [snapshot, setSnapshot] = useState<DividendsSnapshot | null>(null);

  useEffect(() => {
    fetchDividends()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Dividends &amp; Corporate Actions</div>
          <div className="module-banner-sub">
            Real dividend payment history for the default watchlist names, live via Yahoo.
          </div>
        </div>
      </div>

      <div className="note-banner">
        This is the watchlist's own dividend history, not Ruffer's actual holdings calendar — the
        watchlist itself is a demo stand-in, and real corporate actions across the fund's real
        positions still need Aladdin. "Est. next" is a rough projection from the median gap between
        past payments, not a declared date.
      </div>

      {snapshot === null ? (
        <div className="empty-state">Loading dividend history…</div>
      ) : snapshot.lines.length === 0 ? (
        <div className="empty-state">No dividend-paying names in the current watchlist.</div>
      ) : (
        <table className="watchlist-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th>Recent payments</th>
              <th>Est. next</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.lines.map((line) => (
              <tr key={line.ticker}>
                <td className="ticker-cell">{line.ticker}</td>
                <td className="short-name-cell">{line.shortName}</td>
                <td>
                  {line.payments
                    .slice()
                    .reverse()
                    .map((p) => `${p.date} (${p.amount.toFixed(3)} ${line.currency})`)
                    .join(" · ")}
                </td>
                <td className="ticker-cell">{line.estimatedNextDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SourceFooter sources={["Yahoo Finance (real dividend event history, live)"]} />
    </div>
  );
}
