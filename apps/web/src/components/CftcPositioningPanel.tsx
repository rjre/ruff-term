import { useEffect, useState } from "react";
import type {
  CftcPositioningLine,
  CftcPositioningSnapshot,
} from "@ruff-term/shared";
import { fetchCftcPositioning } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { pctClass } from "../lib/format";

function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString()}`;
}

function pctOfOi(line: CftcPositioningLine): number {
  if (!line.openInterest) return 0;
  return (line.netNoncommPosition / line.openInterest) * 100;
}

function DivergingBars({ lines }: { lines: CftcPositioningLine[] }) {
  const values = lines.map(pctOfOi);
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  return (
    <div className="diverging-list">
      {lines.map((line) => {
        const v = pctOfOi(line);
        const widthPct = (Math.abs(v) / max) * 50;
        return (
          <div className="diverging-row" key={line.contractMarketCode}>
            <span className="diverging-label">{line.label}</span>
            <div className="diverging-track">
              <div className="diverging-baseline" />
              <div
                className={`diverging-fill ${v >= 0 ? "diverging-up" : "diverging-down"}`}
                style={
                  v >= 0
                    ? { left: "50%", width: `${widthPct}%` }
                    : { right: "50%", width: `${widthPct}%` }
                }
              />
            </div>
            <span className={`diverging-value ${pctClass(v)}`}>
              {v.toFixed(1)}% OI
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CftcPositioningPanel() {
  const [snapshot, setSnapshot] = useState<CftcPositioningSnapshot | null>(
    null,
  );

  useEffect(() => {
    fetchCftcPositioning()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  if (!snapshot) {
    return (
      <div className="module-view">
        <div className="empty-state">Loading CFTC positioning…</div>
      </div>
    );
  }

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">CFTC Positioning</div>
          <div className="module-banner-sub">
            Speculative (non-commercial) net positioning in key financial and
            commodity futures, as of the latest weekly Commitments of Traders
            report ({snapshot.lines[0]?.reportDate ?? "—"}).
          </div>
        </div>
      </div>

      <h3 className="section-heading">
        Net speculative position, as % of open interest
      </h3>
      <DivergingBars lines={snapshot.lines} />

      <div className="screener-toolbar" style={{ marginTop: 24 }}>
        <h3 className="section-heading" style={{ margin: 0 }}>
          Detail
        </h3>
        <button
          className="icon-btn"
          onClick={() =>
            downloadCsv("cftc-positioning", [
              [
                "Contract",
                "Report date",
                "Open interest",
                "Net spec position",
                "1W change",
              ],
              ...snapshot.lines.map((l) => [
                l.label,
                l.reportDate,
                l.openInterest,
                l.netNoncommPosition,
                l.netNoncommChange1w,
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
            <th>Contract</th>
            <th className="num">Open interest</th>
            <th className="num">Net spec position</th>
            <th className="num">1W change</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.lines.map((l) => (
            <tr key={l.contractMarketCode}>
              <td className="ticker-cell">{l.label}</td>
              <td className="num-cell">{l.openInterest.toLocaleString()}</td>
              <td className={`num-cell ${pctClass(l.netNoncommPosition)}`}>
                {formatSigned(l.netNoncommPosition)}
              </td>
              <td className={`num-cell ${pctClass(l.netNoncommChange1w)}`}>
                {formatSigned(l.netNoncommChange1w)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="note-banner">
        Net spec position = non-commercial (speculative) long contracts minus
        short contracts. Positive means speculators are net long; negative means
        net short. Data is weekly (Tuesday snapshot, published the following
        Friday) — not live intraday.
      </div>

      <div className="source-footer">
        Source:{" "}
        <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
          {snapshot.sourceLabel}
        </a>
      </div>
    </div>
  );
}
