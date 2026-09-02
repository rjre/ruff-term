import { useEffect, useMemo, useState } from "react";
import type { ShortPositionsSnapshot } from "@ruff-term/shared";
import { fetchShortPositions } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { MagnitudeBarList } from "./MagnitudeBarList";

export function ShortPositionsPanel() {
  const [snapshot, setSnapshot] = useState<ShortPositionsSnapshot | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    fetchShortPositions()
      .then((data) => {
        setSnapshot(data);
        if (data.top.length > 0) setSelected(data.top[0].isin);
      })
      .catch(() => setSnapshot(null));
  }, []);

  const history = useMemo(() => {
    if (!snapshot || !selected) return [];
    return snapshot.history[selected] ?? [];
  }, [snapshot, selected]);

  if (!snapshot) {
    return (
      <div className="module-view">
        <div className="empty-state">
          Loading FCA short position disclosures…
        </div>
      </div>
    );
  }

  const barLines = snapshot.top
    .slice(0, 15)
    .map((t) => ({ label: t.name, pct: t.netShortPct }));

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Short Position Data</div>
          <div className="module-banner-sub">
            Aggregate net short positions in UK shares at/above the 0.5%
            disclosure threshold, from the FCA's public register (Short Selling
            Regulation).
          </div>
        </div>
      </div>

      <div className="screener-toolbar">
        <h3 className="section-heading" style={{ margin: 0 }}>
          Top 15 most-shorted names (aggregated net short %)
        </h3>
        <button
          className="icon-btn"
          onClick={() =>
            downloadCsv("short-positions", [
              ["Name", "ISIN", "Net short %", "Position date"],
              ...snapshot.top.map((t) => [
                t.name,
                t.isin,
                t.netShortPct,
                t.positionDate,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      </div>
      <MagnitudeBarList lines={barLines} hue="var(--down)" />

      <h3 className="section-heading" style={{ marginTop: 24 }}>
        Position history
      </h3>
      <select
        className="search-input"
        style={{ maxWidth: 340, marginBottom: 14 }}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {snapshot.top.map((t) => (
          <option key={t.isin} value={t.isin}>
            {t.name}
          </option>
        ))}
      </select>

      {history.length === 0 ? (
        <div className="empty-state">
          No historical disclosures found for this name.
        </div>
      ) : (
        <table className="watchlist-table" style={{ maxWidth: 480 }}>
          <thead>
            <tr>
              <th>Position date</th>
              <th className="num">Net short %</th>
            </tr>
          </thead>
          <tbody>
            {history
              .slice()
              .reverse()
              .slice(0, 20)
              .map((h) => (
                <tr key={h.positionDate}>
                  <td>{h.positionDate}</td>
                  <td className="num-cell">{h.netShortPct.toFixed(2)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
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
