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
import { addPriceAlert } from "../lib/alerts";
import { downloadCsv } from "../lib/exportCsv";
import { addRecentTicker, getRecentTickers } from "../lib/recentTickers";
import { cssVar } from "../lib/theme";

function chartColors() {
  return {
    background: cssVar("--chart-bg") || "#ffffff",
    text: cssVar("--chart-text") || "#57604f",
    grid: cssVar("--chart-grid") || "#eef1ee",
    border: cssVar("--border") || "#e2e5e1",
  };
}

interface Props {
  ticker: string | null;
  onSelectTicker?: (ticker: string) => void;
}

const RANGES: Array<{ label: string; days: number }> = [
  { label: "1D", days: 1 },
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
  { label: "5Y", days: 1825 },
  { label: "10Y", days: 3650 },
  { label: "MAX", days: 20_000 },
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
const MA_COLORS: Record<number, string> = {
  20: "#2a78d6",
  50: "#eb6834",
  200: "#8b5cf6",
};
const EMA_PERIODS = [12, 26] as const;
const EMA_COLORS: Record<number, string> = {
  12: "#0d9488",
  26: "#be185d",
};
const COMPARE_COLOR = "#c9922f";
const BB_COLOR = "#8b98d1";
const VWAP_COLOR = "#a16207";
const RSI_COLOR = "#7c3aed";
const MACD_COLOR = "#2a78d6";
const MACD_SIGNAL_COLOR = "#eb6834";

type LowerIndicator = "none" | "rsi" | "macd";

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

/** EMA over a (possibly gappy) series — re-seeds with a plain SMA at the
 * start of each contiguous run of non-null values, e.g. after a warm-up gap
 * from an upstream indicator like MACD's own line. */
function emaSeries(
  values: (number | null)[],
  period: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let runStart = -1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null) {
      prev = null;
      runStart = -1;
      continue;
    }
    if (runStart === -1) runStart = i;
    if (i - runStart + 1 < period) continue;
    if (prev === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j] as number;
      prev = sum / period;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

function ema(closes: number[], period: number): (number | null)[] {
  return emaSeries(closes, period);
}

/** Wilder's RSI. */
function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** MACD(12,26,9) — trend line, signal line, and the histogram between them. */
function macd(closes: number[]): {
  macdLine: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = closes.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null
      ? (ema12[i] as number) - (ema26[i] as number)
      : null,
  );
  const signal = emaSeries(macdLine, 9);
  const histogram = closes.map((_, i) =>
    macdLine[i] !== null && signal[i] !== null
      ? (macdLine[i] as number) - (signal[i] as number)
      : null,
  );
  return { macdLine, signal, histogram };
}

/** Cumulative volume-weighted average price over the currently loaded range. */
function vwap(bars: PriceBar[]): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < bars.length; i++) {
    const typical = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumPV += typical * bars[i].volume;
    cumVol += bars[i].volume;
    out[i] = cumVol > 0 ? cumPV / cumVol : null;
  }
  return out;
}

/** Bollinger Bands: SMA(period) +/- k standard deviations, computed over a
 * trailing window of the raw close series. */
function bollinger(
  closes: number[],
  period: number,
  k: number,
): { upper: (number | null)[]; lower: (number | null)[] } {
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
    .filter(
      (p): p is { time: UTCTimestamp; value: number } => p.value !== null,
    );
}

export function PriceChart({ ticker, onSelectTicker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line" | "Histogram">[]>(
    [],
  );

  const [recentTickers, setRecentTickers] =
    useState<string[]>(getRecentTickers);
  const [alertConfirmation, setAlertConfirmation] = useState<string | null>(
    null,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  useEffect(() => {
    setLogoBroken(false);
  }, [ticker]);

  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    if (!ticker) return;
    addRecentTicker(ticker);
    setRecentTickers(getRecentTickers());
  }, [ticker]);

  const [rangeDays, setRangeDays] = useState(180);
  const [scaleMode, setScaleMode] = useState<ScaleMode>("price");
  const [maPeriods, setMaPeriods] = useState<Set<number>>(new Set());
  const [emaPeriods, setEmaPeriods] = useState<Set<number>>(new Set());
  const [showBollinger, setShowBollinger] = useState(false);
  const [showVwap, setShowVwap] = useState(false);
  const [lowerIndicator, setLowerIndicator] = useState<LowerIndicator>("none");
  const [compareInput, setCompareInput] = useState("");
  const [compareTicker, setCompareTicker] = useState<string | null>(null);
  const [primaryBars, setPrimaryBars] = useState<PriceBar[]>([]);
  const [compareBars, setCompareBars] = useState<PriceBar[]>([]);
  // Set when the server had to fabricate bars because Yahoo failed. Charting
  // invented prices unlabelled is the worst failure mode this app has.
  const [syntheticBars, setSyntheticBars] = useState(false);

  const comparing = compareTicker !== null;
  // Two raw-price series only make sense on a normalized scale — force one
  // whenever comparing, same idea as TradingView's own "compare" feature.
  const effectiveMode: ScaleMode =
    comparing && (scaleMode === "price" || scaleMode === "log")
      ? "index100"
      : scaleMode;
  const showCandles =
    !comparing && (effectiveMode === "price" || effectiveMode === "log");

  // Chart lifecycle — created once, resized to fit its container.
  useEffect(() => {
    if (!containerRef.current) return;

    const colors = chartColors();
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontFamily: "'Roboto Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
      },
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

    // The chart is a canvas — CSS variables can't reach it, so re-read them
    // and re-apply on every theme toggle instead.
    function onThemeChange() {
      const c = chartColors();
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: c.background },
          textColor: c.text,
        },
        grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
        rightPriceScale: { borderColor: c.border },
        timeScale: { borderColor: c.border },
      });
    }
    window.addEventListener("ruff-term:theme-change", onThemeChange);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("ruff-term:theme-change", onThemeChange);
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
    setEmaPeriods(new Set());
    setShowBollinger(false);
    setShowVwap(false);
    setLowerIndicator("none");
  }, [ticker]);

  // Fetch primary + (optional) compare history whenever inputs change.
  useEffect(() => {
    if (!ticker) {
      setPrimaryBars([]);
      setSyntheticBars(false);
      return;
    }
    let cancelled = false;
    fetchHistory(ticker, rangeDays)
      .then((res) => {
        if (cancelled) return;
        setPrimaryBars(res.bars);
        setSyntheticBars(res.synthetic ?? false);
      })
      .catch(() => {
        if (cancelled) return;
        setPrimaryBars([]);
        setSyntheticBars(false);
      });
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
    chartRef.current
      ?.priceScale("right")
      .applyOptions({ mode: SCALE_MODE_MAP[effectiveMode] });
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
        })),
      );
      seriesRef.current.push(candles);

      const volume = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        color: "#cfd8ca",
      });
      volume
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volume.setData(
        primaryBars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.volume,
          color:
            b.close >= b.open ? "rgba(12,163,12,0.5)" : "rgba(208,59,59,0.5)",
        })),
      );
      seriesRef.current.push(volume);
    } else {
      const line = chart.addLineSeries({ color: "#086132", lineWidth: 2 });
      line.setData(
        primaryBars.map((b) => ({
          time: b.time as UTCTimestamp,
          value: b.close,
        })),
      );
      seriesRef.current.push(line);

      if (compareTicker && compareBars.length > 0) {
        const compareLine = chart.addLineSeries({
          color: COMPARE_COLOR,
          lineWidth: 2,
        });
        compareLine.setData(
          compareBars.map((b) => ({
            time: b.time as UTCTimestamp,
            value: b.close,
          })),
        );
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

    for (const period of emaPeriods) {
      const line = chart.addLineSeries({
        color: EMA_COLORS[period],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(toLinePoints(primaryBars, ema(closes, period)));
      seriesRef.current.push(line);
    }

    if (showVwap) {
      const line = chart.addLineSeries({
        color: VWAP_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(toLinePoints(primaryBars, vwap(primaryBars)));
      seriesRef.current.push(line);
    }

    // RSI/MACD share a band pinned to the bottom of the chart, above the
    // volume histogram (which itself only exists in candle mode).
    const lowerBottomMargin = showCandles ? 0.15 : 0;
    if (lowerIndicator === "rsi") {
      const line = chart.addLineSeries({
        color: RSI_COLOR,
        lineWidth: 1,
        priceScaleId: "lower",
        priceLineVisible: false,
        lastValueVisible: true,
      });
      line
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.65, bottom: lowerBottomMargin } });
      line.setData(toLinePoints(primaryBars, rsi(closes, 14)));
      line.createPriceLine({
        price: 70,
        color: RSI_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        title: "70",
      });
      line.createPriceLine({
        price: 30,
        color: RSI_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        title: "30",
      });
      seriesRef.current.push(line);
    } else if (lowerIndicator === "macd") {
      const { macdLine, signal, histogram } = macd(closes);

      const histSeries = chart.addHistogramSeries({
        priceScaleId: "lower",
        color: "#cfd8ca",
      });
      histSeries
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.65, bottom: lowerBottomMargin } });
      histSeries.setData(
        toLinePoints(primaryBars, histogram).map((p) => ({
          time: p.time,
          value: p.value,
          color:
            p.value >= 0 ? "rgba(12,163,12,0.5)" : "rgba(208,59,59,0.5)",
        })),
      );
      seriesRef.current.push(histSeries);

      const macdSeries = chart.addLineSeries({
        color: MACD_COLOR,
        lineWidth: 1,
        priceScaleId: "lower",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      macdSeries.setData(toLinePoints(primaryBars, macdLine));
      seriesRef.current.push(macdSeries);

      const signalSeries = chart.addLineSeries({
        color: MACD_SIGNAL_COLOR,
        lineWidth: 1,
        priceScaleId: "lower",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      signalSeries.setData(toLinePoints(primaryBars, signal));
      seriesRef.current.push(signalSeries);
    }

    chart.timeScale().fitContent();
  }, [
    ticker,
    primaryBars,
    compareTicker,
    compareBars,
    showCandles,
    maPeriods,
    emaPeriods,
    showBollinger,
    showVwap,
    lowerIndicator,
  ]);

  function toggleMa(period: number) {
    setMaPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  }

  function toggleEma(period: number) {
    setEmaPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });
  }

  function toggleLowerIndicator(indicator: LowerIndicator) {
    setLowerIndicator((prev) => (prev === indicator ? "none" : indicator));
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

  function promptSetAlert() {
    if (!ticker) return;
    const lastClose = primaryBars[primaryBars.length - 1]?.close;
    const raw = window.prompt(
      `Alert me when ${ticker} crosses what price?${lastClose ? ` (last: ${lastClose.toFixed(2)})` : ""}`,
    );
    if (raw === null) return;
    const threshold = Number(raw);
    if (!Number.isFinite(threshold)) return;
    const condition =
      lastClose !== undefined && threshold < lastClose ? "below" : "above";
    addPriceAlert(ticker, condition, threshold);
    setAlertConfirmation(`Alert set: ${ticker} ${condition} ${threshold}`);
    setTimeout(() => setAlertConfirmation(null), 3000);
  }

  return (
    <div className={`panel${isFullscreen ? " chart-fullscreen" : ""}`}>
      <div className="panel-header">
        <span className="chart-title">
          {ticker && !logoBroken && (
            <img
              className="chart-logo"
              src={`https://images.financialmodelingprep.com/symbol/${ticker}.png`}
              alt=""
              onError={() => setLogoBroken(true)}
            />
          )}
          {ticker
            ? `${ticker}${compareTicker ? ` vs ${compareTicker}` : ""} — Price`
            : "Price Chart"}
        </span>
        <button
          className="icon-btn"
          onClick={() => setIsFullscreen((v) => !v)}
          title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
        >
          {isFullscreen ? "⤡ Exit" : "⤢ Full screen"}
        </button>
      </div>
      {syntheticBars && (
        <div className="demo-banner">
          SIMULATED DATA — Yahoo returned no history for {ticker}, so the chart
          below is generated, not real prices. Do not trade or quote from it.
        </div>
      )}
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
                title={
                  comparing && (mode === "price" || mode === "log")
                    ? "Not available while comparing"
                    : undefined
                }
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
                style={
                  maPeriods.has(p)
                    ? { background: MA_COLORS[p], borderColor: MA_COLORS[p] }
                    : undefined
                }
                onClick={() => toggleMa(p)}
              >
                MA{p}
              </button>
            ))}
            <button
              className={`toggle-btn ${showBollinger ? "active" : ""}`}
              style={
                showBollinger
                  ? { background: BB_COLOR, borderColor: BB_COLOR }
                  : undefined
              }
              onClick={() => setShowBollinger((v) => !v)}
              title="Bollinger Bands (20-period, 2 std dev)"
            >
              BB
            </button>
          </div>
          <div className="chart-toolbar-group">
            {EMA_PERIODS.map((p) => (
              <button
                key={p}
                className={`toggle-btn ${emaPeriods.has(p) ? "active" : ""}`}
                style={
                  emaPeriods.has(p)
                    ? { background: EMA_COLORS[p], borderColor: EMA_COLORS[p] }
                    : undefined
                }
                onClick={() => toggleEma(p)}
                title={`${p}-period exponential moving average`}
              >
                EMA{p}
              </button>
            ))}
            <button
              className={`toggle-btn ${showVwap ? "active" : ""}`}
              style={
                showVwap
                  ? { background: VWAP_COLOR, borderColor: VWAP_COLOR }
                  : undefined
              }
              onClick={() => setShowVwap((v) => !v)}
              title="Cumulative volume-weighted average price over the loaded range"
            >
              VWAP
            </button>
          </div>
          <div className="chart-toolbar-group">
            <button
              className={`toggle-btn ${lowerIndicator === "rsi" ? "active" : ""}`}
              style={
                lowerIndicator === "rsi"
                  ? { background: RSI_COLOR, borderColor: RSI_COLOR }
                  : undefined
              }
              onClick={() => toggleLowerIndicator("rsi")}
              title="Relative Strength Index (14-period)"
            >
              RSI
            </button>
            <button
              className={`toggle-btn ${lowerIndicator === "macd" ? "active" : ""}`}
              style={
                lowerIndicator === "macd"
                  ? { background: MACD_COLOR, borderColor: MACD_COLOR }
                  : undefined
              }
              onClick={() => toggleLowerIndicator("macd")}
              title="MACD (12, 26, 9)"
            >
              MACD
            </button>
          </div>
          <div className="chart-toolbar-group chart-compare">
            {compareTicker ? (
              <span
                className="chart-compare-chip"
                style={{ color: COMPARE_COLOR, borderColor: COMPARE_COLOR }}
              >
                {compareTicker}
                <button
                  className="chart-compare-remove"
                  onClick={() => setCompareTicker(null)}
                >
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
            <button className="icon-btn" onClick={promptSetAlert}>
              Set Alert
            </button>
            <button className="icon-btn" onClick={exportPng}>
              PNG
            </button>
            <button className="icon-btn" onClick={exportOhlcCsv}>
              CSV
            </button>
            {alertConfirmation && (
              <span className="chart-alert-confirmation">
                {alertConfirmation}
              </span>
            )}
          </div>
        </div>
      )}
      <div className="panel-body" style={{ padding: 0 }}>
        {!ticker ? (
          <div className="empty-state">
            <div>Select a ticker from the watchlist to view its chart.</div>
            {onSelectTicker && recentTickers.length > 0 && (
              <div className="recent-tickers-row">
                <span className="recent-tickers-label">Recently viewed:</span>
                {recentTickers.map((t) => (
                  <button
                    key={t}
                    className="recent-ticker-chip"
                    onClick={() => onSelectTicker(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
