import { useEffect, useState } from "react";
import type { MacroSnapshot } from "@ruff-term/shared";
import { fetchCommodities } from "../api/client";
import { InstrumentPanelGrid } from "./InstrumentPanelGrid";
import { SourceFooter } from "./SourceFooter";

const POLL_MS = 30_000;

interface Props {
  onSelectTicker?: (ticker: string) => void;
}

export function CommoditiesPanel({ onSelectTicker }: Props) {
  const [snapshot, setSnapshot] = useState<MacroSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = await fetchCommodities();
        if (!cancelled) setSnapshot(data);
      } catch {
        // keep showing the last good snapshot
      }
    }
    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Commodities</div>
          <div className="module-banner-sub">
            Energy, metals and agriculture futures, refreshing every 30s.
            {snapshot
              ? ` Last update ${new Date(snapshot.asOf).toLocaleTimeString()}.`
              : ""}
          </div>
        </div>
      </div>
      {snapshot === null ? (
        <div className="empty-state">Loading commodities…</div>
      ) : (
        <InstrumentPanelGrid
          panels={snapshot.panels}
          onSelectTicker={onSelectTicker}
        />
      )}
      <SourceFooter
        sources={[{ label: "Yahoo Finance (live futures prices)", url: "https://finance.yahoo.com" }]}
      />
    </div>
  );
}
