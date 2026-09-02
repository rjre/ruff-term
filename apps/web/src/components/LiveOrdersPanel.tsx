export function LiveOrdersPanel() {
  return (
    <div className="module-view">
      <div className="note-banner">
        We have this dataset being used in multiple places. Dashboard replica.
      </div>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Live Orders</div>
        </div>
      </div>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Ticker</th>
            <th>Side</th>
            <th className="num">Quantity</th>
            <th className="num">Filled</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody />
      </table>
      <div className="empty-state">No live order feed connected yet.</div>
    </div>
  );
}
