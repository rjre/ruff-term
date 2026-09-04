import { useEffect, useRef } from "react";
import { ColorType, createChart, type ISeriesApi } from "lightweight-charts";
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
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip) return;

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

    let compareLine: ISeriesApi<"Line"> | undefined;
    const compareColor = compare?.color ?? "#c9922f";
    if (compare) {
      compareLine = chart.addLineSeries({
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

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = "none";
        return;
      }

      const primary = param.seriesData.get(series) as { value?: number } | undefined;
      const secondary = compareLine
        ? (param.seriesData.get(compareLine) as { value?: number } | undefined)
        : undefined;

      const rows: string[] = [`<div class="chart-tooltip-date">${param.time}</div>`];
      if (primary?.value !== undefined) {
        rows.push(
          `<div style="color:${resolvedColor}">${primary.value.toFixed(2)}</div>`,
        );
      }
      if (secondary?.value !== undefined) {
        rows.push(
          `<div style="color:${compareColor}">${compare!.label}: ${secondary.value.toFixed(2)}</div>`,
        );
      }
      tooltip.innerHTML = rows.join("");
      tooltip.style.display = "block";

      const tooltipWidth = tooltip.offsetWidth;
      const margin = 12;
      let left = param.point.x + margin;
      if (left + tooltipWidth > container.clientWidth) {
        left = param.point.x - tooltipWidth - margin;
      }
      let top = param.point.y + margin;
      if (top + tooltip.offsetHeight > container.clientHeight) {
        top = param.point.y - tooltip.offsetHeight - margin;
      }
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

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
      <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 360 }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 360 }} />
        <div ref={tooltipRef} className="chart-tooltip" style={{ display: "none" }} />
      </div>
    </div>
  );
}
