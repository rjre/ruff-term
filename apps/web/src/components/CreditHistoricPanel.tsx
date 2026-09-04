import { useEffect, useState } from "react";
import type { CreditHistoricSnapshot, CreditSeriesResult } from "@ruff-term/shared";
import { fetchCreditHistoric } from "../api/client";
import { ChartExplodeModal } from "./ChartExplodeModal";
import { changeOverLookback } from "../lib/creditSeries";
import { CurveChart } from "./CurveChart";
import { downloadCsv } from "../lib/exportCsv";
import { formatSigned } from "../lib/format";
import { HistorySeriesChart } from "./HistorySeriesChart";
import { cssVar } from "../lib/theme";
import { PriceStamp } from "./PriceStamp";
import { Sparkline } from "./Sparkline";
import { SourceFooter } from "./SourceFooter";

type Curve = CreditHistoricSnapshot["curves"][number];

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

function InstrumentCard({
  instrument,
  onExplode,
}: {
  instrument: CreditSeriesResult;
  onExplode: (instrument: CreditSeriesResult) => void;
}) {
  const change1y = changeOverLookback(instrument.series, 365);
  const values = instrument.series.map((p) => p.value);
  const canExplode = values.length >= 2;
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
      {canExplode && (
        <button
          className="chart-explode-trigger"
          onClick={() => onExplode(instrument)}
          title={`See ${instrument.label}'s full history`}
        >
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
        </button>
      )}
      <PriceStamp at={instrument.latestDate} prefix="As of" />
    </div>
  );
}

function CurveTable({ curve, onExplode }: { curve: Curve; onExplode: (curve: Curve) => void }) {
  return (
    <div
      className="credit-curve chart-explode-trigger"
      onClick={() => onExplode(curve)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onExplode(curve);
      }}
      title={`See ${curve.label} as a chart`}
    >
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
  const [explodedInstrument, setExplodedInstrument] = useState<CreditSeriesResult | null>(null);
  const [explodedCurve, setExplodedCurve] = useState<Curve | null>(null);

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
              <InstrumentCard key={i.key} instrument={i} onExplode={setExplodedInstrument} />
            ))}
          </div>

          <h3 className="section-heading" style={{ marginTop: 24 }}>
            Term structures — click a curve for a full-size chart
          </h3>
          {snapshot.curves
            .filter((c) => c.key === "CDX_NA_IG_CURVE" || c.key === "ITRAXX_MAIN_CURVE")
            .map((c) => (
              <CurveTable key={c.key} curve={c} onExplode={setExplodedCurve} />
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
              <InstrumentCard key={i.key} instrument={i} onExplode={setExplodedInstrument} />
            ))}
          </div>

          <h3 className="section-heading" style={{ marginTop: 24 }}>
            Sovereign curves — core vs periphery — click a curve for a full-size chart
          </h3>
          {snapshot.curves
            .filter((c) => c.key === "SOV_DE_CURVE" || c.key === "SOV_IT_CURVE")
            .map((c) => (
              <CurveTable key={c.key} curve={c} onExplode={setExplodedCurve} />
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

      {explodedInstrument && (
        <ChartExplodeModal
          title={`${explodedInstrument.label} — ${explodedInstrument.tenor}`}
          subtitle={`${explodedInstrument.series[0]?.date} to ${explodedInstrument.series[explodedInstrument.series.length - 1]?.date} · ${formatBp(explodedInstrument.latest)} as of ${explodedInstrument.latestDate}`}
          onClose={() => setExplodedInstrument(null)}
        >
          <HistorySeriesChart
            points={explodedInstrument.series}
            color={
              (changeOverLookback(explodedInstrument.series, 365) ?? 0) >= 0
                ? cssVar("--down")
                : cssVar("--up")
            }
          />
        </ChartExplodeModal>
      )}

      {explodedCurve && (
        <ChartExplodeModal
          title={explodedCurve.label}
          subtitle={explodedCurve.asOfDate ? `As of ${explodedCurve.asOfDate}` : undefined}
          onClose={() => setExplodedCurve(null)}
        >
          <CurveChart points={explodedCurve.points} />
        </ChartExplodeModal>
      )}
    </>
  );
}
