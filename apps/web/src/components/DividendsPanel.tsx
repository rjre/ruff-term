export function DividendsPanel() {
  return (
    <div className="module-view">
      <div className="demo-banner">To source from Aladdin.</div>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Upcoming Dividends & Corporate Actions</div>
          <div className="module-banner-sub">
            Ex-dividend dates, payments and corporate actions across Ruffer holdings.
          </div>
        </div>
      </div>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Company</th>
            <th>Action type</th>
            <th>Ex-date</th>
            <th>Pay date</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody />
      </table>
      <div className="empty-state">No data yet — pending Aladdin integration.</div>
    </div>
  );
}
