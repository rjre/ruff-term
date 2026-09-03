import { useEffect } from "react";
import { PriceChart } from "./PriceChart";

interface Props {
  ticker: string | null;
  onClose: () => void;
  onSelectTicker: (ticker: string) => void;
}

/** Lets a click on a ticker elsewhere in the app (e.g. Macro, Commodities)
 * pop a chart open right there, instead of navigating away to Markets. */
export function ChartModal({ ticker, onClose, onSelectTicker }: Props) {
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
            className="icon-btn chart-modal-close"
            onClick={onClose}
            title="Close (Esc)"
          >
            × Close
          </button>
        </div>
        <div className="chart-modal-body">
          <PriceChart ticker={ticker} onSelectTicker={onSelectTicker} />
        </div>
      </div>
    </div>
  );
}
