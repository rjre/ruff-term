import { useEffect, useRef } from "react";
import { ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";

function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Dummy weekly OHLC for MSFT from Nov 2021 to today. Not real prices — see
 * the note banner: real historic pricing is meant to come from Aladdin. */
function dummyHistory() {
  const rand = seededRandom("MSFT-dummy-2021-11");
  const start = new Date(Date.UTC(2021, 10, 1));
  const now = new Date();
  const weekMs = 7 * 86_400_000;
  const bars = [];
  let price = 330;
  for (let t = start.getTime(); t <= now.getTime(); t += weekMs) {
    const drift = (rand() - 0.47) * price * 0.035;
    const open = price;
    price = Math.max(50, price + drift);
    const close = price;
    const high = Math.max(open, close) * (1 + rand() * 0.015);
    const low = Math.min(open, close) * (1 - rand() * 0.015);
    bars.push({
      time: Math.floor(t / 1000) as UTCTimestamp,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });
  }
  return bars;
}

export function HistoricPricingPanel() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart: IChartApi = createChart(containerRef.current, {
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
      height: 420,
    });

    const series = chart.addCandlestickSeries({
      upColor: "#0ca30c",
      downColor: "#d03b3b",
      borderVisible: false,
      wickUpColor: "#0ca30c",
      wickDownColor: "#d03b3b",
    });
    series.setData(dummyHistory());
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.resize(entry.contentRect.width, 420);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  return (
    <div className="module-view">
      <div className="note-banner">
        Aladdin has data on instruments going back to November 2021. This can be the source for
        charting/historic data.
      </div>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Historic Pricing / Charting</div>
          <div className="module-banner-sub">
            Dummy chart — MSFT, weekly, November 2021 to date. Not real prices.
          </div>
        </div>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: 420 }} />
    </div>
  );
}
