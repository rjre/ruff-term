export type View =
  | "markets"
  | "research"
  | "portfolio"
  | "impact"
  | "chartsOfTheDay"
  | "macro"
  | "activity"
  | "ustActivity"
  | "dividends"
  | "aladdinExplore"
  | "jdSleeve"
  | "fx"
  | "fmp"
  | "events"
  | "nicPerot";

const TABS: Array<{ id: View; label: string }> = [
  { id: "markets", label: "Markets" },
  { id: "research", label: "Ruffer Research" },
  { id: "portfolio", label: "Ruffer Portfolio" },
  { id: "impact", label: "Ruffer Impact" },
  { id: "chartsOfTheDay", label: "Charts of the Day" },
  { id: "macro", label: "Macro" },
  { id: "activity", label: "Portfolio Activity" },
  { id: "ustActivity", label: "UST Activity" },
  { id: "dividends", label: "Dividends & Corp Actions" },
  { id: "aladdinExplore", label: "Aladdin Explore" },
  { id: "jdSleeve", label: "JD Sleeve" },
  { id: "fx", label: "FX" },
  { id: "fmp", label: "FMP Market Data" },
  { id: "events", label: "Events" },
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
