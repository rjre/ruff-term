import { useEffect, useMemo, useState } from "react";
import type { ShortPositionsSnapshot } from "@ruff-term/shared";
import { fetchShortPositions } from "../api/client";
import { ChartExplodeModal } from "./ChartExplodeModal";
import { SourceFooter } from "./SourceFooter";
import { downloadCsv } from "../lib/exportCsv";
import { HistorySeriesChart } from "./HistorySeriesChart";
import { MagnitudeBarList } from "./MagnitudeBarList";
import { Sparkline } from "./Sparkline";

export function ShortPositionsPanel() {
  const [snapshot, setSnapshot] = useState<ShortPositionsSnapshot | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [exploded, setExploded] = useState(false);

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

  const selectedName = snapshot?.top.find((t) => t.isin === selected)?.name ?? "";
  const reconstructedCount = history.filter((h) => h.reconstructed).length;
  const officialCount = history.length - reconstructedCount;

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
    .map((t) => ({ label: t.name, pct: t.netShortPct, key: t.isin }));

  const sources = [{ label: snapshot.sourceLabel, url: snapshot.sourceUrl }];
  if (snapshot.individualRegimeSourceLabel && snapshot.individualRegimeSourceUrl) {
    sources.push({
      label: snapshot.individualRegimeSourceLabel,
      url: snapshot.individualRegimeSourceUrl,
    });
  }

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
          Top 15 most-shorted names (aggregated net short %) — click a name for its history
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
      <MagnitudeBarList
        lines={barLines}
        hue="var(--down)"
        onSelect={setSelected}
        selectedKey={selected}
      />

      <h3 className="section-heading" style={{ marginTop: 24 }}>
        Position history{selectedName ? ` — ${selectedName}` : ""}
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
        <>
          <button
            className="chart-explode-trigger"
            onClick={() => setExploded(true)}
            title={`See ${selectedName}'s full history as a chart`}
          >
            <Sparkline
              values={history.map((h) => h.netShortPct)}
              color="var(--down)"
              width={480}
              height={90}
            />
          </button>
          <div className="vol-legend-note" style={{ margin: "6px 0 14px" }}>
            {history[0].positionDate} to {history[history.length - 1].positionDate}
            {reconstructedCount > 0 && officialCount > 0
              ? ` — ${reconstructedCount} reconstructed from individual disclosures under the previous regime, ${officialCount} from FCA's current aggregate feed.`
              : reconstructedCount > 0
                ? " — all reconstructed from individual disclosures under the previous regime."
                : " — all from FCA's current aggregate feed."}
          </div>
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
                    <td>
                      {h.positionDate}
                      {h.reconstructed ? " *" : ""}
                    </td>
                    <td className="num-cell">{h.netShortPct.toFixed(2)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {reconstructedCount > 0 && (
            <div className="vol-legend-note" style={{ marginTop: 4 }}>
              * reconstructed from individual holder disclosures, not FCA's own aggregate figure
            </div>
          )}
        </>
      )}

      <SourceFooter sources={sources} />

      {exploded && (
        <ChartExplodeModal
          title={`${selectedName} — net short %`}
          subtitle={`${history[0]?.positionDate} to ${history[history.length - 1]?.positionDate}`}
          onClose={() => setExploded(false)}
        >
          <HistorySeriesChart
            points={history.map((h) => ({ date: h.positionDate, value: h.netShortPct }))}
            color="#d03b3b"
          />
        </ChartExplodeModal>
      )}
    </div>
  );
}
