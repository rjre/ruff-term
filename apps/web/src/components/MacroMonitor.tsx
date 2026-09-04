import { useEffect, useState } from "react";
import type {
  InflationExpectationsSnapshot,
  MacroSnapshot,
  UkGiltYieldSnapshot,
} from "@ruff-term/shared";
import {
  fetchInflationExpectations,
  fetchMacro,
  fetchUkGiltYields,
} from "../api/client";
import { InstrumentPanelGrid } from "./InstrumentPanelGrid";
import { SourceFooter } from "./SourceFooter";
import { pctClass } from "../lib/format";
import { PriceStamp } from "./PriceStamp";

function GiltYieldTable({
  gilts,
}: {
  gilts: UkGiltYieldSnapshot | null | "error";
}) {
  if (gilts === "error") {
    return (
      <div className="empty-state">
        Bank of England yield curve fetch failed.
      </div>
    );
  }
  if (gilts === null) {
    return <div className="empty-state">Loading UK gilt yields…</div>;
  }
  return (
    <div className="macro-panel-card">
      <div className="macro-panel-title">
        UK Gilt Yields — BoE spot curve
      </div>
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
              <td className="num-cell price-cell">
                <div>{line.yieldPct.toFixed(3)}%</div>
                <PriceStamp at={gilts.asOfDate} prefix="As of" />
              </td>
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

function InflationExpectationsTable({
  snapshot,
}: {
  snapshot: InflationExpectationsSnapshot | null | "error";
}) {
  if (snapshot === "error") {
    return (
      <div className="empty-state">
        FRED inflation expectations fetch failed.
      </div>
    );
  }
  if (snapshot === null) {
    return <div className="empty-state">Loading inflation expectations…</div>;
  }
  return (
    <div className="macro-panel-card">
      <div className="macro-panel-title">
        US Inflation Expectations — TIPS breakevens (FRED)
      </div>
      <table className="macro-table">
        <thead>
          <tr>
            <th>Series</th>
            <th className="num">Level</th>
            <th className="num">1D chg (bp)</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.lines.map((line) => (
            <tr key={line.label}>
              <td className="ticker-cell">{line.label}</td>
              <td className="num-cell price-cell">
                <div>{line.valuePct.toFixed(2)}%</div>
                <PriceStamp at={line.asOfDate} prefix="As of" />
              </td>
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

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function MacroMonitor({ onSelectTicker }: Props) {
  const [snapshot, setSnapshot] = useState<MacroSnapshot | null>(null);
  const [gilts, setGilts] = useState<UkGiltYieldSnapshot | null | "error">(
    null,
  );
  const [inflation, setInflation] = useState<
    InflationExpectationsSnapshot | null | "error"
  >(null);

  useEffect(() => {
    fetchUkGiltYields()
      .then(setGilts)
      .catch(() => setGilts("error"));
    fetchInflationExpectations()
      .then(setInflation)
      .catch(() => setInflation("error"));
  }, []);

  // Futures/indices/FX/rates move intraday — poll those, but not the gilt
  // yield curve or inflation breakevens above, which only update daily.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await fetchMacro();
        if (!cancelled) setSnapshot(data);
      } catch {
        // keep showing the last good snapshot
      }
    }
    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Macro Monitor</div>
          <div className="module-banner-sub">
            Global futures, indices, FX, rates and UK gilts in one sheet,
            refreshing every 30s.
            {snapshot
              ? ` Last update ${new Date(snapshot.asOf).toLocaleTimeString()}.`
              : ""}
          </div>
        </div>
      </div>
      {snapshot === null ? (
        <div className="empty-state">Loading macro data…</div>
      ) : (
        <InstrumentPanelGrid
          panels={snapshot.panels}
          onSelectTicker={onSelectTicker}
        />
      )}
      <div className="macro-grid" style={{ marginTop: 14 }}>
        <GiltYieldTable gilts={gilts} />
        <InflationExpectationsTable snapshot={inflation} />
      </div>
      <SourceFooter
        sources={[
          {
            label: "Yahoo Finance (live futures/indices/FX/US rates, UK gilt ETF proxies)",
            url: "https://finance.yahoo.com",
          },
          gilts && gilts !== "error"
            ? { label: gilts.sourceLabel, url: gilts.sourceUrl }
            : "Bank of England (real UK gilt spot yields, updated daily)",
          ...(inflation && inflation !== "error"
            ? inflation.lines.map((line) => ({
                label: `FRED — ${line.label}`,
                url: line.sourceUrl,
              }))
            : ["FRED (US TIPS breakeven inflation, updated daily)"]),
        ]}
      />
    </div>
  );
}
