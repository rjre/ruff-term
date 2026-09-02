import { forwardRef, useEffect, useRef, useState } from "react";
import type { SearchResult } from "@ruff-term/shared";
import { fetchSearch } from "../api/client";

interface Props {
  onSelect: (ticker: string) => void;
  compact?: boolean;
}

export const TickerSearch = forwardRef<HTMLInputElement, Props>(function TickerSearch(
  { onSelect, compact },
  forwardedRef
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      fetchSearch(query)
        .then((r) => {
          setResults(r);
          setOpen(r.length > 0);
        })
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(result: SearchResult) {
    onSelect(result.ticker);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="search-box" ref={containerRef}>
      <input
        ref={forwardedRef}
        className="search-input"
        placeholder={compact ? "Add ticker…" : "Search ticker or company… (press / )"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && (
        <div className="search-results">
          {results.map((r) => (
            <div key={r.ticker} className="search-result-row" onClick={() => select(r)}>
              <span className="search-result-ticker">{r.ticker}</span>
              <span className="search-result-name">{r.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
