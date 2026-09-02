import type { NavMonitoringSnapshot } from "@ruff-term/shared";
import snapshot from "./data/navMonitoringSnapshot.json" with { type: "json" };

/**
 * Static snapshot copied from rjre/nav-monitoring- (data/nav_history + data/
 * universe + data/meta.json as committed there). That repo's own roll-forward
 * NAV estimate (nav_monitor.estimator) is a Python/Streamlit app, not ported
 * here — this shows the latest OFFICIAL NAV per company already committed to
 * that repo, not a live-recomputed estimate. Run `streamlit run app.py` in
 * that repo for the live premium/discount roll-forward.
 */
export function getNavMonitoringSnapshot(): NavMonitoringSnapshot {
  return snapshot as NavMonitoringSnapshot;
}
