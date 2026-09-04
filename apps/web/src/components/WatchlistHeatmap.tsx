import { useEffect, useMemo, useRef, useState } from "react";
import { squarify } from "../lib/treemap";
import { formatSignedPct } from "../lib/format";

export interface HeatTile {
  key: string;
  ticker: string;
  shortName: string;
  /** Sizing weight — volume, pre-scaled by the caller. */
  weight: number;
  changePct: number;
}

interface Props {
  tiles: HeatTile[];
  onSelect: (ticker: string) => void;
}

/** Diverging red/green fill, saturation carrying magnitude — same convention
 * as the correlation matrix and FX heatmap grid elsewhere in the app. */
function tileColor(pct: number, maxAbs: number): string {
  const alpha = 0.18 + Math.min(Math.abs(pct) / maxAbs, 1) * 0.62;
  return pct >= 0 ? `rgba(12,163,12,${alpha})` : `rgba(208,59,59,${alpha})`;
}

/**
 * A Finviz-style market map: one tile per watchlist name, sized by trading
 * volume and colored by move — the same information the table already
 * shows, laid out so relative scale and direction read at a glance instead
 * of row by row. Squarified rather than a plain equal-size grid so a name
 * that's actually trading heavily reads as visually bigger, not just a
 * number in a column.
 */
export function WatchlistHeatmap({ tiles, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Read the size synchronously rather than waiting on the observer's own
    // initial callback: that's supposed to fire immediately on `observe()`,
    // but re-mounting this component (switching Table -> Heatmap -> Table ->
    // Heatmap) sometimes never gets one, leaving the map permanently empty
    // until an unrelated resize happens to nudge it.
    setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rects = useMemo(
    () =>
      size.width > 0 && size.height > 0
        ? squarify(
            tiles.map((t) => ({ key: t.key, value: t.weight })),
            size.width,
            size.height,
          )
        : [],
    [tiles, size],
  );

  const maxAbs = Math.max(...tiles.map((t) => Math.abs(t.changePct)), 0.5);
  const byKey = new Map(tiles.map((t) => [t.key, t]));

  return (
    <div ref={containerRef} className="heatmap-container">
      {rects.map((r) => {
        const tile = byKey.get(r.key);
        if (!tile) return null;
        const roomy = r.width > 64 && r.height > 34;
        return (
          <button
            key={r.key}
            className="heatmap-tile"
            style={{
              left: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
              background: tileColor(tile.changePct, maxAbs),
            }}
            onClick={() => onSelect(tile.ticker)}
            title={`${tile.ticker} ${tile.shortName} · ${formatSignedPct(tile.changePct)}`}
          >
            {roomy && (
              <>
                <div className="heatmap-tile-ticker">{tile.ticker}</div>
                <div className="heatmap-tile-pct">{formatSignedPct(tile.changePct)}</div>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
