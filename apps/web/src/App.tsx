import { useEffect, useState } from "react";
import { NewsFeed } from "./components/NewsFeed";
import { PriceChart } from "./components/PriceChart";
import { TickerSearch } from "./components/TickerSearch";
import { Watchlist } from "./components/Watchlist";

export function App() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
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
        <span className="app-title">RUFF TERM</span>
        <TickerSearch onSelect={setSelectedTicker} />
        <div style={{ marginLeft: "auto" }}>
          {dataSource ? <span className="data-source-badge">{dataSource} data</span> : null}
        </div>
      </header>
      <div className="app-body">
        <Watchlist selectedTicker={selectedTicker} onSelectTicker={setSelectedTicker} />
        <div className="right-column">
          <PriceChart ticker={selectedTicker} />
          <NewsFeed ticker={selectedTicker} />
        </div>
      </div>
    </div>
  );
}
