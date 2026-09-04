import { useEffect } from "react";

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Generic "click a small chart, see it full-size" overlay. Reuses the same
 * backdrop/frame chrome as the ticker ChartModal, but a plain scrollable
 * body instead of PriceChart's own flex-managed layout — this always shows
 * a static, already-fetched series rather than something that itself needs
 * a refresh control while open.
 */
export function ChartExplodeModal({ title, subtitle, onClose, children }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="chart-modal-backdrop" onClick={onClose}>
      <div className="chart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chart-modal-bar">
          <button className="icon-btn chart-modal-close" onClick={onClose} title="Close (Esc)">
            × Close
          </button>
        </div>
        <div className="chart-explode-body">
          <div className="module-banner-title">{title}</div>
          {subtitle && (
            <div className="module-banner-sub" style={{ marginBottom: 16 }}>
              {subtitle}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
