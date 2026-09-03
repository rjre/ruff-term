import { useEffect, useMemo, useState } from "react";
import type {
  ChartsOfTheDaySnapshot,
  CorrelationMatrixSnapshot,
  PriceBar,
  RegimeBarometerLine,
  ScreenerRow,
} from "@ruff-term/shared";
import {
  fetchChartsOfTheDay,
  fetchCorrelationMatrix,
  fetchHistory,
  fetchScreener,
} from "../api/client";
import { MagnitudeBarList } from "./MagnitudeBarList";
import { Sparkline } from "./Sparkline";

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

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function ChartsOfTheDayPanel({ onSelectTicker }: Props) {
  const [snapshot, setSnapshot] = useState<ChartsOfTheDaySnapshot | null>(null);
  const [screenerRows, setScreenerRows] = useState<ScreenerRow[] | null>(null);
  const [moverBars, setMoverBars] = useState<PriceBar[]>([]);
  const [correlation, setCorrelation] =
    useState<CorrelationMatrixSnapshot | null>(null);

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

  // One-shot, not polled — these are "today's talking points", not live
  // ticking data.
  useEffect(() => {
    fetchScreener()
      .then((s) => setScreenerRows(s.rows))
      .catch(() => setScreenerRows([]));
    fetchCorrelationMatrix(90)
      .then(setCorrelation)
      .catch(() => setCorrelation(null));
  }, []);

  const biggestMover = useMemo(() => {
    if (!screenerRows || screenerRows.length === 0) return null;
    return screenerRows.reduce((a, b) =>
      Math.abs(b.changePct1d) > Math.abs(a.changePct1d) ? b : a,
    );
  }, [screenerRows]);

  const nearHigh = useMemo(() => {
    if (!screenerRows || screenerRows.length === 0) return null;
    return screenerRows.reduce((a, b) =>
      b.pctFrom52wHigh > a.pctFrom52wHigh ? b : a,
    );
  }, [screenerRows]);

  const nearLow = useMemo(() => {
    if (!screenerRows || screenerRows.length === 0) return null;
    return screenerRows.reduce((a, b) =>
      b.pctFrom52wLow < a.pctFrom52wLow ? b : a,
    );
  }, [screenerRows]);

  const correlationExtremes = useMemo(() => {
    if (!correlation) return null;
    const { labels, matrix } = correlation;
    let maxPair: { a: string; b: string; value: number } | null = null;
    let minPair: { a: string; b: string; value: number } | null = null;
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const value = matrix[i]?.[j];
        if (value === undefined) continue;
        if (!maxPair || value > maxPair.value) maxPair = { a: labels[i], b: labels[j], value };
        if (!minPair || value < minPair.value) minPair = { a: labels[i], b: labels[j], value };
      }
    }
    return { maxPair, minPair };
  }, [correlation]);

  useEffect(() => {
    if (!biggestMover) return;
    let cancelled = false;
    fetchHistory(biggestMover.ticker, 30)
      .then((r) => !cancelled && setMoverBars(r.bars))
      .catch(() => !cancelled && setMoverBars([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biggestMover?.ticker]);

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
            is actually about. Refreshes every 30s. Last update{" "}
            {new Date(snapshot.asOf).toLocaleTimeString()}.
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

      <h3 className="section-heading">Today's talking points</h3>
      <div className="cotd-grid">
        <div
          className={`cotd-tile${biggestMover && onSelectTicker ? " cotd-tile-clickable" : ""}`}
          onClick={
            biggestMover && onSelectTicker
              ? () => onSelectTicker(biggestMover.ticker)
              : undefined
          }
        >
          <div className="kpi-label">Biggest single-name move today</div>
          {biggestMover ? (
            <>
              <div className="cotd-tile-headline">
                {biggestMover.ticker}
                <span
                  className={`cotd-tile-pct ${pctClass(biggestMover.changePct1d)}`}
                >
                  {formatSignedPct(biggestMover.changePct1d)}
                </span>
              </div>
              <div className="cotd-tile-sub">{biggestMover.name}</div>
              {moverBars.length > 1 && (
                <Sparkline
                  values={moverBars.map((b) => b.close)}
                  color={
                    biggestMover.changePct1d >= 0
                      ? "var(--up)"
                      : "var(--down)"
                  }
                  width={280}
                  height={44}
                />
              )}
            </>
          ) : (
            <div className="cotd-tile-sub">Loading…</div>
          )}
        </div>

        <div className="cotd-tile">
          <div className="kpi-label">Flirting with 52-week extremes</div>
          {nearHigh && nearLow ? (
            <>
              <div
                className={`cotd-tile-row${onSelectTicker ? " cotd-tile-row-clickable" : ""}`}
                onClick={
                  onSelectTicker ? () => onSelectTicker(nearHigh.ticker) : undefined
                }
              >
                <span className="cotd-tile-row-label">
                  {nearHigh.ticker} <span className="cotd-tile-sub">{nearHigh.name}</span>
                </span>
                <span className="cotd-tile-row-value">
                  {nearHigh.pctFrom52wHigh.toFixed(1)}% from 52w high
                </span>
              </div>
              <div
                className={`cotd-tile-row${onSelectTicker ? " cotd-tile-row-clickable" : ""}`}
                onClick={
                  onSelectTicker ? () => onSelectTicker(nearLow.ticker) : undefined
                }
              >
                <span className="cotd-tile-row-label">
                  {nearLow.ticker} <span className="cotd-tile-sub">{nearLow.name}</span>
                </span>
                <span className="cotd-tile-row-value">
                  +{nearLow.pctFrom52wLow.toFixed(1)}% off 52w low
                </span>
              </div>
            </>
          ) : (
            <div className="cotd-tile-sub">Loading…</div>
          )}
        </div>

        <div className="cotd-tile">
          <div className="kpi-label">Correlation extremes (90d)</div>
          {correlationExtremes?.maxPair && correlationExtremes?.minPair ? (
            <>
              <div className="cotd-tile-row">
                <span className="cotd-tile-row-label">
                  {correlationExtremes.maxPair.a} vs {correlationExtremes.maxPair.b}
                </span>
                <span className="cotd-tile-row-value">
                  most correlated, {correlationExtremes.maxPair.value.toFixed(2)}
                </span>
              </div>
              <div className="cotd-tile-row">
                <span className="cotd-tile-row-label">
                  {correlationExtremes.minPair.a} vs {correlationExtremes.minPair.b}
                </span>
                <span className="cotd-tile-row-value">
                  most divergent, {correlationExtremes.minPair.value.toFixed(2)}
                </span>
              </div>
            </>
          ) : (
            <div className="cotd-tile-sub">Loading…</div>
          )}
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
