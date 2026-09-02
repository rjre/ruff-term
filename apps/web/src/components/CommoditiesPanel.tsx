import { useEffect, useState } from "react";
import type { MacroSnapshot } from "@ruff-term/shared";
import { fetchCommodities } from "../api/client";
import { InstrumentPanelGrid } from "./InstrumentPanelGrid";
import { SourceFooter } from "./SourceFooter";

export function CommoditiesPanel() {
  const [snapshot, setSnapshot] = useState<MacroSnapshot | null>(null);

  useEffect(() => {
    fetchCommodities()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Commodities</div>
          <div className="module-banner-sub">
            Energy, metals and agriculture futures.
            {snapshot ? ` As of ${new Date(snapshot.asOf).toLocaleTimeString()}.` : ""}
          </div>
        </div>
      </div>
      {snapshot === null ? (
        <div className="empty-state">Loading commodities…</div>
      ) : (
        <InstrumentPanelGrid panels={snapshot.panels} />
      )}
      <SourceFooter sources={["Yahoo Finance (live futures prices)"]} />
    </div>
  );
}
