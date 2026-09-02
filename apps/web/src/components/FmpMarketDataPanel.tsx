const CATEGORIES = [
  "Real-time Market Data",
  "Market Calendar",
  "Historical Market Data",
  "Form 13F",
  "Financial Statements",
  "Advanced Market Metrics",
  "Index Market Data",
  "Crypto Data",
  "Economics Data",
  "Forex Market Data",
  "Company Profile",
  "Commodity Market Data",
  "Analyst Estimates",
  "Insider & Congressional Trading",
  "Earnings Call Transcripts",
  "ESG Data",
  "Search & Directory",
  "ETF & Mutual Funds",
  "Market News",
  "Analyst Ratings & Price Targets",
];

export function FmpMarketDataPanel() {
  return (
    <div className="module-view">
      <div className="note-banner">We pay for this provider — what else could we show?</div>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">FMP Market Data</div>
          <div className="module-banner-sub">
            Data categories available under Ruffer's existing Financial Modeling Prep subscription.
          </div>
        </div>
      </div>
      <div className="research-grid">
        {CATEGORIES.map((c) => (
          <div key={c} className="fmp-category-card">
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}
