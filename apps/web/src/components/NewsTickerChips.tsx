import { useEffect, useSyncExternalStore } from "react";
import {
  getCachedTickerName,
  resolveTickerName,
  subscribeTickerNames,
} from "../lib/tickerNames";

interface Props {
  tickers: string[];
  onSelectTicker?: (ticker: string) => void;
}

/**
 * The name cache is a module-level store other components write to, which is
 * exactly what useSyncExternalStore is for — it reads through to the cache on
 * every render, so a cache hit needs no state of its own to copy it into.
 */
function useTickerName(ticker: string): string | null {
  const name = useSyncExternalStore(
    subscribeTickerNames,
    () => getCachedTickerName(ticker) ?? null,
  );

  // Kick off the lookup for a ticker the cache has never seen. Fire-and-
  // forget: the store notifies subscribers when it lands.
  useEffect(() => {
    resolveTickerName(ticker);
  }, [ticker]);

  return name;
}

function TickerChip({
  ticker,
  onSelectTicker,
}: {
  ticker: string;
  onSelectTicker?: (ticker: string) => void;
}) {
  const name = useTickerName(ticker);
  const label = name ? `${ticker} — ${name}` : ticker;
  if (!onSelectTicker) return <>{label}</>;
  return (
    <button
      className="news-ticker-chip"
      onClick={(e) => {
        e.stopPropagation();
        onSelectTicker(ticker);
      }}
    >
      {label}
    </button>
  );
}

/** Ticker chips in a news item's meta line — ticker plus company/instrument
 * name once resolved (via ticker search, cached across the page). Clickable
 * (jumps to that ticker's chart on Markets) when a handler is given, plain
 * text otherwise — standalone tabs need the App-level navigation callback
 * threaded in. */
export function NewsTickerChips({ tickers, onSelectTicker }: Props) {
  if (tickers.length === 0) return null;
  return (
    <>
      {" · "}
      {tickers.map((t, i) => (
        <span key={t}>
          {i > 0 && ", "}
          <TickerChip ticker={t} onSelectTicker={onSelectTicker} />
        </span>
      ))}
    </>
  );
}
