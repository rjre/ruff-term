import { useEffect, useState } from "react";
import type {
  ChartsOfTheDaySnapshot,
  RegimeBarometerLine,
} from "@ruff-term/shared";
import { fetchChartsOfTheDay } from "../api/client";
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

function DivergingBars({ lines }: { lines: RegimeBarometerLine[] }) {
  const max = Math.max(...lines.map((l) => Math.abs(l.changePct1d)), 0.5);
  return (
    <div className="diverging-list">
      {lines.map((line) => {
        const widthPct = (Math.abs(line.changePct1d) / max) * 50;
        return (
          <div className="diverging-row" key={line.ticker}>
            <span className="diverging-label">{line.label}</span>
            <div className="diverging-track">
              <div className="diverging-baseline" />
              <div
                className={`diverging-fill ${line.changePct1d >= 0 ? "diverging-up" : "diverging-down"}`}
                style={
                  line.changePct1d >= 0
                    ? { left: "50%", width: `${widthPct}%` }
                    : { right: "50%", width: `${widthPct}%` }
                }
              />
            </div>
            <span className={`diverging-value ${pctClass(line.changePct1d)}`}>
              {formatSignedPct(line.changePct1d)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function regimeSignal(growthAvg: number, protectionAvg: number): string {
  const gap = growthAvg - protectionAvg;
  if (Math.abs(gap) < 0.15) return "Mixed — no clear regime signal today";
  return gap > 0 ? "Growth leading today" : "Protection leading today";
}

export function ChartsOfTheDayPanel() {
  const [snapshot, setSnapshot] = useState<ChartsOfTheDaySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await fetchChartsOfTheDay();
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

  if (!snapshot) {
    return (
      <div className="module-view">
        <div className="empty-state">Loading charts of the day…</div>
      </div>
    );
  }

  const growthLines = snapshot.regimeBarometer.filter(
    (l) => l.group === "Growth",
  );
  const protectionLines = snapshot.regimeBarometer.filter(
    (l) => l.group === "Protection",
  );
  const themeLines = snapshot.newsThemes.map((t) => ({
    label: t.theme,
    pct: t.count,
  }));

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Charts of the Day</div>
          <div className="module-banner-sub">
            Today's growth-vs-protection regime, read through Ruffer's own
            public asset-allocation categories, plus what the portfolio newsflow
            is actually about. Refreshes every 30s.
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-tile">
          <div className="kpi-label">Growth assets avg</div>
          <div className={`kpi-value ${pctClass(snapshot.growthAvgPct)}`}>
            {formatSignedPct(snapshot.growthAvgPct)}
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Protection assets avg</div>
          <div className={`kpi-value ${pctClass(snapshot.protectionAvgPct)}`}>
            {formatSignedPct(snapshot.protectionAvgPct)}
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Signal</div>
          <div className="kpi-value">
            {regimeSignal(snapshot.growthAvgPct, snapshot.protectionAvgPct)}
          </div>
        </div>
      </div>

      <div className="portfolio-grid">
        <section className="portfolio-section">
          <h3 className="section-heading">Growth assets — today's move</h3>
          <DivergingBars lines={growthLines} />
          <h3 className="section-heading" style={{ marginTop: 18 }}>
            Protection assets — today's move
          </h3>
          <DivergingBars lines={protectionLines} />
        </section>

        <section className="portfolio-section">
          <h3 className="section-heading">
            What's the newsflow actually about
          </h3>
          <MagnitudeBarList
            lines={themeLines}
            hue="var(--ruffer-green-light)"
            unit=""
          />
        </section>
      </div>

      <div className="source-footer">
        Growth/protection proxies are liquid ETFs (SPY, QQQ, EEM, EFA vs GLD,
        TLT, IEF, FXY), live via Yahoo Finance. News themes are
        keyword-classified from today's portfolio newsflow.
      </div>
    </div>
  );
}
