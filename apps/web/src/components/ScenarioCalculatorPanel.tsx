import { useEffect, useMemo, useState } from "react";
import type { PortfolioSnapshot } from "@ruff-term/shared";
import { fetchPortfolioSnapshot } from "../api/client";
import { SourceFooter } from "./SourceFooter";

interface SensitivityLine {
  label: string;
  weightPct: number;
  contributionPct: number;
}

/** Approximate duration (years) per disclosed bond line, for a linear
 * price-impact-from-yield-shock estimate. Not disclosed by the fund —
 * reasonable assumptions by maturity bucket, clearly flagged as such. */
const BOND_DURATION: Array<{ match: string; years: number }> = [
  { match: "short-dated nominal", years: 2 },
  { match: "long-dated nominal", years: 15 },
  { match: "long-dated non-uk inflation", years: 12 },
  { match: "long-dated uk inflation", years: 12 },
  { match: "credit and derivative", years: 4 },
];

function findAllocation(portfolio: PortfolioSnapshot, matchers: string[]): number {
  return portfolio.assetAllocation
    .filter((l) => matchers.some((m) => l.label.toLowerCase().includes(m)))
    .reduce((sum, l) => sum + l.pct, 0);
}

function durationFor(label: string): number | null {
  const found = BOND_DURATION.find((d) => label.toLowerCase().includes(d.match));
  return found ? found.years : null;
}

export function ScenarioCalculatorPanel() {
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [equityShock, setEquityShock] = useState(-10);
  const [yieldShockBp, setYieldShockBp] = useState(50);
  const [goldShock, setGoldShock] = useState(0);
  const [creditSpreadBp, setCreditSpreadBp] = useState(0);
  const [fxShock, setFxShock] = useState(0);

  useEffect(() => {
    fetchPortfolioSnapshot()
      .then(setPortfolio)
      .catch(() => setPortfolio(null));
  }, []);

  const result = useMemo(() => {
    if (!portfolio) return null;

    const lines: SensitivityLine[] = [];

    const equityPct = findAllocation(portfolio, [
      "equities",
      "commodity exposure",
    ]);
    lines.push({
      label: "Growth equities & commodities",
      weightPct: equityPct,
      contributionPct: (equityPct / 100) * equityShock,
    });

    for (const bondLine of portfolio.assetAllocation) {
      const years = durationFor(bondLine.label);
      if (years === null || bondLine.label.toLowerCase().includes("credit")) continue;
      lines.push({
        label: bondLine.label,
        weightPct: bondLine.pct,
        contributionPct: (bondLine.pct / 100) * -years * (yieldShockBp / 10000) * 100,
      });
    }

    const creditPct = findAllocation(portfolio, ["credit and derivative"]);
    const creditYears = 4;
    lines.push({
      label: "Credit & derivative strategies",
      weightPct: creditPct,
      contributionPct: (creditPct / 100) * -creditYears * (creditSpreadBp / 10000) * 100,
    });

    const goldPct = findAllocation(portfolio, ["gold and precious metals"]);
    lines.push({
      label: "Gold & precious metals",
      weightPct: goldPct,
      contributionPct: (goldPct / 100) * goldShock,
    });

    const foreignCcyPct = portfolio.currencyAllocation
      .filter((c) => c.label.toLowerCase() !== "sterling")
      .reduce((sum, c) => sum + c.pct, 0);
    lines.push({
      label: "Non-sterling currency exposure",
      weightPct: foreignCcyPct,
      contributionPct: (foreignCcyPct / 100) * -fxShock,
    });

    const totalPct = lines.reduce((sum, l) => sum + l.contributionPct, 0);
    const totalGBPm = (totalPct / 100) * portfolio.fundSizeGBPm;

    return { lines, totalPct, totalGBPm };
  }, [portfolio, equityShock, yieldShockBp, goldShock, creditSpreadBp, fxShock]);

  function pctClass(v: number): string {
    if (v > 0.01) return "pct-up";
    if (v < -0.01) return "pct-down";
    return "pct-flat";
  }

  function formatSigned(v: number, unit: string, decimals = 2): string {
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(decimals)}${unit}`;
  }

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Scenario Calculator</div>
          <div className="module-banner-sub">
            Type a shock, see an illustrative impact on the fund's disclosed allocation — a rough
            gut-check, not a risk model.
          </div>
        </div>
      </div>

      <div className="demo-banner">
        Illustrative only: a linear approximation using assumed durations by maturity bucket, not
        the fund's own risk system. It cannot capture the convex, option-like payoffs that
        "Protection" strategies are specifically designed to have — the whole reason those
        strategies exist is to behave better than a straight-line sensitivity model in a real
        shock. Treat this as a rough gut-check, not a risk number.
      </div>

      {!portfolio || !result ? (
        <div className="empty-state">Loading portfolio allocation…</div>
      ) : (
        <div className="portfolio-grid">
          <section className="portfolio-section">
            <h3 className="section-heading">Shock inputs</h3>
            <div className="scenario-input-row">
              <label>Global equities</label>
              <input
                type="range"
                min={-40}
                max={20}
                value={equityShock}
                onChange={(e) => setEquityShock(Number(e.target.value))}
              />
              <span className="scenario-input-value">{formatSigned(equityShock, "%", 0)}</span>
            </div>
            <div className="scenario-input-row">
              <label>Bond yields (nominal &amp; index-linked)</label>
              <input
                type="range"
                min={-200}
                max={200}
                step={10}
                value={yieldShockBp}
                onChange={(e) => setYieldShockBp(Number(e.target.value))}
              />
              <span className="scenario-input-value">{formatSigned(yieldShockBp, "bp", 0)}</span>
            </div>
            <div className="scenario-input-row">
              <label>Credit spreads</label>
              <input
                type="range"
                min={-100}
                max={300}
                step={10}
                value={creditSpreadBp}
                onChange={(e) => setCreditSpreadBp(Number(e.target.value))}
              />
              <span className="scenario-input-value">{formatSigned(creditSpreadBp, "bp", 0)}</span>
            </div>
            <div className="scenario-input-row">
              <label>Gold price</label>
              <input
                type="range"
                min={-30}
                max={30}
                value={goldShock}
                onChange={(e) => setGoldShock(Number(e.target.value))}
              />
              <span className="scenario-input-value">{formatSigned(goldShock, "%", 0)}</span>
            </div>
            <div className="scenario-input-row">
              <label>Sterling vs. rest of world</label>
              <input
                type="range"
                min={-20}
                max={20}
                value={fxShock}
                onChange={(e) => setFxShock(Number(e.target.value))}
              />
              <span className="scenario-input-value">{formatSigned(fxShock, "%", 0)}</span>
            </div>
          </section>

          <section className="portfolio-section">
            <h3 className="section-heading">Illustrative impact by driver</h3>
            <div className="magnitude-list">
              {result.lines.map((l) => (
                <div className="magnitude-row" key={l.label} style={{ gridTemplateColumns: "180px 1fr 64px" }}>
                  <span className="magnitude-label" title={`${l.weightPct.toFixed(1)}% of NAV`}>
                    {l.label}
                  </span>
                  <div className="magnitude-bar-track">
                    <div
                      className="magnitude-bar-fill"
                      style={{
                        width: `${Math.min(Math.abs(l.contributionPct) * 20, 100)}%`,
                        background: l.contributionPct >= 0 ? "var(--up)" : "var(--down)",
                      }}
                    />
                  </div>
                  <span className={`magnitude-pct ${pctClass(l.contributionPct)}`}>
                    {formatSigned(l.contributionPct, "%")}
                  </span>
                </div>
              ))}
            </div>

            <div className="kpi-row" style={{ marginTop: 20 }}>
              <div className="kpi-tile">
                <div className="kpi-label">Total illustrative impact</div>
                <div className={`kpi-value ${pctClass(result.totalPct)}`}>
                  {formatSigned(result.totalPct, "%")}
                </div>
              </div>
              <div className="kpi-tile">
                <div className="kpi-label">≈ NAV impact</div>
                <div className={`kpi-value ${pctClass(result.totalGBPm)}`}>
                  {formatSigned(result.totalGBPm, "m", 1)} GBP
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <SourceFooter
        sources={[
          "Ruffer Portfolio snapshot (ruffer.co.uk) for allocation weights",
          "Sensitivity assumptions: illustrative, not disclosed by the fund",
        ]}
      />
    </div>
  );
}
