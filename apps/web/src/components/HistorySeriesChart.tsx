import { useEffect, useRef } from "react";
import { ColorType, createChart } from "lightweight-charts";
import { cssVar } from "../lib/theme";

interface Props {
  points: Array<{ date: string; value: number }>;
  color?: string;
}

/** A full-size time-series area chart for a historic series that's normally
 * shown as a small inline Sparkline — same lightweight-charts library
 * PriceChart uses, so a real date axis and crosshair rather than a bare
 * trend line. */
export function HistorySeriesChart({ points, color }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resolvedColor = color ?? (cssVar("--ruffer-green-light") || "#4e9a33");
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: cssVar("--text") || "#1e221c",
      },
      grid: {
        vertLines: { color: cssVar("--border") || "#e2e6e0" },
        horzLines: { color: cssVar("--border") || "#e2e6e0" },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      timeScale: { borderColor: cssVar("--border") || "#e2e6e0" },
      rightPriceScale: { borderColor: cssVar("--border") || "#e2e6e0" },
    });

    const series = chart.addAreaSeries({
      lineColor: resolvedColor,
      topColor: `${resolvedColor}40`,
      bottomColor: `${resolvedColor}00`,
      lineWidth: 2,
    });
    series.setData(
      points
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ time: p.date, value: p.value })),
    );
    chart.timeScale().fitContent();

    function onResize() {
      if (!container) return;
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    }
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [points, color]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 360 }} />;
}
