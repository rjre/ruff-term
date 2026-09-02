interface Props {
  tickers: string[];
  onSelectTicker?: (ticker: string) => void;
}

/** Ticker chips in a news item's meta line. Clickable (jumps to that
 * ticker's chart on Markets) when a handler is given, plain text otherwise —
 * standalone tabs need the App-level navigation callback threaded in. */
export function NewsTickerChips({ tickers, onSelectTicker }: Props) {
  if (tickers.length === 0) return null;
  if (!onSelectTicker) return <> · {tickers.join(", ")}</>;
  return (
    <>
      {" · "}
      {tickers.map((t, i) => (
        <span key={t}>
          {i > 0 && ", "}
          <button
            className="news-ticker-chip"
            onClick={(e) => {
              e.stopPropagation();
              onSelectTicker(t);
            }}
          >
            {t}
          </button>
        </span>
      ))}
    </>
  );
}
