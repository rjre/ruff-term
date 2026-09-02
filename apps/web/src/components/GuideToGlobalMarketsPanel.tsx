import { useEffect, useMemo, useState } from "react";
import type { GlobalMarketsGuideCountry } from "@ruff-term/shared";
import { fetchGlobalMarketsGuide } from "../api/client";
import { SourceFooter } from "./SourceFooter";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="kpi-label">{label}</div>
      <div style={{ color: "var(--text)", fontSize: 12, lineHeight: 1.5, marginTop: 2 }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

export function GuideToGlobalMarketsPanel() {
  const [countries, setCountries] = useState<GlobalMarketsGuideCountry[] | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    fetchGlobalMarketsGuide()
      .then((data) => {
        setCountries(data);
        if (data.length > 0) setSelected(data[0].name);
      })
      .catch(() => setCountries([]));
  }, []);

  const current = useMemo(
    () => countries?.find((c) => c.name === selected) ?? null,
    [countries, selected]
  );

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
          <select
            className="search-input"
            style={{ maxWidth: 320, marginBottom: 20 }}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {current && (
            <div className="portfolio-grid">
              <section className="portfolio-section">
                <Field label="Region" value={current.region} />
                <Field label="Currency" value={current.currency} />
                <Field label="Time zone" value={current.timeZone} />
                <Field label="Primary exchange" value={current.primaryExchange} />
                <Field label="Website" value={current.website} />
                <Field label="Bloomberg ticker (primary index)" value={current.bloombergTicker} />
              </section>
              <section className="portfolio-section">
                <Field label="Primary equity index" value={current.primaryEquityIndex} />
                <Field label="Trading hours & conventions" value={current.hours} />
              </section>
            </div>
          )}
        </>
      )}
      <SourceFooter sources={["UBS — 2025 Guide to Global Markets (PDF, extracted)"]} />
    </div>
  );
}
