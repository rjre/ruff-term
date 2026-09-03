import { useEffect, useMemo, useState } from "react";
import type { PortfolioSnapshot } from "@ruff-term/shared";
import { fetchPortfolioSnapshot } from "../api/client";
import { MagnitudeBarList } from "./MagnitudeBarList";
import { pctClass } from "../lib/format";

// Validated categorical slots (light mode) from the dataviz palette — fixed
// order, first three slots, all-pairs-safe: blue, orange, aqua.
const CATEGORY_COLORS: Record<string, string> = {
  Inflation: "#2a78d6",
  Protection: "#eb6834",
  Growth: "#1baf7a",
};
const CATEGORY_ORDER = ["Inflation", "Protection", "Growth"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function PortfolioPanel() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);

  useEffect(() => {
    fetchPortfolioSnapshot()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  const categoryTotals = useMemo(() => {
    if (!snapshot) return [];
    const totals = new Map<string, number>();
    for (const line of snapshot.assetAllocation) {
      totals.set(line.category, (totals.get(line.category) ?? 0) + line.pct);
    }
    return CATEGORY_ORDER.filter((c) => totals.has(c)).map((category) => ({
      category,
      pct: totals.get(category)!,
    }));
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="module-view">
        <div className="empty-state">Loading portfolio snapshot…</div>
      </div>
    );
  }

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">{snapshot.fundName}</div>
          <div className="module-banner-sub">
            As of {formatDate(snapshot.asOfDate)} · Fund size £{snapshot.fundSizeGBPm.toLocaleString()}m
          </div>
        </div>
      </div>

      <div className="kpi-row">
        {snapshot.performance.map((p) => (
          <div className="kpi-tile" key={p.period}>
            <div className="kpi-label">{p.period}</div>
            <div className={`kpi-value ${pctClass(p.valuePct)}`}>{formatSignedPct(p.valuePct)}</div>
          </div>
        ))}
      </div>

      <div className="portfolio-grid">
        <section className="portfolio-section">
          <h3 className="section-heading">Asset allocation</h3>
          <div className="allocation-bar-track">
            {categoryTotals.map((c) => (
              <div
                key={c.category}
                className="allocation-segment"
                style={{ width: `${c.pct}%`, background: CATEGORY_COLORS[c.category] }}
                title={`${c.category}: ${c.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="allocation-legend">
            {categoryTotals.map((c) => (
              <div className="legend-item" key={c.category}>
                <span className="legend-swatch" style={{ background: CATEGORY_COLORS[c.category] }} />
                {c.category} · {c.pct.toFixed(1)}%
              </div>
            ))}
          </div>
          <table className="allocation-table">
            <tbody>
              {snapshot.assetAllocation.map((line) => (
                <tr key={line.label}>
                  <td>
                    <span className="legend-swatch" style={{ background: CATEGORY_COLORS[line.category] }} />
                  </td>
                  <td className="allocation-line-label">{line.label}</td>
                  <td className="num-cell">{line.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="portfolio-section">
          <h3 className="section-heading">Currency allocation</h3>
          <MagnitudeBarList lines={snapshot.currencyAllocation} hue="var(--ruffer-green-light)" />

          <h3 className="section-heading" style={{ marginTop: 18 }}>
            Geographical equity allocation
          </h3>
          <MagnitudeBarList lines={snapshot.geographicalEquityAllocation} hue="#2a78d6" />

          <h3 className="section-heading" style={{ marginTop: 18 }}>
            5 largest equity holdings
          </h3>
          <table className="allocation-table">
            <tbody>
              {snapshot.topHoldings.map((h) => (
                <tr key={h.name}>
                  <td className="allocation-line-label">{h.name}</td>
                  <td className="num-cell">{h.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="source-footer">
        Source:{" "}
        <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
          {snapshot.sourceLabel}
        </a>
        . Manually refreshed snapshot — not a live feed.
      </div>
    </div>
  );
}
