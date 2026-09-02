import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResult } from "@ruff-term/shared";
import { fetchSearch } from "../api/client";
import { TABS, type View } from "./NavTabs";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (view: View) => void;
  onSelectTicker: (ticker: string) => void;
}

type Entry =
  | { kind: "tab"; id: View; label: string }
  | { kind: "ticker"; ticker: string; name: string };

/** Jump-to-tab-or-ticker overlay (Ctrl/Cmd+K) — with 38 top-level tabs the
 * nav bar itself requires horizontal scrolling, so this is the fast path to
 * any of them by name. Also searches tickers, since "/" and Ctrl+K are easy
 * to reach for interchangeably. */
export function CommandPalette({
  open,
  onClose,
  onSelect,
  onSelectTicker,
}: Props) {
  const [query, setQuery] = useState("");
  const [tickerResults, setTickerResults] = useState<SearchResult[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const tabMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TABS;
    return TABS.filter((t) => t.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setTickerResults([]);
      return;
    }
    const handle = setTimeout(() => {
      fetchSearch(q)
        .then((r) => setTickerResults(r.slice(0, 6)))
        .catch(() => setTickerResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

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

  useEffect(() => {
    if (open) {
      setQuery("");
      setTickerResults([]);
      setHighlighted(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  if (!open) return null;

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
