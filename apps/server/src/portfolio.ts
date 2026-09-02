import type { PortfolioSnapshot } from "@ruff-term/shared";

/**
 * Snapshot of the TM Ruffer Portfolio Fund, transcribed from the publicly
 * available monthly factsheet on ruffer.co.uk (no API exists for this data —
 * Ruffer publishes a fresh PDF factsheet each month). This is a manually
 * refreshed snapshot "for the time being"; a real integration should either
 * parse the monthly PDF at a predictable URL or, better, pull from Ruffer's
 * own internal portfolio systems once available.
 */
export const RUFFER_PORTFOLIO_SNAPSHOT: PortfolioSnapshot = {
  fundName: "TM Ruffer Portfolio Fund (C Acc, GBP)",
  asOfDate: "2026-06-30",
  sourceLabel: "ruffer.co.uk — TM Ruffer Portfolio Fund monthly factsheet",
  sourceUrl:
    "https://www.ruffer.co.uk/-/media/ruffer-website/files/fund-reports/tmrp/2026/2026-06-tmrp-fund-report-jun2026.pdf",
  fundSizeGBPm: 2802.9,
  performance: [
    { period: "June", valuePct: -1.3 },
    { period: "Year to date", valuePct: -0.3 },
    { period: "1 year", valuePct: 3.8 },
    { period: "3 years pa", valuePct: 3.1 },
    { period: "Since inception pa", valuePct: 1.6 },
  ],
  assetAllocation: [
    { category: "Inflation", label: "Long-dated non-UK inflation-linked bonds", pct: 7.2 },
    { category: "Inflation", label: "Gold and precious metals exposure", pct: 3.1 },
    { category: "Inflation", label: "Long-dated UK inflation-linked bonds", pct: 1.9 },
    { category: "Protection", label: "Short-dated nominal bonds", pct: 20.2 },
    { category: "Protection", label: "Long-dated nominal bonds", pct: 17.9 },
    { category: "Protection", label: "Credit and derivative strategies", pct: 7.3 },
    { category: "Protection", label: "Cash", pct: 3.0 },
    { category: "Growth", label: "Other equities", pct: 20.7 },
    { category: "Growth", label: "Consumer discretionary equities", pct: 6.7 },
    { category: "Growth", label: "Industrials equities", pct: 3.2 },
    { category: "Growth", label: "Financials equities", pct: 3.2 },
    { category: "Growth", label: "Commodity exposure", pct: 3.0 },
    { category: "Growth", label: "Energy equities", pct: 2.5 },
  ],
  currencyAllocation: [
    { label: "Sterling", pct: 75.7 },
    { label: "US dollar", pct: 11.8 },
    { label: "Yen", pct: 4.9 },
    { label: "Euro", pct: 2.4 },
    { label: "Other", pct: 5.2 },
  ],
  geographicalEquityAllocation: [
    { label: "UK equities", pct: 8.4 },
    { label: "North America equities", pct: 7.3 },
    { label: "Other equities", pct: 7.4 },
    { label: "Europe equities", pct: 4.9 },
    { label: "Asia ex-Japan equities", pct: 4.6 },
    { label: "Japan equities", pct: 3.8 },
  ],
  topHoldings: [
    { name: "iShares MSCI China A UCITS ETF", pct: 1.6 },
    { name: "BP", pct: 1.2 },
    { name: "Amazon", pct: 0.9 },
    { name: "Microsoft", pct: 0.8 },
    { name: "Prosus", pct: 0.6 },
  ],
};

export function getPortfolioSnapshot(): PortfolioSnapshot {
  return RUFFER_PORTFOLIO_SNAPSHOT;
}
