import { useEffect, useState } from "react";
import type { CreditHistoricSnapshot, CreditSeriesResult } from "@ruff-term/shared";
import { fetchCreditHistoric } from "../api/client";
import { changeOverLookback } from "../lib/creditSeries";
import { downloadCsv } from "../lib/exportCsv";
import { formatSigned } from "../lib/format";
import { PriceStamp } from "./PriceStamp";
import { Sparkline } from "./Sparkline";
import { SourceFooter } from "./SourceFooter";

const REGION_CLASS: Record<string, string> = { US: "credit-region-us", EU: "credit-region-eu" };

function formatBp(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} bp`;
}

function formatChangeBp(value: number | null): string {
  return value === null ? "—" : `${formatSigned(value, 1)} bp`;
}

/**
 * Spread-aware coloring: wider (positive change) is deteriorating credit —
 * red — while tighter (negative) is improving — green. The inverse of
 * `pctClass`, which assumes positive means "up and good" as for a price.
 */
function creditChangeClass(value: number | null): string {
  if (value === null || value === 0) return "pct-flat";
  return value > 0 ? "pct-down" : "pct-up";
}

function InstrumentCard({ instrument }: { instrument: CreditSeriesResult }) {
  const change1y = changeOverLookback(instrument.series, 365);
  const values = instrument.series.map((p) => p.value);
  return (
    <div className={`credit-card ${REGION_CLASS[instrument.region] ?? ""}`}>
      <div className="credit-card-head">
        <span className="credit-card-label">{instrument.label}</span>
        <span className="credit-card-tenor">{instrument.tenor}</span>
      </div>
      <div className="credit-card-value">{formatBp(instrument.latest)}</div>
      <div className={`credit-card-change ${creditChangeClass(change1y)}`}>
        {formatChangeBp(change1y)} 1Y
      </div>
      {values.length >= 2 && (
        <Sparkline
          values={values}
          color={
            change1y === null
              ? "var(--text-faint)"
              : change1y >= 0
                ? "var(--down)"
                : "var(--up)"
          }
          width={200}
          height={40}
        />
      )}
      <PriceStamp at={instrument.latestDate} prefix="As of" />
    </div>
  );
}

function CurveTable({ curve }: { curve: CreditHistoricSnapshot["curves"][number] }) {
  return (
    <div className="credit-curve">
      <table className="watchlist-table vol-table">
        <thead>
          <tr>
            <th>{curve.label}</th>
            {curve.points.map((p) => (
              <th key={p.tenor} className="num">
                {p.tenor}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="ticker-cell">
              <PriceStamp at={curve.asOfDate} prefix="As of" />
            </td>
            {curve.points.map((p) => (
              <td key={p.tenor} className="num-cell vol-cell vol-quoted">
                {formatBp(p.value)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function exportBoard(name: string, instruments: CreditSeriesResult[]): void {
  downloadCsv(name, [
    ["Instrument", "Region", "Tenor", "Latest (bp)", "1Y change (bp)", "As of"],
    ...instruments.map((i) => [
      i.label,
      i.region,
      i.tenor,
      i.latest ?? "",
      changeOverLookback(i.series, 365) ?? "",
      i.latestDate ?? "",
    ]),
  ]);
}

/**
 * Ten years of daily CDS spreads pulled from Citi Velocity's Historical Data
 * API in one metered call per tag — see apps/server/src/citi/credit.ts. This
 * is the same rjre/fx-data entitlement the FX vol surface uses, aimed at the
 * CREDIT tag tree instead of FX.VOL: CDX and iTraxx index composite spreads,
 * their term structures, and Europe/US sovereign CDS.
 */
export function CreditHistoricPanel() {
  const [snapshot, setSnapshot] = useState<CreditHistoricSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCreditHistoric()
      .then((s) => !cancelled && setSnapshot(s))
      .catch(() => !cancelled && setSnapshot(null));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Citi — Credit Historic</div>
          <div className="module-banner-sub">
            CDX and iTraxx CDS index spreads, their term structures, and
            Europe/US sovereign CDS —{" "}
            {snapshot ? `${snapshot.lookbackYears}-year daily history` : "loading"}, Markit composite spreads via
            Citi Velocity.
            {snapshot?.asOfDate ? ` Last close ${snapshot.asOfDate}.` : ""}
          </div>
        </div>
      </div>

      {snapshot?.note && <div className="demo-banner">{snapshot.note}</div>}

      {!snapshot ? (
        <div className="empty-state">Loading credit history…</div>
      ) : (
        <>
          <div className="screener-toolbar">
            <h3 className="section-heading" style={{ margin: 0 }}>
              CDS indices
            </h3>
            <button className="icon-btn" onClick={() => exportBoard("citi-credit-indices", snapshot.indices)}>
              Export CSV
            </button>
          </div>
          <div className="credit-board">
            {snapshot.indices.map((i) => (
              <InstrumentCard key={i.key} instrument={i} />
            ))}
          </div>

          <h3 className="section-heading" style={{ marginTop: 24 }}>
            Term structures
          </h3>
          {snapshot.curves
            .filter((c) => c.key === "CDX_NA_IG_CURVE" || c.key === "ITRAXX_MAIN_CURVE")
            .map((c) => (
              <CurveTable key={c.key} curve={c} />
            ))}

          <div className="screener-toolbar" style={{ marginTop: 24 }}>
            <h3 className="section-heading" style={{ margin: 0 }}>
              Sovereign CDS — Europe &amp; US
            </h3>
            <button
              className="icon-btn"
              onClick={() => exportBoard("citi-credit-sovereigns", snapshot.sovereigns)}
            >
              Export CSV
            </button>
          </div>
          <div className="credit-board">
            {snapshot.sovereigns.map((i) => (
              <InstrumentCard key={i.key} instrument={i} />
            ))}
          </div>

          <h3 className="section-heading" style={{ marginTop: 24 }}>
            Sovereign curves — core vs periphery
          </h3>
          {snapshot.curves
            .filter((c) => c.key === "SOV_DE_CURVE" || c.key === "SOV_IT_CURVE")
            .map((c) => (
              <CurveTable key={c.key} curve={c} />
            ))}

          <div className="vol-legend" style={{ marginTop: 18 }}>
            <span className="vol-legend-note">
              {snapshot.callsSpent} of ~10 metered calls used per tag. Cached
              for 24h; refetched at most once a day.
            </span>
          </div>
        </>
      )}

      <SourceFooter
        sources={[
          { label: "Citi Velocity (Markit composite CDS spreads, EOD)", url: "https://velocity.citi.com" },
        ]}
      />
    </>
  );
}
