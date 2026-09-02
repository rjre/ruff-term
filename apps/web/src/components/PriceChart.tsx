import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  LineStyle,
  PriceScaleMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { PriceBar } from "@ruff-term/shared";
import { fetchHistory } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";

interface Props {
  ticker: string | null;
}

const RANGES: Array<{ label: string; days: number }> = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
];

type ScaleMode = "price" | "log" | "index100" | "pct";

const SCALE_MODE_MAP: Record<ScaleMode, PriceScaleMode> = {
  price: PriceScaleMode.Normal,
  log: PriceScaleMode.Logarithmic,
  index100: PriceScaleMode.IndexedTo100,
  pct: PriceScaleMode.Percentage,
};

const SCALE_MODE_LABELS: Array<{ mode: ScaleMode; label: string }> = [
  { mode: "price", label: "Price" },
  { mode: "log", label: "Log" },
  { mode: "index100", label: "Index=100" },
  { mode: "pct", label: "%Chg" },
];

const MA_PERIODS = [20, 50, 200] as const;
const MA_COLORS: Record<number, string> = { 20: "#2a78d6", 50: "#eb6834", 200: "#8b5cf6" };
const COMPARE_COLOR = "#c9922f";
const BB_COLOR = "#8b98d1";

function sma(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Bollinger Bands: SMA(period) +/- k standard deviations, computed over a
 * trailing window of the raw close series. */
function bollinger(closes: number[], period: number, k: number): { upper: (number | null)[]; lower: (number | null)[] } {
  const mid = sma(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const m = mid[i];
    if (m === null) continue;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - m) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = m + k * sd;
    lower[i] = m - k * sd;
  }
  return { upper, lower };
}

function toLinePoints(bars: PriceBar[], values: (number | null)[]) {
  return bars
    .map((b, i) => ({ time: b.time as UTCTimestamp, value: values[i] }))
    .filter((p): p is { time: UTCTimestamp; value: number } => p.value !== null);
}

export function PriceChart({ ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line" | "Histogram">[]>([]);

  const [rangeDays, setRangeDays] = useState(180);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("price");
  const [maPeriods, setMaPeriods] = useState<Set<number>>(new Set());
  const [showBollinger, setShowBollinger] = useState(false);
  const [compareInput, setCompareInput] = useState("");
  const [compareTicker, setCompareTicker] = useState<string | null>(null);
  const [primaryBars, setPrimaryBars] = useState<PriceBar[]>([]);
  const [compareBars, setCompareBars] = useState<PriceBar[]>([]);

  const comparing = compareTicker !== null;
  // Two raw-price series only make sense on a normalized scale — force one
  // whenever comparing, same idea as TradingView's own "compare" feature.
  const effectiveMode: ScaleMode = comparing && (scaleMode === "price" || scaleMode === "log") ? "index100" : scaleMode;
  const showCandles = !comparing && (effectiveMode === "price" || effectiveMode === "log");

  // Chart lifecycle — created once, resized to fit its container.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#57604f",
        fontFamily: "'Roboto Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#eef1ee" },
        horzLines: { color: "#eef1ee" },
      },
      rightPriceScale: { borderColor: "#e2e5e1" },
      timeScale: { borderColor: "#e2e5e1" },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.resize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Reset controls when the selected ticker changes.
  useEffect(() => {
    setCompareTicker(null);
    setCompareInput("");
    setScaleMode("price");
    setMaPeriods(new Set());
    setShowBollinger(false);
  }, [ticker]);

  // Fetch primary + (optional) compare history whenever inputs change.
  useEffect(() => {
    if (!ticker) {
      setPrimaryBars([]);
      return;
    }
    let cancelled = false;
    fetchHistory(ticker, rangeDays)
      .then((res) => !cancelled && setPrimaryBars(res.bars))
      .catch(() => !cancelled && setPrimaryBars([]));
    return () => {
      cancelled = true;
    };
  }, [ticker, rangeDays]);

  useEffect(() => {
    if (!compareTicker) {
      setCompareBars([]);
      return;
    }
    let cancelled = false;
    fetchHistory(compareTicker, rangeDays)
      .then((res) => !cancelled && setCompareBars(res.bars))
      .catch(() => !cancelled && setCompareBars([]));
    return () => {
      cancelled = true;
    };
  }, [compareTicker, rangeDays]);

  // Apply the scale mode to the shared right price scale.
  useEffect(() => {
    chartRef.current?.priceScale("right").applyOptions({ mode: SCALE_MODE_MAP[effectiveMode] });
  }, [effectiveMode]);

  // Rebuild series whenever the data or display options change.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (const s of seriesRef.current) chart.removeSeries(s);
    seriesRef.current = [];

    if (!ticker || primaryBars.length === 0) return;

    if (showCandles) {
      const candles = chart.addCandlestickSeries({
        upColor: "#0ca30c",
        downColor: "#d03b3b",
        borderVisible: false,
        wickUpColor: "#0ca30c",
        wickDownColor: "#d03b3b",
      });
      candles.setData(
        primaryBars.map((b) => ({
          time: b.time as UTCTimestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }))
      );
      seriesRef.current.push(candles);

      const volume = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        color: "#cfd8ca",
      });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volume.setData(
        primaryBars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color: b.close >= b.open ? "rgba(12,163,12,0.5)" : "rgba(208,59,59,0.5)",
        }))
      );
      seriesRef.current.push(volume);
    } else {
      const line = chart.addLineSeries({ color: "#086132", lineWidth: 2 });
      line.setData(primaryBars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })));
      seriesRef.current.push(line);

      if (compareTicker && compareBars.length > 0) {
        const compareLine = chart.addLineSeries({ color: COMPARE_COLOR, lineWidth: 2 });
        compareLine.setData(compareBars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close })));
        seriesRef.current.push(compareLine);
      }
    }

    const closes = primaryBars.map((b) => b.close);

    for (const period of maPeriods) {
      const line = chart.addLineSeries({
        color: MA_COLORS[period],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(toLinePoints(primaryBars, sma(closes, period)));
      seriesRef.current.push(line);
    }

    if (showBollinger) {
      const { upper, lower } = bollinger(closes, 20, 2);
      for (const values of [upper, lower]) {
        const line = chart.addLineSeries({
          color: BB_COLOR,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        line.setData(toLinePoints(primaryBars, values));
        seriesRef.current.push(line);
      }
    }

    chart.timeScale().fitContent();
  }, [ticker, primaryBars, compareTicker, compareBars, showCandles, maPeriods, showBollinger]);

  function toggleMa(period: number) {
    setMaPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  }

  function applyCompare() {
    const t = compareInput.trim().toUpperCase();
    if (t) setCompareTicker(t);
  }

  function exportPng() {
    const canvas = chartRef.current?.takeScreenshot();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${ticker ?? "chart"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  function exportOhlcCsv() {
    if (!ticker) return;
    downloadCsv(`${ticker}-history`, [
      ["Date", "Open", "High", "Low", "Close", "Volume"],
      ...primaryBars.map((b) => [
        new Date(b.time * 1000).toISOString().slice(0, 10),
        b.open,
        b.high,
        b.low,
        b.close,
        b.volume,
      ]),
    ]);
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span>
          {ticker ? `${ticker}${compareTicker ? ` vs ${compareTicker}` : ""} — Price` : "Price Chart"}
        </span>
      </div>
      {ticker && (
        <div className="chart-toolbar">
          <div className="chart-toolbar-group">
            {RANGES.map((r) => (
              <button
                key={r.label}
                className={`toggle-btn ${rangeDays === r.days ? "active" : ""}`}
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="chart-toolbar-group">
            {SCALE_MODE_LABELS.map(({ mode, label }) => (
              <button
                key={mode}
                className={`toggle-btn ${effectiveMode === mode ? "active" : ""}`}
                disabled={comparing && (mode === "price" || mode === "log")}
                onClick={() => setScaleMode(mode)}
                title={comparing && (mode === "price" || mode === "log") ? "Not available while comparing" : undefined}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="chart-toolbar-group">
            {MA_PERIODS.map((p) => (
              <button
                key={p}
                className={`toggle-btn ${maPeriods.has(p) ? "active" : ""}`}
                style={maPeriods.has(p) ? { background: MA_COLORS[p], borderColor: MA_COLORS[p] } : undefined}
                onClick={() => toggleMa(p)}
              >
                MA{p}
              </button>
            ))}
            <button
              className={`toggle-btn ${showBollinger ? "active" : ""}`}
              style={showBollinger ? { background: BB_COLOR, borderColor: BB_COLOR } : undefined}
              onClick={() => setShowBollinger((v) => !v)}
              title="Bollinger Bands (20-period, 2 std dev)"
            >
              BB
            </button>
          </div>
          <div className="chart-toolbar-group chart-compare">
            {compareTicker ? (
              <span className="chart-compare-chip" style={{ color: COMPARE_COLOR, borderColor: COMPARE_COLOR }}>
                {compareTicker}
                <button className="chart-compare-remove" onClick={() => setCompareTicker(null)}>
                  ×
                </button>
              </span>
            ) : (
              <>
                <input
                  className="search-input"
                  placeholder="Compare vs…"
                  value={compareInput}
                  onChange={(e) => setCompareInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyCompare()}
                  style={{ maxWidth: 130, fontSize: 11 }}
                />
                <button className="icon-btn" onClick={applyCompare}>
                  Compare
                </button>
              </>
            )}
          </div>
          <div className="chart-toolbar-group">
            <button className="icon-btn" onClick={exportPng}>
              PNG
            </button>
            <button className="icon-btn" onClick={exportOhlcCsv}>
              CSV
            </button>
          </div>
        </div>
      )}
      <div className="panel-body" style={{ padding: 0 }}>
        {!ticker ? (
          <div className="empty-state">Select a ticker from the watchlist to view its chart.</div>
        ) : null}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
