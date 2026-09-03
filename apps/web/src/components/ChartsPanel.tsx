import { PriceChart } from "./PriceChart";
import { TickerSearch } from "./TickerSearch";

interface Props {
  ticker: string | null;
  onSelectTicker: (ticker: string) => void;
}

export function ChartsPanel({ ticker, onSelectTicker }: Props) {
  return (
    <div className="charts-page">
      <div className="charts-page-toolbar">
        <TickerSearch onSelect={onSelectTicker} />
        {ticker && (
          <span className="charts-page-current">
            Now charting <strong>{ticker}</strong>
          </span>
        )}
      </div>
      <div className="charts-page-chart">
        <PriceChart ticker={ticker} onSelectTicker={onSelectTicker} />
      </div>
    </div>
  );
}
