import { SourceFooter } from "./SourceFooter";

interface SleeveHolding {
  ticker: string;
  name: string;
  weightPct: number;
  valueGBP: number;
}

// Fabricated weights/values for illustration only, as requested — real tickers, made-up sizing.
const SLEEVE_AUM_GBP = 40_000_000;
const HOLDINGS: SleeveHolding[] = [
  { ticker: "SLB", name: "SLB LTD", weightPct: 32, valueGBP: SLEEVE_AUM_GBP * 0.32 },
  { ticker: "VIST", name: "VISTA ENERGY SAB DE CV", weightPct: 24, valueGBP: SLEEVE_AUM_GBP * 0.24 },
  { ticker: "FND", name: "FLOOR & DECOR HOLDINGS INC-A", weightPct: 22, valueGBP: SLEEVE_AUM_GBP * 0.22 },
  { ticker: "INVE-B.ST", name: "INVESTOR AB-B SHS", weightPct: 22, valueGBP: SLEEVE_AUM_GBP * 0.22 },
];

export function JdSleevePanel() {
  return (
    <div className="module-view">
      <div className="demo-banner">
        DEMO DATA — real tickers, but weights and values below are made up for illustration only.
      </div>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">JD Sleeve</div>
        </div>
      </div>

      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Name</th>
            <th className="num">Weight</th>
            <th className="num">Value (GBP)</th>
          </tr>
        </thead>
        <tbody>
          {HOLDINGS.map((h) => (
            <tr key={h.ticker}>
              <td className="ticker-cell">{h.ticker}</td>
              <td className="short-name-cell">{h.name}</td>
              <td className="num-cell">{h.weightPct.toFixed(0)}%</td>
              <td className="num-cell">£{Math.round(h.valueGBP).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="note-banner">
        Note: use Hannah's demo from the AI show &amp; tell about how each holding is impacted by
        different scenarios — not yet incorporated here.
      </div>
      <SourceFooter sources={["Demo data — real tickers, fabricated weights/values"]} />
    </div>
  );
}
