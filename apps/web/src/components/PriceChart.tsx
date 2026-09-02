import { useEffect, useRef, useState } from "react";
import {
  ColorType,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { PriceBar } from "@ruff-term/shared";
import { fetchHistory } from "../api/client";

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

const MA_PERIODS = [20, 50, 200] as const;
const MA_COLORS: Record<number, string> = { 20: "#2a78d6", 50: "#eb6834", 200: "#8b5cf6" };
const COMPARE_COLOR = "#c9922f";

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

function rebased(bars: PriceBar[]): { time: UTCTimestamp; value: number }[] {
  if (bars.length === 0) return [];
  const base = bars[0].close;
  return bars.map((b) => ({ time: b.time as UTCTimestamp, value: (b.close / base) * 100 }));
}

export function PriceChart({ ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Line" | "Histogram">[]>([]);

  const [rangeDays, setRangeDays] = useState(180);
  const [rebase, setRebase] = useState(false);
  const [maPeriods, setMaPeriods] = useState<Set<number>>(new Set());
  const [compareInput, setCompareInput] = useState("");
  const [compareTicker, setCompareTicker] = useState<string | null>(null);
  const [primaryBars, setPrimaryBars] = useState<PriceBar[]>([]);
  const [compareBars, setCompareBars] = useState<PriceBar[]>([]);

  const rebaseActive = rebase || compareTicker !== null;

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

  // Reset controls and clear compare when the selected ticker changes.
  useEffect(() => {
    setCompareTicker(null);
    setCompareInput("");
    setRebase(false);
    setMaPeriods(new Set());
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

  // Rebuild series whenever the data or display options change.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (const s of seriesRef.current) chart.removeSeries(s);
    seriesRef.current = [];

    if (!ticker || primaryBars.length === 0) return;

    if (rebaseActive) {
      const line = chart.addLineSeries({ color: "#086132", lineWidth: 2 });
      line.setData(rebased(primaryBars));
      seriesRef.current.push(line);

      if (compareTicker && compareBars.length > 0) {
        const compareLine = chart.addLineSeries({
          color: COMPARE_COLOR,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
        });
        compareLine.setData(rebased(compareBars));
        seriesRef.current.push(compareLine);
      }
    } else {
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
    }

    const closes = primaryBars.map((b) => b.close);
    const baseValues = rebaseActive ? rebased(primaryBars).map((p) => p.value) : closes;
    for (const period of maPeriods) {
      const values = sma(baseValues, period);
      const line = chart.addLineSeries({
        color: MA_COLORS[period],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(
        primaryBars
          .map((b, i) => ({ time: b.time as UTCTimestamp, value: values[i] }))
          .filter((p): p is { time: UTCTimestamp; value: number } => p.value !== null)
      );
      seriesRef.current.push(line);
    }

    chart.timeScale().fitContent();
  }, [ticker, primaryBars, compareTicker, compareBars, rebaseActive, maPeriods]);

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
            <button
              className={`toggle-btn ${rebaseActive ? "active" : ""}`}
              disabled={compareTicker !== null}
              onClick={() => setRebase((v) => !v)}
              title={compareTicker ? "Rebased automatically while comparing" : "Rebase to 100 at period start"}
            >
              Rebase=100
            </button>
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
