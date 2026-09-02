import { useEffect, useState } from "react";
import type { UstActivitySnapshot } from "@ruff-term/shared";
import { fetchUstActivity } from "../api/client";
import { MagnitudeBarList } from "./MagnitudeBarList";

function pctClass(value: number): string {
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function UstActivityPanel({ onSelectTicker }: Props) {
  const [snapshot, setSnapshot] = useState<UstActivitySnapshot | null>(null);

  useEffect(() => {
    fetchUstActivity()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  if (!snapshot) {
    return (
      <div className="module-view">
        <div className="empty-state">Loading UST activity…</div>
      </div>
    );
  }

  const subtypeLines = snapshot.demoVolumeBySubtype.map((l) => ({
    label: l.label,
    pct: l.parValueBn,
  }));
  const maturityLines = snapshot.demoVolumeByMaturity.map((l) => ({
    label: l.label,
    pct: l.parValueBn,
  }));

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">UST Trading Activity</div>
          <div className="module-banner-sub">
            Live Treasury ETF proxies by maturity, plus an illustrative FINRA
            TRACE-style volume breakdown.
          </div>
        </div>
      </div>

      <h3 className="section-heading">Treasury ETF proxies — live</h3>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th className="num">Last</th>
            <th className="num">%1D</th>
            <th className="num">Volume</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.etfs.map((e) => (
            <tr
              key={e.ticker}
              className={onSelectTicker ? "screener-row-clickable" : undefined}
              onClick={
                onSelectTicker ? () => onSelectTicker(e.ticker) : undefined
              }
            >
              <td className="ticker-cell">{e.label}</td>
              <td className="num-cell">{e.lastPrice.toFixed(2)}</td>
              <td className={`num-cell ${pctClass(e.changePct1d)}`}>
                {formatSignedPct(e.changePct1d)}
              </td>
              <td className="num-cell">{e.volume.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="demo-banner" style={{ marginTop: 20 }}>
        DEMO DATA below — illustrative of FINRA TRACE Treasury aggregate
        reporting categories, not real FINRA figures (that requires a FINRA
        account/API key).
      </div>
      <div className="portfolio-grid">
        <section className="portfolio-section">
          <h3 className="section-heading">
            Volume by security subtype ($bn par, illustrative)
          </h3>
          <MagnitudeBarList
            lines={subtypeLines}
            hue="var(--ruffer-green-light)"
            unit="bn"
          />
        </section>
        <section className="portfolio-section">
          <h3 className="section-heading">
            Volume by maturity bucket ($bn par, illustrative)
          </h3>
          <MagnitudeBarList lines={maturityLines} hue="#2a78d6" unit="bn" />
        </section>
      </div>

      <div className="source-footer">
        Concept source:{" "}
        <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">
          {snapshot.sourceLabel}
        </a>
      </div>
    </div>
  );
}
