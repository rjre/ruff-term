import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResult } from "@ruff-term/shared";
import { fetchSearch } from "../api/client";
import { TABS, type View } from "./NavTabs";

interface Props {
  onClose: () => void;
  onSelect: (view: View) => void;
  onSelectTicker: (ticker: string) => void;
}

interface TickerSearchState {
  /** The query these results answer. */
  query: string;
  results: SearchResult[];
}

/** Stable empty array — feeds the memoized `entries` list. */
const NO_RESULTS: SearchResult[] = [];

type Entry =
  | { kind: "tab"; id: View; label: string }
  | { kind: "ticker"; ticker: string; name: string };

/** Jump-to-tab-or-ticker overlay (Ctrl/Cmd+K) — with 38 top-level tabs the
 * nav bar itself requires horizontal scrolling, so this is the fast path to
 * any of them by name. Also searches tickers, since "/" and Ctrl+K are easy
 * to reach for interchangeably.
 *
 * Mounted only while open (see App), so every open starts from fresh state
 * rather than an effect clearing the last session's query and results. */
export function CommandPalette({ onClose, onSelect, onSelectTicker }: Props) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<TickerSearchState | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();
  // Results are shown only for the query they were fetched for, so the
  // previous query's tickers never sit under freshly typed text.
  const tickerResults =
    search?.query === trimmedQuery ? search.results : NO_RESULTS;

  const tabMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TABS;
    return TABS.filter((t) => t.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!trimmedQuery) return;
    const handle = setTimeout(() => {
      fetchSearch(trimmedQuery)
        .then((r) => setSearch({ query: trimmedQuery, results: r.slice(0, 6) }))
        .catch(() => setSearch({ query: trimmedQuery, results: NO_RESULTS }));
    }, 200);
    return () => clearTimeout(handle);
  }, [trimmedQuery]);

  const entries: Entry[] = useMemo(
    () => [
      ...tabMatches.map(
        (t): Entry => ({ kind: "tab", id: t.id, label: t.label }),
      ),
      ...tickerResults.map(
        (r): Entry => ({ kind: "ticker", ticker: r.ticker, name: r.name }),
      ),
    ],
    [tabMatches, tickerResults],
  );

  // Moving DOM focus is a genuine external-system effect, unlike the state
  // resets that used to sit alongside it.
  useEffect(() => {
    const handle = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(handle);
  }, []);

  // Send the highlight back to the top as the query changes. Adjusting state
  // during render, per React's documented pattern for deriving from changed
  // input — an effect would briefly render the old index against the new list.
  const [highlightedFor, setHighlightedFor] = useState(query);
  if (query !== highlightedFor) {
    setHighlightedFor(query);
    setHighlighted(0);
  }

  function choose(index: number) {
    const entry = entries[index];
    if (!entry) return;
    if (entry.kind === "tab") onSelect(entry.id);
    else onSelectTicker(entry.ticker);
    onClose();
  }

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder="Jump to a tab or ticker…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => Math.min(h + 1, entries.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(highlighted);
            }
          }}
        />
        <div className="command-palette-list">
          {entries.length === 0 ? (
            <div className="command-palette-empty">
              No matching tabs or tickers.
            </div>
          ) : (
            entries.map((entry, i) => (
              <div
                key={
                  entry.kind === "tab"
                    ? `tab-${entry.id}`
                    : `ticker-${entry.ticker}`
                }
                className={`command-palette-item${i === highlighted ? " highlighted" : ""}`}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => choose(i)}
              >
                {entry.kind === "tab" ? (
                  entry.label
                ) : (
                  <>
                    <span className="command-palette-ticker">
                      {entry.ticker}
                    </span>
                    <span className="command-palette-ticker-name">
                      {entry.name}
                    </span>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div className="command-palette-hint">
          ↑↓ to navigate · Enter to open · Esc to close
        </div>
      </div>
    </div>
  );
}
