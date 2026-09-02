import { useEffect, useState } from "react";
import { NewsFeed } from "./components/NewsFeed";
import { PriceChart } from "./components/PriceChart";
import { TickerSearch } from "./components/TickerSearch";
import { Watchlist } from "./components/Watchlist";

export function App() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setDataSource(data.dataSource))
      .catch(() => setDataSource(null));
  }, []);

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
        <TickerSearch onSelect={setSelectedTicker} />
        <div style={{ marginLeft: "auto" }}>
          {dataSource ? <span className="data-source-badge">{dataSource} data</span> : null}
        </div>
      </header>
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
    </div>
  );
}
