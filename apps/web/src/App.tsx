import { useEffect, useRef, useState } from "react";
import { AladdinExplorePanel } from "./components/AladdinExplorePanel";
import { AlertsPanel } from "./components/AlertsPanel";
import { BondAuctionsPanel } from "./components/BondAuctionsPanel";
import { CentralBankBalanceSheetsPanel } from "./components/CentralBankBalanceSheetsPanel";
import { CentralBankMeetingsPanel } from "./components/CentralBankMeetingsPanel";
import { CftcPositioningPanel } from "./components/CftcPositioningPanel";
import { ChartModal } from "./components/ChartModal";
import { ChartsOfTheDayPanel } from "./components/ChartsOfTheDayPanel";
import { ChartsPanel } from "./components/ChartsPanel";
import { CitiDataPanel } from "./components/CitiDataPanel";
import { CommandPalette } from "./components/CommandPalette";
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
import { MorningBriefPanel } from "./components/MorningBriefPanel";
import { NavMonitoringPanel } from "./components/NavMonitoringPanel";
import { NavTabs, TABS, type View } from "./components/NavTabs";
import { NewsFeed } from "./components/NewsFeed";
import { OwnershipPanel } from "./components/OwnershipPanel";
import { PlaceholderPanel } from "./components/PlaceholderPanel";
import { PodcastMonitorPanel } from "./components/PodcastMonitorPanel";
import { PortfolioActivityPanel } from "./components/PortfolioActivityPanel";
import { PortfolioPanel } from "./components/PortfolioPanel";
import { PriceChart } from "./components/PriceChart";
import { ResearchPanel } from "./components/ResearchPanel";
import { RnsFeedPanel } from "./components/RnsFeedPanel";
import { ScenarioCalculatorPanel } from "./components/ScenarioCalculatorPanel";
import { ScreenerPanel } from "./components/ScreenerPanel";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { ShortPositionsPanel } from "./components/ShortPositionsPanel";
import { ThemeToggle } from "./components/ThemeToggle";
import { TickerSearch } from "./components/TickerSearch";
import { TodoPanel } from "./components/TodoPanel";
import { UstActivityPanel } from "./components/UstActivityPanel";
import { Watchlist } from "./components/Watchlist";

const VALID_VIEWS = new Set(TABS.map((t) => t.id));

function initialView(): View {
  const hash = window.location.hash.slice(1) as View;
  return VALID_VIEWS.has(hash) ? hash : "morningBrief";
}

function initialTicker(): string | null {
  return new URLSearchParams(window.location.search).get("t");
}

export function App() {
  const [view, setView] = useState<View>(initialView);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(
    initialTicker,
  );
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<string | null>(null);
  const [backendUnreachable, setBackendUnreachable] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [modalTicker, setModalTicker] = useState<string | null>(null);
  // Bumped by the header refresh button. Threaded onto the active view's
  // wrapper as part of its `key`, so bumping it remounts just that panel and
  // re-runs its own data-fetching effects — no full page reload, and no need
  // to touch every individual panel component.
  const [refreshKey, setRefreshKey] = useState(0);

  function openChartModal(ticker: string) {
    setModalTicker(ticker);
  }

  // Poll health so a "backend is down" banner both appears and clears itself
  // automatically — useful during local dev restarts, not just first load.
  function checkHealth() {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        setDataSource(data.dataSource);
        setBackendUnreachable(false);
      })
      .catch(() => {
        setDataSource(null);
        setBackendUnreachable(true);
      });
  }

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15_000);
    return () => clearInterval(interval);
  }, []);

  function refreshData() {
    checkHealth();
    setRefreshKey((k) => k + 1);
  }

  // Keep the URL shareable: #view for the active tab, ?t= for the selected
  // ticker while on Markets. Uses replaceState so switching tabs doesn't
  // spam the browser's back/forward history.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (view === "markets" && selectedTicker) {
      params.set("t", selectedTicker);
    } else {
      params.delete("t");
    }
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}#${view}`;
    window.history.replaceState(null, "", url);
  }, [view, selectedTicker]);

  function goToMarkets(ticker: string) {
    setSelectedTicker(ticker);
    setView("markets");
  }

  // Keep deep-links live: browser back/forward, or a #view URL pasted into
  // the address bar while the app is already open, both fire hashchange
  // without a full reload.
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1) as View;
      if (VALID_VIEWS.has(hash)) setView(hash);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the ticker search from anywhere, like Slack/Linear/GitHub —
  // unless the user is already typing somewhere else on the page. Ctrl/Cmd+K
  // opens the tab jump-to palette, the fast path across 38 top-level tabs.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (e.key === "Escape" && shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      if (e.key !== "/") return;
      if (isTyping) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutsOpen]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="app-brand app-brand-btn"
          onClick={() => setView("morningBrief")}
          title="Go to Morning Brief"
        >
          <img
            className="app-logo-mark"
            src="/brand/ruffer-logo.png"
            alt="Ruffer"
          />
          <div className="app-brand-divider" />
          <div>
            <div className="app-title">Ruff Term</div>
            <div className="app-tagline">Internal terminal</div>
          </div>
        </button>
        <TickerSearch ref={searchInputRef} onSelect={goToMarkets} />
        <button
          className="command-palette-trigger"
          onClick={() => setPaletteOpen(true)}
          title="Jump to any tab"
        >
          Jump to tab <kbd>⌘K</kbd>
        </button>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {dataSource ? (
            <span className="data-source-badge">{dataSource} data</span>
          ) : null}
          <button
            className="icon-btn"
            onClick={refreshData}
            title="Refresh data on this page"
          >
            ⟳ Refresh
          </button>
          <ThemeToggle />
        </div>
      </header>
      <NavTabs active={view} onSelect={setView} />
      {backendUnreachable && (
        <div className="backend-down-banner">
          Can't reach the Ruff Term backend at <code>/api</code> — is{" "}
          <code>npm run dev</code> (or the server workspace) running? Retrying
          every 15s.
        </div>
      )}
      {/* Mounted only while open, so each invocation starts from a clean
          query rather than the palette resetting itself on the way in. */}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onSelect={setView}
          onSelectTicker={goToMarkets}
        />
      )}
      <ShortcutsHelp
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ChartModal
        ticker={modalTicker}
        onClose={() => setModalTicker(null)}
        onSelectTicker={setModalTicker}
      />

      <div key={`${view}-${refreshKey}`} style={{ display: "contents" }}>
      {view === "morningBrief" && (
        <div className="app-body-scroll">
          <MorningBriefPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "markets" && (
        <div className="app-body">
          <Watchlist
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onTickersChange={setWatchlistTickers}
          />
          <div className="right-column">
            <PriceChart ticker={selectedTicker} onSelectTicker={goToMarkets} />
            <NewsFeed
              ticker={selectedTicker}
              watchlistTickers={watchlistTickers}
              onSelectTicker={goToMarkets}
            />
          </div>
          <div className="app-body-footer">Source: Yahoo Finance</div>
        </div>
      )}
      {view === "charts" && (
        <ChartsPanel ticker={selectedTicker} onSelectTicker={setSelectedTicker} />
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
          <ImpactPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "chartsOfTheDay" && (
        <div className="app-body-scroll">
          <ChartsOfTheDayPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "macro" && (
        <div className="app-body-scroll">
          <MacroMonitor onSelectTicker={openChartModal} />
        </div>
      )}
      {view === "commodities" && (
        <div className="app-body-scroll">
          <CommoditiesPanel onSelectTicker={openChartModal} />
        </div>
      )}
      {view === "rns" && (
        <div className="app-body-scroll">
          <RnsFeedPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "activity" && (
        <div className="app-body-scroll">
          <PortfolioActivityPanel />
        </div>
      )}
      {view === "ustActivity" && (
        <div className="app-body-scroll">
          <UstActivityPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "dividends" && (
        <div className="app-body-scroll">
          <DividendsPanel onSelectTicker={goToMarkets} />
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
          <FxPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "citiData" && (
        <div className="app-body-scroll">
          <CitiDataPanel />
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
          <HeadlinesPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "navMonitoring" && (
        <div className="app-body-scroll">
          <NavMonitoringPanel onSelectTicker={goToMarkets} />
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
          <ScreenerPanel onSelectTicker={goToMarkets} />
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
          <OwnershipPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "centralBankBalanceSheets" && (
        <div className="app-body-scroll">
          <CentralBankBalanceSheetsPanel />
        </div>
      )}
      {view === "centralBankMeetings" && (
        <div className="app-body-scroll">
          <CentralBankMeetingsPanel />
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
          <CorrelationMatrixPanel onSelectTicker={goToMarkets} />
        </div>
      )}
      {view === "scenario" && (
        <div className="app-body-scroll">
          <ScenarioCalculatorPanel />
        </div>
      )}
      {view === "bondAuctions" && (
        <div className="app-body-scroll">
          <BondAuctionsPanel />
        </div>
      )}
      {view === "nicPerot" && (
        <div className="app-body-scroll">
          <PlaceholderPanel title="Nic Perot's Chart" />
        </div>
      )}
      </div>
    </div>
  );
}
