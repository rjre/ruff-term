import { useEffect, useState } from "react";
import type { MacroLine, MacroSnapshot } from "@ruff-term/shared";
import { fetchMacro } from "../api/client";

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

export function MacroMonitor() {
  const [snapshot, setSnapshot] = useState<MacroSnapshot | null>(null);

  useEffect(() => {
    fetchMacro()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Macro Monitor</div>
          <div className="module-banner-sub">
            Global futures, indices, FX, rates and commodities in one sheet.
            {snapshot ? ` As of ${new Date(snapshot.asOf).toLocaleTimeString()}.` : ""}
          </div>
        </div>
      </div>
      {snapshot === null ? (
        <div className="empty-state">Loading macro data…</div>
      ) : (
        <div className="macro-grid">
          {snapshot.panels.map((panel) => (
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
                    <tr key={line.ticker} title={line.label}>
                      <td className="ticker-cell">{line.label}</td>
                      <td className="num-cell">{formatLast(line)}</td>
                      <td className={`num-cell ${pctClass(line.changePct1d)}`}>
                        {formatSignedPct(line.changePct1d)}
                      </td>
                      <td className={`num-cell ${pctClass(line.netChange1d)}`}>{formatNet(line)}</td>
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
      )}
    </div>
  );
}
