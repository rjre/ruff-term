import { useEffect, useMemo, useRef, useState } from "react";
import { TABS, type View } from "./NavTabs";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (view: View) => void;
}

/** Jump-to-tab overlay (Ctrl/Cmd+K) — with 38 top-level tabs the nav bar
 * itself requires horizontal scrolling, so this is the fast path to any of
 * them by name. */
export function CommandPalette({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TABS;
    return TABS.filter((t) => t.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlighted(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  if (!open) return null;

  function choose(index: number) {
    const tab = matches[index];
    if (!tab) return;
    onSelect(tab.id);
    onClose();
  }

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder="Jump to a tab…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((h) => Math.min(h + 1, matches.length - 1));
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
          {matches.length === 0 ? (
            <div className="command-palette-empty">No matching tabs.</div>
          ) : (
            matches.map((tab, i) => (
              <div
                key={tab.id}
                className={`command-palette-item${i === highlighted ? " highlighted" : ""}`}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => choose(i)}
              >
                {tab.label}
              </div>
            ))
          )}
        </div>
        <div className="command-palette-hint">↑↓ to navigate · Enter to open · Esc to close</div>
      </div>
    </div>
  );
}
