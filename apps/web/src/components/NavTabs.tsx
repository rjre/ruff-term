export type View =
  | "morningBrief"
  | "markets"
  | "charts"
  | "research"
  | "portfolio"
  | "impact"
  | "chartsOfTheDay"
  | "macro"
  | "commodities"
  | "rns"
  | "activity"
  | "ustActivity"
  | "dividends"
  | "aladdinExplore"
  | "jdSleeve"
  | "fx"
  | "citiData"
  | "creditHistoric"
  | "creditIntraday"
  | "fmp"
  | "events"
  | "historicPricing"
  | "liveOrders"
  | "headlines"
  | "navMonitoring"
  | "podcastMonitor"
  | "fedVoting"
  | "fedStatement"
  | "globalMarketsCalendar"
  | "guideToGlobalMarkets"
  | "screener"
  | "cftcPositioning"
  | "alerts"
  | "shortPositions"
  | "ownership"
  | "centralBankBalanceSheets"
  | "centralBankMeetings"
  | "todo"
  | "copilot"
  | "correlation"
  | "scenario"
  | "bondAuctions"
  | "nicPerot";

export const TABS: Array<{ id: View; label: string }> = [
  { id: "morningBrief", label: "Morning Brief" },
  { id: "markets", label: "Markets" },
  { id: "charts", label: "Charts" },
  { id: "research", label: "Ruffer Research" },
  { id: "portfolio", label: "Ruffer Portfolio" },
  { id: "impact", label: "Ruffer Impact" },
  { id: "chartsOfTheDay", label: "Charts of the Day" },
  { id: "macro", label: "Macro" },
  { id: "commodities", label: "Commodities" },
  { id: "rns", label: "RNS Newsfeed" },
  { id: "activity", label: "Portfolio Activity" },
  { id: "ustActivity", label: "UST Activity" },
  { id: "dividends", label: "Dividends & Corp Actions" },
  { id: "aladdinExplore", label: "Aladdin Explore" },
  { id: "jdSleeve", label: "JD Sleeve" },
  { id: "fx", label: "FX" },
  { id: "citiData", label: "Citi Data" },
  { id: "creditHistoric", label: "Citi - Credit Historic" },
  { id: "creditIntraday", label: "Citi - Credit Intraday" },
  { id: "fmp", label: "FMP Market Data" },
  { id: "events", label: "Events" },
  { id: "historicPricing", label: "Historic Pricing" },
  { id: "liveOrders", label: "Live Orders" },
  { id: "headlines", label: "Financial Headlines" },
  { id: "navMonitoring", label: "NAV Monitoring" },
  { id: "podcastMonitor", label: "Podcast Monitor" },
  { id: "fedVoting", label: "Fed Voting" },
  { id: "fedStatement", label: "Fed Statement" },
  { id: "globalMarketsCalendar", label: "Global Markets Calendar" },
  { id: "guideToGlobalMarkets", label: "Guide to Global Markets" },
  { id: "screener", label: "Screener" },
  { id: "cftcPositioning", label: "CFTC Positioning" },
  { id: "alerts", label: "Alerts" },
  { id: "shortPositions", label: "Short Position Data" },
  { id: "ownership", label: "Ownership & Insider" },
  { id: "centralBankBalanceSheets", label: "Central Bank Balance Sheets" },
  { id: "centralBankMeetings", label: "Central Bank Meetings" },
  { id: "todo", label: "To Do" },
  { id: "copilot", label: "Copilot" },
  { id: "correlation", label: "Correlation Matrix" },
  { id: "scenario", label: "Scenario Calculator" },
  { id: "bondAuctions", label: "Bond Auctions" },
  { id: "nicPerot", label: "Nic Perot's Chart" },
];

interface Props {
  active: View;
  onSelect: (view: View) => void;
}

export function NavTabs({ active, onSelect }: Props) {
  return (
    <nav className="nav-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`nav-tab${tab.id === active ? " active" : ""}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
