import { useEffect, useState } from "react";
import type {
  CentralBankBalanceSheetSeries,
  CentralBankBalanceSheetSnapshot,
} from "@ruff-term/shared";
import { fetchCentralBankBalanceSheets } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { Sparkline } from "./Sparkline";
import { pctClass } from "../lib/format";
import { SourceFooter } from "./SourceFooter";

function formatBn(valueBn: number, currency: string): string {
  return `${currency} ${valueBn.toLocaleString(undefined, { maximumFractionDigits: 0 })}bn`;
}

function BalanceSheetCard({
  series,
}: {
  series: CentralBankBalanceSheetSeries;
}) {
  const latest = series.points[series.points.length - 1];
  const yearAgo = series.points[Math.max(0, series.points.length - 53)];
  const changePct = yearAgo.valueBn
    ? ((latest.valueBn - yearAgo.valueBn) / yearAgo.valueBn) * 100
    : 0;

  return (
    <div className="macro-panel-card" style={{ padding: 14 }}>
      <div
        className="macro-panel-title"
        style={{ padding: 0, border: "none", marginBottom: 10 }}
      >
        {series.bank}
      </div>
      <div className="kpi-value">
        {formatBn(latest.valueBn, series.currency)}
      </div>
      <div
        className={`num-cell ${pctClass(changePct)}`}
        style={{ marginBottom: 10 }}
      >
        {changePct > 0 ? "+" : ""}
        {changePct.toFixed(1)}% vs 1Y ago
      </div>
      <Sparkline
        values={series.points.map((p) => p.valueBn)}
        color="var(--ruffer-green-light)"
      />
      <div className="kpi-label" style={{ marginTop: 8 }}>
        As of {latest.date}
      </div>
    </div>
  );
}

export function CentralBankBalanceSheetsPanel() {
  const [snapshot, setSnapshot] =
    useState<CentralBankBalanceSheetSnapshot | null>(null);

  useEffect(() => {
    fetchCentralBankBalanceSheets()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  if (!snapshot) {
    return (
      <div className="module-view">
        <div className="empty-state">Loading central bank balance sheets…</div>
      </div>
    );
  }

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Central Bank Balance Sheets</div>
          <div className="module-banner-sub">
            Total assets, weekly/monthly, last ~2 years — a read on QE/QT pace
            across the major central banks.
          </div>
        </div>
      </div>

      <div className="screener-toolbar">
        <button
          className="icon-btn"
          onClick={() =>
            downloadCsv("central-bank-balance-sheets", [
              ["Bank", "Currency", "Date", "Total assets (bn)"],
              ...snapshot.series.flatMap((s) =>
                s.points.map((p) => [s.bank, s.currency, p.date, p.valueBn]),
              ),
            ])
          }
        >
          Export CSV
        </button>
      </div>

      <div className="macro-grid">
        {snapshot.series.map((s) => (
          <BalanceSheetCard key={s.bank} series={s} />
        ))}
      </div>

      <div className="note-banner">
        The Bank of England does not publish an equivalent single free
        machine-readable weekly total assets series, so it's omitted here rather
        than approximated.
      </div>

      <SourceFooter
        sources={snapshot.series.map((s) => ({
          label: `FRED — ${s.bank}`,
          url: s.sourceUrl,
        }))}
      />
    </div>
  );
}
