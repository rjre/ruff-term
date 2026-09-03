import { useEffect, useMemo, useState } from "react";
import type {
  CitiBrowseLevel,
  CitiCatalog,
  CitiInventory,
  G10GridSnapshot,
} from "@ruff-term/shared";
import {
  fetchCitiBrowse,
  fetchCitiCatalog,
  fetchCitiInventory,
  fetchG10Grid,
} from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { LEGS, buildGrid, usdRates } from "@ruff-term/shared";
import {
  useCitiStream,
  type CitiStream,
  type LiveTick,
} from "../lib/citiStream";
import { formatSignedPct, pctClass } from "../lib/format";
import { usePriceFlashes } from "../lib/priceFlash";
import { PriceStamp } from "./PriceStamp";
import { SourceFooter } from "./SourceFooter";

/**
 * Diverging fill for a signed % change, matching the correlation matrix's
 * convention: two hues with the surface showing through at zero, so the
 * midpoint is neutral rather than a third colour. Alpha carries magnitude —
 * and because every cell also prints its number, colour is a redundant
 * encoding rather than the only way to read the grid.
 */
function changeStyle(value: number | null, max: number) {
  if (value === null) return undefined;
  const alpha = max === 0 ? 0 : Math.min(Math.abs(value) / max, 1) * 0.7;
  return {
    background:
      value >= 0 ? `rgba(12,163,12,${alpha})` : `rgba(208,59,59,${alpha})`,
    color: alpha > 0.45 ? "#ffffff" : "var(--text)",
  };
}

function formatRate(value: number | null): string {
  if (value === null) return "—";
  // JPY crosses run to three figures, CHF/EUR crosses to under one.
  const digits = value >= 100 ? 2 : value >= 1 ? 4 : 5;
  return value.toFixed(digits);
}

type Mode = "rates" | "changes" | "live";

function G10Grid({
  snapshot,
  prices,
  streaming,
}: {
  snapshot: G10GridSnapshot;
  prices: Record<string, LiveTick>;
  streaming: boolean;
}) {
  const [mode, setMode] = useState<Mode>("changes");

  // Every cross recomputed from whatever has ticked. Nine streamed legs give
  // all ninety crosses by triangulation, so the live grid needs no extra
  // subscriptions — and no metered call at all.
  const liveRates = useMemo(() => {
    const rates = usdRates((tag) => prices[tag]?.value);
    return buildGrid(rates, {}).rates;
  }, [prices]);

  const liveLegs = LEGS.filter((leg) => prices[leg.tag]).length;
  // Falling back silently would present EOD numbers as live ones.
  const canGoLive = streaming && liveLegs === LEGS.length;
  const effectiveMode: Mode = mode === "live" && !canGoLive ? "rates" : mode;

  const { currencies, rates, changes, strength } = snapshot;

  const maxAbs = Math.max(
    ...currencies.flatMap((a) =>
      currencies.map((b) => Math.abs(changes[a]?.[b] ?? 0)),
    ),
    0.5,
  );

  const ranked = [...currencies]
    .filter((c) => strength[c] !== null)
    .sort((a, b) => (strength[b] ?? 0) - (strength[a] ?? 0));
  const maxStrength = Math.max(
    ...ranked.map((c) => Math.abs(strength[c] ?? 0)),
    0.5,
  );

  return (
    <>
      <div className="screener-toolbar">
        <div className="chart-toolbar-group">
          <button
            className={`toggle-btn ${mode === "changes" ? "active" : ""}`}
            onClick={() => setMode("changes")}
          >
            % change
          </button>
          <button
            className={`toggle-btn ${mode === "rates" ? "active" : ""}`}
            onClick={() => setMode("rates")}
          >
            Cross rate (close)
          </button>
          <button
            className={`toggle-btn ${mode === "live" ? "active" : ""}`}
            onClick={() => setMode("live")}
            disabled={!canGoLive}
            title={
              canGoLive
                ? "All 90 crosses triangulated from the nine streamed legs"
                : `Needs all ${LEGS.length} legs streaming (${liveLegs} so far)`
            }
          >
            Cross rate (live)
          </button>
        </div>
        <button
          className="icon-btn"
          onClick={() =>
            downloadCsv("citi-g10-grid", [
              ["", ...currencies],
              ...currencies.map((a) => [
                a,
                ...currencies.map((b) =>
                  effectiveMode === "changes"
                    ? (changes[a]?.[b] ?? "")
                    : effectiveMode === "live"
                      ? (liveRates[a]?.[b] ?? "")
                      : (rates[a]?.[b] ?? ""),
                ),
              ]),
            ])
          }
        >
          Export CSV
        </button>
        <span className="vol-legend-note">
          {effectiveMode === "changes"
            ? `Change since ${snapshot.baselineDate ?? "—"}`
            : effectiveMode === "live"
              ? "Live, triangulated from the nine streamed legs"
              : "Units of the column currency per 1 of the row currency"}
        </span>
      </div>

      <div className="matrix-scroll">
        <table className="correlation-table">
          <thead>
            <tr>
              <th />
              {currencies.map((c) => (
                <th key={c} className="num">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currencies.map((a) => (
              <tr key={a}>
                <td className="ticker-cell">{a}</td>
                {currencies.map((b) => {
                  const change = changes[a]?.[b] ?? null;
                  const rate = rates[a]?.[b] ?? null;
                  if (a === b) return <td key={b} className="corr-cell corr-diag" />;
                  const liveRate = liveRates[a]?.[b] ?? null;
                  return (
                    <td
                      key={b}
                      className="corr-cell"
                      style={
                        effectiveMode === "changes"
                          ? changeStyle(change, maxAbs)
                          : undefined
                      }
                      title={`${a}${b} ${formatRate(rate)}${
                        change === null ? "" : ` · ${formatSignedPct(change)} since ${snapshot.baselineDate}`
                      }`}
                    >
                      {effectiveMode === "changes"
                        ? change === null
                          ? "—"
                          : formatSignedPct(change)
                        : formatRate(effectiveMode === "live" ? liveRate : rate)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="section-heading" style={{ marginTop: 18 }}>
        Currency strength — average move against the rest of the grid
      </h3>
      <div className="diverging-list">
        {ranked.map((ccy) => {
          const value = strength[ccy] ?? 0;
          const widthPct = (Math.abs(value) / maxStrength) * 50;
          return (
            <div className="diverging-row" key={ccy}>
              <span className="diverging-label">{ccy}</span>
              <div className="diverging-track">
                <div className="diverging-baseline" />
                <div
                  className={`diverging-fill ${value >= 0 ? "diverging-up" : "diverging-down"}`}
                  style={
                    value >= 0
                      ? { left: "50%", width: `${widthPct}%` }
                      : { right: "50%", width: `${widthPct}%` }
                  }
                />
              </div>
              <span className={`diverging-value ${pctClass(value)}`}>
                {formatSignedPct(value)}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  unavailable: "Unavailable",
  disconnected: "Disconnected",
};

/** Digits that make a spot rate readable: JPY crosses need fewer than EURUSD. */
function spotDigits(value: number): number {
  return value >= 100 ? 3 : value >= 10 ? 4 : 5;
}

/**
 * The nine USD legs as they tick, straight off Citi's streaming websocket.
 *
 * This is the only continuously-updating Citi data in the terminal: streaming
 * does not draw on the per-tag /data budget, so unlike the EOD grid above it
 * costs nothing to leave running. Frequency is MI01 — one update a minute per
 * leg — so a quiet minute showing no movement is the feed working, not stalled.
 */
function LiveSpot({ state, prices }: CitiStream) {
  const ticks = LEGS.map((leg) => ({ leg, tick: prices[leg.tag] as LiveTick | undefined }));
  const flashes = usePriceFlashes(
    useMemo(
      () =>
        ticks
          .filter((t) => t.tick)
          .map((t) => ({ key: t.leg.tag, value: t.tick!.value })),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [prices],
    ),
  );

  const live = state.status === "live";

  return (
    <>
      <div className="screener-toolbar">
        <span className={`stream-badge stream-${state.status}`}>
          <span className="stream-dot" />
          {STATUS_LABEL[state.status] ?? state.status}
        </span>
        <span className="vol-legend-note">
          {state.connectBudget > 0
            ? `${state.subscribed.length}/${LEGS.length} subscribed · ${state.connectsInLastDay} of ~${state.connectBudget} daily connects used · streaming is not metered per tag`
            : "streaming is not metered per tag"}
        </span>
      </div>
      {state.note && <div className="demo-banner">{state.note}</div>}

      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Pair</th>
            <th className="num">Live</th>
            <th>Tag</th>
          </tr>
        </thead>
        <tbody>
          {ticks.map(({ leg, tick }) => {
            const flash = flashes.get(leg.tag);
            const pair = leg.invert ? `USD/${leg.ccy}` : `${leg.ccy}/USD`;
            return (
              <tr key={leg.tag}>
                <td className="ticker-cell">{pair}</td>
                <td
                  className={`num-cell price-cell${flash ? ` flash-${flash}` : ""}`}
                >
                  <div>
                    {tick ? tick.value.toFixed(spotDigits(tick.value)) : "—"}
                  </div>
                  <PriceStamp at={tick?.at} />
                </td>
                <td className="short-name-cell citi-tag-cell">{leg.tag}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!live && state.status !== "unavailable" && (
        <div className="empty-state">
          Waiting for the upstream websocket…
        </div>
      )}
    </>
  );
}

/**
 * Free tag-tree explorer. `/tagbrowsing` and `/taglisting` are the two Citi
 * endpoints that are NOT metered, so descending the tree costs nothing —
 * which is the point of putting the whole 160k-tag inventory in front of
 * someone rather than hiding it behind a budget.
 */
function TagTree({ catalog }: { catalog: CitiCatalog | null }) {
  const [prefix, setPrefix] = useState("FX");
  // Both results carry the prefix they answer, so "loading" and "failed" are
  // derived in render rather than reset by the effect — and a slow response
  // for a branch already navigated away from can't overwrite the current one.
  const [level, setLevel] = useState<{
    prefix: string;
    value: CitiBrowseLevel | null;
  } | null>(null);
  const [inventory, setInventory] = useState<CitiInventory | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCitiBrowse(prefix)
      .then((l) => !cancelled && setLevel({ prefix, value: l }))
      .catch(() => !cancelled && setLevel({ prefix, value: null }));
    fetchCitiInventory(prefix)
      .then((i) => !cancelled && setInventory(i))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  const failed = level?.prefix === prefix && level.value === null;

  const countFor = (code: string): number | null =>
    prefix === "FX"
      ? (catalog?.entries.find((e) => e.code === code)?.tagCount ?? null)
      : null;

  const segments = prefix.split(".");
  const showing = level?.prefix === prefix ? level.value : null;
  const counted = inventory?.prefix === prefix ? inventory : null;

  return (
    <>
      <div className="screener-toolbar">
        <div className="citi-breadcrumb">
          {segments.map((seg, i) => (
            <span key={`${seg}-${i}`}>
              {i > 0 && <span className="citi-crumb-sep">.</span>}
              <button
                className="ticker-cell-btn"
                onClick={() => setPrefix(segments.slice(0, i + 1).join("."))}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>
        <span className="vol-legend-note">
          {prefix === "FX"
            ? catalog
              ? `${catalog.totalTags.toLocaleString()} tags across ${catalog.entries.length} sub-categories · free to browse`
              : "counting…"
            : counted
              ? `${counted.tagCount.toLocaleString()} tags under this branch · free to browse`
              : "counting…"}
        </span>
      </div>

      {failed ? (
        <div className="empty-state">Citi tag tree unavailable.</div>
      ) : !showing ? (
        <div className="empty-state">Loading tag tree…</div>
      ) : (
        <>
          <div className="citi-level-header">
            {showing.header ?? "Level"} — {Object.keys(showing.fields).length}{" "}
            values
          </div>
          <div className="citi-code-grid">
            {Object.entries(showing.fields).map(([code, label]) => (
              <button
                key={code}
                className="citi-code-card"
                onClick={() => setPrefix(`${prefix}.${code}`)}
                title={`${prefix}.${code}`}
              >
                <span className="citi-code-top">
                  <span className="citi-code">{code}</span>
                  {countFor(code) !== null && (
                    <span className="citi-code-count">
                      {countFor(code)!.toLocaleString()}
                    </span>
                  )}
                </span>
                <span className="citi-code-label">{label}</span>
              </button>
            ))}
          </div>
          {Object.keys(showing.fields).length === 0 && (
            <div className="empty-state">
              Leaf level — {counted?.tagCount.toLocaleString() ?? "?"} tags.
            </div>
          )}
          {counted && counted.samples.length > 0 && (
            <div className="citi-samples">
              <span className="citi-samples-label">Example tags</span>
              {counted.samples.map((tag) => (
                <code key={tag}>{tag}</code>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export function CitiDataPanel() {
  const [grid, setGrid] = useState<G10GridSnapshot | null>(null);
  const [gridFailed, setGridFailed] = useState(false);
  const [catalog, setCatalog] = useState<CitiCatalog | null>(null);
  // One EventSource for the tab: the server holds the single upstream socket
  // Citi permits, so opening one per component would gain nothing.
  const stream = useCitiStream(true);

  useEffect(() => {
    let cancelled = false;
    fetchG10Grid()
      .then((g) => !cancelled && setGrid(g))
      .catch(() => !cancelled && setGridFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Counting all 24 sub-categories is free but rate-limited to one call a
  // second, so the server returns what it has and warms the rest. Re-poll
  // while that runs; the counts are cached for a week afterwards.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function load() {
      fetchCitiCatalog()
        .then((c) => {
          if (cancelled) return;
          setCatalog(c);
          if (c.warming) timer = setTimeout(load, 5000);
        })
        .catch(() => undefined);
    }
    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Citi Data</div>
          <div className="module-banner-sub">
            What Ruffer's Citi Velocity entitlement actually reaches: the full
            tag inventory, free to explore, plus worked examples of pulling
            real numbers out of it.
          </div>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-tile">
          <div className="kpi-label">Tag inventory</div>
          <div className="kpi-value">
            {catalog ? catalog.totalTags.toLocaleString() : "…"}
          </div>
          <div className="cotd-tile-sub">
            {catalog
              ? `across ${catalog.entries.length} sub-categories${catalog.warming ? " (still counting)" : ""}`
              : "counting the tag tree"}
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Free to browse</div>
          <div className="kpi-value">Tree + counts</div>
          <div className="cotd-tile-sub">
            /tagbrowsing and /taglisting are unmetered
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Metered</div>
          <div className="kpi-value">~10 / tag</div>
          <div className="cotd-tile-sub">
            /data and /metadata, account-level, never reset
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">G10 grid cost</div>
          <div className="kpi-value">1 call</div>
          <div className="cotd-tile-sub">
            9 USD legs → all 90 crosses by triangulation
          </div>
        </div>
      </div>

      <h3 className="section-heading">Live spot — streaming websocket</h3>
      <div className="note-banner">
        Pushed over Citi's streaming websocket rather than pulled: this is the
        one Citi feed here that updates continuously, because streaming does
        not draw on the per-tag call budget. It has its own limits — one live
        connection per login, ~100 connects a day — so the server opens the
        socket when someone is watching this tab and closes it again two
        minutes after the last viewer leaves. Frequency is MI01, so each leg
        updates about once a minute.
      </div>
      <LiveSpot {...stream} />

      <h3 className="section-heading" style={{ marginTop: 26 }}>
        G10 cross-rate grid
      </h3>
      <div className="note-banner">
        Citi publishes only the nine USD-quoted majors — there is no native
        EURJPY or GBPCHF tag. Every other cross here is triangulated through
        USD, so a full 90-cross matrix costs one API call rather than ninety
        tags.
      </div>
      {grid?.note && <div className="demo-banner">{grid.note}</div>}
      {gridFailed ? (
        <div className="empty-state">G10 grid unavailable.</div>
      ) : !grid ? (
        <div className="empty-state">Loading G10 grid…</div>
      ) : grid.currencies.length === 0 ? (
        <div className="empty-state">Citi returned no spot legs.</div>
      ) : (
        <>
          <div className="citi-asof">
            <PriceStamp at={grid.asOfDate} prefix="Close of" />
            <span className="vol-legend-note">
              {grid.callsSpent} of ~10 metered calls used on the spot legs.
              Cached for 12h; not polled.
            </span>
          </div>
          <G10Grid
            snapshot={grid}
            prices={stream.prices}
            streaming={stream.state.status === "live"}
          />
        </>
      )}

      <h3 className="section-heading" style={{ marginTop: 26 }}>
        Tag tree explorer
      </h3>
      <div className="note-banner">
        Navigating this costs nothing. Citi meters <code>/data</code> and{" "}
        <code>/metadata</code> at roughly ten calls per tag, but tree browsing
        and inventory counts are free — so the way to spend the budget well is
        to know exactly which tag you want before you ask for its values.
      </div>
      <TagTree catalog={catalog} />

      <SourceFooter
        sources={[
          "Citi Velocity Historical Data API — /tagbrowsing and /taglisting (free), /data (metered, EOD close)",
        ]}
      />
    </div>
  );
}
