import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi } from "lightweight-charts";
import { fetchHistory } from "../api/client";

interface Props {
  ticker: string | null;
}

export function PriceChart({ ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0f1712" },
        textColor: "#96a89c",
        fontFamily: "'Roboto Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#182119" },
        horzLines: { color: "#182119" },
      },
      rightPriceScale: { borderColor: "#1c2921" },
      timeScale: { borderColor: "#1c2921" },
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

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ticker) return;

    const series = chart.addCandlestickSeries({
      upColor: "#3ddc73",
      downColor: "#ff5c5c",
      borderVisible: false,
      wickUpColor: "#3ddc73",
      wickDownColor: "#ff5c5c",
    });

    let cancelled = false;
    fetchHistory(ticker, 120)
      .then((res) => {
        if (cancelled) return;
        series.setData(
          res.bars.map((b) => ({
            time: b.time as unknown as import("lightweight-charts").UTCTimestamp,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          }))
        );
        chart.timeScale().fitContent();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      chart.removeSeries(series);
    };
  }, [ticker]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>{ticker ? `${ticker} — Price` : "Price Chart"}</span>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        {!ticker ? (
          <div className="empty-state">Select a ticker from the watchlist to view its chart.</div>
        ) : null}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
