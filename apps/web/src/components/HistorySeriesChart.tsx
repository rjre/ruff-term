import { useEffect, useRef } from "react";
import { ColorType, createChart } from "lightweight-charts";
import { cssVar } from "../lib/theme";

interface CompareSeries {
  label: string;
  points: Array<{ date: string; value: number }>;
  color?: string;
}

interface Props {
  points: Array<{ date: string; value: number }>;
  color?: string;
  /**
   * A second series overlaid on its own independent (left) price scale
   * rather than sharing the primary's right-hand one. Credit spreads span
   * two orders of magnitude across instruments — a 5bp sovereign sharing an
   * axis with a 300bp HY index would just look flat — so unlike PriceChart's
   * own compare overlay (same underlying asset class, one shared scale),
   * this one gives each series room to show its own real shape.
   */
  compare?: CompareSeries;
}

/** A full-size time-series area chart for a historic series that's normally
 * shown as a small inline Sparkline — same lightweight-charts library
 * PriceChart uses, so a real date axis and crosshair rather than a bare
 * trend line. */
export function HistorySeriesChart({ points, color, compare }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const borderColor = cssVar("--border") || "#e2e6e0";
    const resolvedColor = color ?? (cssVar("--ruffer-green-light") || "#4e9a33");
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: cssVar("--text") || "#1e221c",
      },
      grid: {
        vertLines: { color: borderColor },
        horzLines: { color: borderColor },
      },
      width: container.clientWidth,
      height: container.clientHeight,
      timeScale: { borderColor },
      rightPriceScale: { borderColor, visible: true },
      leftPriceScale: { borderColor, visible: !!compare },
    });

    const series = chart.addAreaSeries({
      lineColor: resolvedColor,
      topColor: `${resolvedColor}40`,
      bottomColor: `${resolvedColor}00`,
      lineWidth: 2,
      priceScaleId: "right",
    });
    series.setData(
      points
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ time: p.date, value: p.value })),
    );

    if (compare) {
      const compareColor = compare.color ?? "#c9922f";
      const compareLine = chart.addLineSeries({
        color: compareColor,
        lineWidth: 2,
        priceScaleId: "left",
      });
      compareLine.setData(
        compare.points
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((p) => ({ time: p.date, value: p.value })),
      );
    }

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
  }, [points, color, compare]);

  return (
    <div>
      {compare && (
        <div className="chart-compare-legend">
          <span className="chart-compare-legend-item" style={{ color: color ?? "var(--ruffer-green-light)" }}>
            ● right axis
          </span>
          <span className="chart-compare-legend-item" style={{ color: compare.color ?? "#c9922f" }}>
            ● {compare.label} — left axis
          </span>
        </div>
      )}
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 360 }} />
    </div>
  );
}
