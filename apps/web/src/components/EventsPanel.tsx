import { SourceFooter } from "./SourceFooter";

export function EventsPanel() {
  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Events</div>
          <div className="module-banner-sub">Earnings, trading statements, calls, etc.</div>
        </div>
      </div>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Company</th>
            <th>Event type</th>
            <th>Date</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody />
      </table>
      <div className="empty-state">No events sourced yet.</div>
      <SourceFooter sources={["Pending — no source connected yet"]} />
    </div>
  );
}
