import { useEffect, useState } from "react";
import type { GlobalMarketsCalendarSnapshot } from "@ruff-term/shared";
import { fetchGlobalMarketsCalendar } from "../api/client";
import { SourceFooter } from "./SourceFooter";

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GlobalMarketsCalendarPanel() {
  const [snapshot, setSnapshot] = useState<GlobalMarketsCalendarSnapshot | null>(null);

  useEffect(() => {
    fetchGlobalMarketsCalendar()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = snapshot ? snapshot.days.filter((d) => d.date >= todayIso) : [];

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Global Markets Calendar</div>
          <div className="module-banner-sub">
            FX and precious-metals settlement holidays by currency, upcoming from today.
          </div>
        </div>
      </div>
      {snapshot && !snapshot.live ? (
        <div className="demo-banner">
          UBS's site blocks this server's outbound requests (edge WAF, 403) — showing a bundled 2026
          snapshot of the same feed instead of a live pull. The backend retries the live URL on every
          cache expiry, so this switches to "live" automatically wherever that block doesn't apply.
        </div>
      ) : null}
      {snapshot === null ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <table className="watchlist-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Gold/silver/PGM closed</th>
              <th>Currencies closed</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((d) => (
              <tr key={d.date}>
                <td className="ticker-cell">{formatDate(d.date)}</td>
                <td className="short-name-cell">{d.preciousMetalsNote ?? "—"}</td>
                <td className="short-name-cell">{d.currenciesClosed.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <SourceFooter
        sources={[
          snapshot
            ? {
                label: snapshot.live
                  ? snapshot.sourceLabel
                  : `${snapshot.sourceLabel} (bundled 2026 snapshot)`,
                url: snapshot.sourceUrl,
              }
            : "UBS",
        ]}
      />
    </div>
  );
}
