import { useEffect, useMemo, useState } from "react";
import type { GlobalMarketsGuideCountry } from "@ruff-term/shared";
import { fetchGlobalMarketsGuide } from "../api/client";
import { SourceFooter } from "./SourceFooter";

function KpiTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>{value ?? "—"}</div>
    </div>
  );
}

const WIDE_SECTION_THRESHOLD = 180;

function splitIndexName(text: string | null): { short: string | null; description: string | null } {
  if (!text) return { short: null, description: null };
  const idx = text.indexOf(":");
  if (idx > 0 && idx < 60) {
    return { short: text.slice(0, idx).trim(), description: text.slice(idx + 1).trim() };
  }
  if (text.length > 44) {
    return { short: `${text.slice(0, 44).trim()}…`, description: text };
  }
  return { short: text, description: null };
}

export function GuideToGlobalMarketsPanel() {
  const [countries, setCountries] = useState<GlobalMarketsGuideCountry[] | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    fetchGlobalMarketsGuide()
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
        setCountries(sorted);
        if (sorted.length > 0) setSelected(sorted[0].name);
      })
      .catch(() => setCountries([]));
  }, []);

  const current = useMemo(
    () => countries?.find((c) => c.name === selected) ?? null,
    [countries, selected]
  );

  const equityIndex = useMemo(() => splitIndexName(current?.primaryEquityIndex ?? null), [current]);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Guide to Global Markets</div>
          <div className="module-banner-sub">
            Per-market reference data extracted from UBS's 2025 Guide to Global Markets.
          </div>
        </div>
      </div>

      {countries === null ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          <div className="guide-select-row">
            <span className="guide-select-label">Market</span>
            <select
              className="search-input"
              style={{ maxWidth: 320 }}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {countries.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {current && (
            <>
              <div className="kpi-row">
                <KpiTile label="Region" value={current.region} />
                <KpiTile label="Currency" value={current.currency} />
                <KpiTile label="Time zone" value={current.timeZone} />
                <KpiTile label="Primary exchange" value={current.primaryExchange} />
                <KpiTile label="Primary equity index" value={equityIndex.short} />
                <KpiTile label="Bloomberg ticker" value={current.bloombergTicker} />
              </div>

              {current.website && (
                <div style={{ marginBottom: 4 }}>
                  <a
                    href={current.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--ruffer-green-light)", fontSize: 12 }}
                  >
                    {current.website}
                  </a>
                </div>
              )}

              {equityIndex.description && (
                <>
                  <div className="guide-sections-heading">Index methodology</div>
                  <div className="guide-sections-grid" style={{ marginBottom: 8 }}>
                    <div className="guide-section-card guide-section-wide">
                      <div className="guide-section-label">{equityIndex.short}</div>
                      <div className="guide-section-text">{equityIndex.description}</div>
                    </div>
                  </div>
                </>
              )}

              {current.hoursSections.length > 0 && (
                <>
                  <div className="guide-sections-heading">Trading hours &amp; conventions</div>
                  <div className="guide-sections-grid">
                    {current.hoursSections.map((section, i) => (
                      <div
                        key={`${section.label}-${i}`}
                        className={
                          section.text.length > WIDE_SECTION_THRESHOLD
                            ? "guide-section-card guide-section-wide"
                            : "guide-section-card"
                        }
                      >
                        <div className="guide-section-label">{section.label}</div>
                        <div className="guide-section-text">{section.text}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
      <SourceFooter sources={["UBS — 2025 Guide to Global Markets (PDF, extracted)"]} />
    </div>
  );
}
