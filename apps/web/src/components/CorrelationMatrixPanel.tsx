import { useEffect, useState } from "react";
import type { CorrelationMatrixSnapshot } from "@ruff-term/shared";
import { fetchCorrelationMatrix } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { SourceFooter } from "./SourceFooter";

const RANGES: Array<{ label: string; days: number }> = [
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

function cellStyle(value: number): { background: string; color: string } {
  const alpha = Math.min(Math.abs(value), 1) * 0.75;
  const background =
    value >= 0 ? `rgba(12,163,12,${alpha})` : `rgba(208,59,59,${alpha})`;
  const color = alpha > 0.45 ? "#ffffff" : "var(--text)";
  return { background, color };
}

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function CorrelationMatrixPanel({ onSelectTicker }: Props) {
  const [rangeDays, setRangeDays] = useState(180);
  const [snapshot, setSnapshot] = useState<CorrelationMatrixSnapshot | null>(
    null,
  );

  useEffect(() => {
    setSnapshot(null);
    fetchCorrelationMatrix(rangeDays)
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, [rangeDays]);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Correlation Matrix</div>
          <div className="module-banner-sub">
            How major asset classes are actually moving together right now —
            daily log-return correlation across equities, rates, gold, oil, the
            dollar and vol.
          </div>
        </div>
      </div>

      <div className="chart-toolbar-group" style={{ marginBottom: 16 }}>
        {RANGES.map((r) => (
          <button
            key={r.label}
            className={`toggle-btn ${rangeDays === r.days ? "active" : ""}`}
            onClick={() => setRangeDays(r.days)}
          >
            {r.label}
          </button>
        ))}
        <button
          className="icon-btn"
          disabled={!snapshot}
          onClick={() =>
            snapshot &&
            downloadCsv("correlation-matrix", [
              ["", ...snapshot.labels],
              ...snapshot.matrix.map((row, i) => [snapshot.labels[i], ...row]),
            ])
          }
        >
          Export CSV
        </button>
      </div>

      {!snapshot ? (
        <div className="empty-state">Loading correlation matrix…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="corr-table">
            <thead>
              <tr>
                <th />
                {snapshot.labels.map((label, j) => (
                  <th key={label}>
                    {onSelectTicker ? (
                      <button
                        className="label-btn"
                        onClick={() => onSelectTicker(snapshot.tickers[j])}
                      >
                        {label}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshot.matrix.map((row, i) => (
                <tr key={snapshot.tickers[i]}>
                  <th scope="row">
                    {onSelectTicker ? (
                      <button
                        className="label-btn"
                        onClick={() => onSelectTicker(snapshot.tickers[i])}
                      >
                        {snapshot.labels[i]}
                      </button>
                    ) : (
                      snapshot.labels[i]
                    )}
                  </th>
                  {row.map((value, j) => (
                    <td key={snapshot.tickers[j]} style={cellStyle(value)}>
                      {value.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="note-banner">
        Pearson correlation of daily log returns. +1 = move in lockstep, -1 =
        move in exact opposition, 0 = no linear relationship. Correlations are
        not stable — they shift with the macro regime, which is the point of
        checking this rather than assuming last year's diversification still
        holds.
      </div>

      <SourceFooter sources={["Yahoo Finance (daily closes, live)"]} />
    </div>
  );
}
