import { useEffect } from "react";
import { PriceChart } from "./PriceChart";

interface Props {
  ticker: string | null;
  onClose: () => void;
  onSelectTicker: (ticker: string) => void;
  /** Passed straight through to PriceChart — see its own doc comment. */
  refreshToken?: number;
  /**
   * Same handler the header's Refresh button calls. The modal needs its own
   * button wired to it: the backdrop is a full-viewport `position: fixed`
   * overlay above the header, so the header's own Refresh button is not
   * just visually hidden but genuinely unclickable while a chart is open
   * (confirmed via elementFromPoint — the backdrop, not the button, is what
   * a click at that position actually hits).
   */
  onRefresh: () => void;
}

/** Lets a click on a ticker elsewhere in the app (e.g. Macro, Commodities)
 * pop a chart open right there, instead of navigating away to Markets. */
export function ChartModal({ ticker, onClose, onSelectTicker, refreshToken, onRefresh }: Props) {
  useEffect(() => {
    if (!ticker) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ticker, onClose]);

  if (!ticker) return null;

  return (
    <div className="chart-modal-backdrop" onClick={onClose}>
      <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal-bar">
          <button
            className="icon-btn"
            onClick={onRefresh}
            title="Refresh this chart's data"
          >
            ⟳ Refresh
          </button>
          <button
            className="icon-btn chart-modal-close"
            onClick={onClose}
            title="Close (Esc)"
          >
            × Close
          </button>
        </div>
        <div className="chart-modal-body">
          <PriceChart ticker={ticker} onSelectTicker={onSelectTicker} refreshToken={refreshToken} />
        </div>
      </div>
    </div>
  );
}
