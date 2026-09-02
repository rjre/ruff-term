import type { MacroLine, MacroPanel } from "@ruff-term/shared";

function pctClass(value: number): string {
  if (value > 0) return "pct-up";
  if (value < 0) return "pct-down";
  return "pct-flat";
}

function formatSignedPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatLast(line: MacroLine): string {
  if (line.isRateLevel) return `${line.lastPrice.toFixed(2)}%`;
  return line.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatNet(line: MacroLine): string {
  const sign = line.netChange1d > 0 ? "+" : "";
  return `${sign}${line.netChange1d.toFixed(2)}`;
}

interface Props {
  panels: MacroPanel[];
  onSelectTicker?: (ticker: string) => void;
}

export function InstrumentPanelGrid({ panels, onSelectTicker }: Props) {
  return (
    <div className="macro-grid">
      {panels.map((panel) => (
        <div className="macro-panel-card" key={panel.title}>
          <div className="macro-panel-title">
            {panel.title} ({panel.lines.length})
          </div>
          <table className="macro-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th className="num">Last</th>
                <th className="num">%1D</th>
                <th className="num">Net</th>
                <th className="num">%MTD</th>
                <th className="num">%YTD</th>
              </tr>
            </thead>
            <tbody>
              {panel.lines.map((line) => (
                <tr
                  key={line.ticker}
                  title={line.label}
                  className={
                    onSelectTicker ? "screener-row-clickable" : undefined
                  }
                  onClick={
                    onSelectTicker
                      ? () => onSelectTicker(line.ticker)
                      : undefined
                  }
                >
                  <td className="ticker-cell">{line.label}</td>
                  <td className="num-cell">{formatLast(line)}</td>
                  <td className={`num-cell ${pctClass(line.changePct1d)}`}>
                    {formatSignedPct(line.changePct1d)}
                  </td>
                  <td className={`num-cell ${pctClass(line.netChange1d)}`}>
                    {formatNet(line)}
                  </td>
                  <td className={`num-cell ${pctClass(line.changePctMtd)}`}>
                    {formatSignedPct(line.changePctMtd)}
                  </td>
                  <td className={`num-cell ${pctClass(line.changePctYtd)}`}>
                    {formatSignedPct(line.changePctYtd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
