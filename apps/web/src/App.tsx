import { useEffect, useState } from "react";
import { AladdinExplorePanel } from "./components/AladdinExplorePanel";
import { ChartsOfTheDayPanel } from "./components/ChartsOfTheDayPanel";
import { DividendsPanel } from "./components/DividendsPanel";
import { EventsPanel } from "./components/EventsPanel";
import { FmpMarketDataPanel } from "./components/FmpMarketDataPanel";
import { FxPanel } from "./components/FxPanel";
import { ImpactPanel } from "./components/ImpactPanel";
import { JdSleevePanel } from "./components/JdSleevePanel";
import { MacroMonitor } from "./components/MacroMonitor";
import { NavTabs, type View } from "./components/NavTabs";
import { NewsFeed } from "./components/NewsFeed";
import { PlaceholderPanel } from "./components/PlaceholderPanel";
import { PortfolioActivityPanel } from "./components/PortfolioActivityPanel";
import { PortfolioPanel } from "./components/PortfolioPanel";
import { PriceChart } from "./components/PriceChart";
import { ResearchPanel } from "./components/ResearchPanel";
import { TickerSearch } from "./components/TickerSearch";
import { UstActivityPanel } from "./components/UstActivityPanel";
import { Watchlist } from "./components/Watchlist";

export function App() {
  const [view, setView] = useState<View>("markets");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setDataSource(data.dataSource))
      .catch(() => setDataSource(null));
  }, []);

  function goToMarkets(ticker: string) {
    setSelectedTicker(ticker);
    setView("markets");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-logo-mark">R</span>
          <div>
            <div className="app-title">Ruff Term</div>
            <div className="app-tagline">for Ruffer</div>
          </div>
        </div>
        <TickerSearch onSelect={goToMarkets} />
        <div style={{ marginLeft: "auto" }}>
          {dataSource ? <span className="data-source-badge">{dataSource} data</span> : null}
        </div>
      </header>
      <NavTabs active={view} onSelect={setView} />

      {view === "markets" && (
        <div className="app-body">
          <Watchlist
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onTickersChange={setWatchlistTickers}
          />
          <div className="right-column">
            <PriceChart ticker={selectedTicker} />
            <NewsFeed ticker={selectedTicker} watchlistTickers={watchlistTickers} />
          </div>
        </div>
      )}
      {view === "research" && (
        <div className="app-body-scroll">
          <ResearchPanel />
        </div>
      )}
      {view === "portfolio" && (
        <div className="app-body-scroll">
          <PortfolioPanel />
        </div>
      )}
      {view === "impact" && (
        <div className="app-body-scroll">
          <ImpactPanel />
        </div>
      )}
      {view === "chartsOfTheDay" && (
        <div className="app-body-scroll">
          <ChartsOfTheDayPanel />
        </div>
      )}
      {view === "macro" && (
        <div className="app-body-scroll">
          <MacroMonitor />
        </div>
      )}
      {view === "activity" && (
        <div className="app-body-scroll">
          <PortfolioActivityPanel />
        </div>
      )}
      {view === "ustActivity" && (
        <div className="app-body-scroll">
          <UstActivityPanel />
        </div>
      )}
      {view === "dividends" && (
        <div className="app-body-scroll">
          <DividendsPanel />
        </div>
      )}
      {view === "aladdinExplore" && (
        <div className="app-body-scroll">
          <AladdinExplorePanel />
        </div>
      )}
      {view === "jdSleeve" && (
        <div className="app-body-scroll">
          <JdSleevePanel />
        </div>
      )}
      {view === "fx" && (
        <div className="app-body-scroll">
          <FxPanel />
        </div>
      )}
      {view === "fmp" && (
        <div className="app-body-scroll">
          <FmpMarketDataPanel />
        </div>
      )}
      {view === "events" && (
        <div className="app-body-scroll">
          <EventsPanel />
        </div>
      )}
      {view === "nicPerot" && (
        <div className="app-body-scroll">
          <PlaceholderPanel title="Nic Perot's Chart" />
        </div>
      )}
    </div>
  );
}
