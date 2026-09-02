import { useEffect, useState } from "react";
import { AladdinExplorePanel } from "./components/AladdinExplorePanel";
import { AlertsPanel } from "./components/AlertsPanel";
import { CentralBankBalanceSheetsPanel } from "./components/CentralBankBalanceSheetsPanel";
import { CftcPositioningPanel } from "./components/CftcPositioningPanel";
import { ChartsOfTheDayPanel } from "./components/ChartsOfTheDayPanel";
import { CommoditiesPanel } from "./components/CommoditiesPanel";
import { CopilotPanel } from "./components/CopilotPanel";
import { CorrelationMatrixPanel } from "./components/CorrelationMatrixPanel";
import { DividendsPanel } from "./components/DividendsPanel";
import { EventsPanel } from "./components/EventsPanel";
import { FmpMarketDataPanel } from "./components/FmpMarketDataPanel";
import { FxPanel } from "./components/FxPanel";
import { GlobalMarketsCalendarPanel } from "./components/GlobalMarketsCalendarPanel";
import { GuideToGlobalMarketsPanel } from "./components/GuideToGlobalMarketsPanel";
import { HeadlinesPanel } from "./components/HeadlinesPanel";
import { HistoricPricingPanel } from "./components/HistoricPricingPanel";
import { IframeEmbedPanel } from "./components/IframeEmbedPanel";
import { ImpactPanel } from "./components/ImpactPanel";
import { JdSleevePanel } from "./components/JdSleevePanel";
import { LiveOrdersPanel } from "./components/LiveOrdersPanel";
import { MacroMonitor } from "./components/MacroMonitor";
import { NavMonitoringPanel } from "./components/NavMonitoringPanel";
import { NavTabs, type View } from "./components/NavTabs";
import { NewsFeed } from "./components/NewsFeed";
import { OwnershipPanel } from "./components/OwnershipPanel";
import { PlaceholderPanel } from "./components/PlaceholderPanel";
import { PodcastMonitorPanel } from "./components/PodcastMonitorPanel";
import { PortfolioActivityPanel } from "./components/PortfolioActivityPanel";
import { PortfolioPanel } from "./components/PortfolioPanel";
import { PriceChart } from "./components/PriceChart";
import { ResearchPanel } from "./components/ResearchPanel";
import { RnsFeedPanel } from "./components/RnsFeedPanel";
import { ScreenerPanel } from "./components/ScreenerPanel";
import { ShortPositionsPanel } from "./components/ShortPositionsPanel";
import { TickerSearch } from "./components/TickerSearch";
import { TodoPanel } from "./components/TodoPanel";
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
          <img className="app-logo-mark" src="/brand/ruffer-logo.png" alt="Ruffer" />
          <div className="app-brand-divider" />
          <div>
            <div className="app-title">Ruff Term</div>
            <div className="app-tagline">Internal terminal</div>
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
          <div className="app-body-footer">Source: Yahoo Finance</div>
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
      {view === "commodities" && (
        <div className="app-body-scroll">
          <CommoditiesPanel />
        </div>
      )}
      {view === "rns" && (
        <div className="app-body-scroll">
          <RnsFeedPanel />
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
      {view === "historicPricing" && (
        <div className="app-body-scroll">
          <HistoricPricingPanel />
        </div>
      )}
      {view === "liveOrders" && (
        <div className="app-body-scroll">
          <LiveOrdersPanel />
        </div>
      )}
      {view === "headlines" && (
        <div className="app-body-scroll">
          <HeadlinesPanel />
        </div>
      )}
      {view === "navMonitoring" && (
        <div className="app-body-scroll">
          <NavMonitoringPanel />
        </div>
      )}
      {view === "podcastMonitor" && (
        <div className="app-body-scroll">
          <PodcastMonitorPanel />
        </div>
      )}
      {view === "fedVoting" && (
        <IframeEmbedPanel
          title="Fed Voting"
          subtitle="Every FOMC dissenting vote, Jan 2016–Jul 2026, vs the fed funds target path."
          src="https://rjre.github.io/fed-voting/"
          repoLabel="rjre/fed-voting"
        />
      )}
      {view === "fedStatement" && (
        <IframeEmbedPanel
          title="Fed Statement"
          subtitle="Word count of every FOMC post-meeting statement since Feb 2000, by rate decision."
          src="https://rjre.github.io/fed-statement/"
          repoLabel="rjre/fed-statement"
        />
      )}
      {view === "globalMarketsCalendar" && (
        <div className="app-body-scroll">
          <GlobalMarketsCalendarPanel />
        </div>
      )}
      {view === "guideToGlobalMarkets" && (
        <div className="app-body-scroll">
          <GuideToGlobalMarketsPanel />
        </div>
      )}
      {view === "screener" && (
        <div className="app-body-scroll">
          <ScreenerPanel />
        </div>
      )}
      {view === "cftcPositioning" && (
        <div className="app-body-scroll">
          <CftcPositioningPanel />
        </div>
      )}
      {view === "alerts" && (
        <div className="app-body-scroll">
          <AlertsPanel />
        </div>
      )}
      {view === "shortPositions" && (
        <div className="app-body-scroll">
          <ShortPositionsPanel />
        </div>
      )}
      {view === "ownership" && (
        <div className="app-body-scroll">
          <OwnershipPanel />
        </div>
      )}
      {view === "centralBankBalanceSheets" && (
        <div className="app-body-scroll">
          <CentralBankBalanceSheetsPanel />
        </div>
      )}
      {view === "todo" && (
        <div className="app-body-scroll">
          <TodoPanel />
        </div>
      )}
      {view === "copilot" && (
        <div className="app-body-scroll">
          <CopilotPanel />
        </div>
      )}
      {view === "correlation" && (
        <div className="app-body-scroll">
          <CorrelationMatrixPanel />
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
