import { useEffect, useState } from "react";
import type { MacroSnapshot, UkGiltYieldSnapshot } from "@ruff-term/shared";
import { fetchMacro, fetchUkGiltYields } from "../api/client";
import { InstrumentPanelGrid } from "./InstrumentPanelGrid";
import { SourceFooter } from "./SourceFooter";

function pctClass(value: number): string {
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

function GiltYieldTable({ gilts }: { gilts: UkGiltYieldSnapshot | null | "error" }) {
  if (gilts === "error") {
    return <div className="empty-state">Bank of England yield curve fetch failed.</div>;
  }
  if (gilts === null) {
    return <div className="empty-state">Loading UK gilt yields…</div>;
  }
  return (
    <div className="macro-panel-card">
      <div className="macro-panel-title">UK Gilt Yields — BoE spot curve ({gilts.asOfDate})</div>
      <table className="macro-table">
        <thead>
          <tr>
            <th>Tenor</th>
            <th className="num">Yield</th>
            <th className="num">1D chg (bp)</th>
          </tr>
        </thead>
        <tbody>
          {gilts.lines.map((line) => (
            <tr key={line.tenorYears}>
              <td className="ticker-cell">{line.tenorYears}yr</td>
              <td className="num-cell">{line.yieldPct.toFixed(3)}%</td>
              <td className={`num-cell ${pctClass(line.changeBp1d)}`}>
                {line.changeBp1d > 0 ? "+" : ""}
                {line.changeBp1d}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MacroMonitor() {
  const [snapshot, setSnapshot] = useState<MacroSnapshot | null>(null);
  const [gilts, setGilts] = useState<UkGiltYieldSnapshot | null | "error">(null);

  useEffect(() => {
    fetchMacro()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
    fetchUkGiltYields()
      .then(setGilts)
      .catch(() => setGilts("error"));
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Macro Monitor</div>
          <div className="module-banner-sub">
            Global futures, indices, FX, rates and UK gilts in one sheet.
            {snapshot ? ` As of ${new Date(snapshot.asOf).toLocaleTimeString()}.` : ""}
          </div>
        </div>
      </div>
      {snapshot === null ? (
        <div className="empty-state">Loading macro data…</div>
      ) : (
        <InstrumentPanelGrid panels={snapshot.panels} />
      )}
      <div className="macro-grid" style={{ marginTop: 14 }}>
        <GiltYieldTable gilts={gilts} />
      </div>
      <SourceFooter
        sources={[
          "Yahoo Finance (live futures/indices/FX/US rates, UK gilt ETF proxies)",
          "Bank of England (real UK gilt spot yields, updated daily)",
        ]}
      />
    </div>
  );
}
