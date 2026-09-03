# Ruff Term

An internal market data terminal for Ruffer — the first step toward
replacing FactSet for a subset of users. Built out as a multi-tab terminal
covering markets, portfolio, macro, and a number of Ruffer-specific and
placeholder sections requested along the way.

## Branding

Colors, logo and type are pulled from ruffer.co.uk's own stylesheet and
markup, not guessed:

- **Logo:** the real Ruffer wordmark (`apps/web/public/brand/ruffer-logo.png`,
  pulled from the site's own `/images/logos/ruffer-logo-header.png`), and the
  site's own favicons.
- **Colors:** `#086132` (deep green), `#4e9a33` (link green), `#64b446`
  (lime), `#f68e4c` (orange) — all read directly out of the site's CSS, not
  eyeballed from a screenshot.
- **Type:** the real site pairs Avenir (headings/UI) with Georgia (body
  copy) — both served as licensed webfonts we can't embed here. Headings use
  **Jost** instead (same geometric-sans lineage as Avenir/Futura, free on
  Google Fonts); body copy uses plain system **Georgia**, which renders
  identically to their webfont on any machine that has it — effectively all
  of them, since it ships with Windows and macOS. Ticker symbols and numeric
  table columns stay in **Roboto Mono** for tabular alignment — a deliberate
  exception for data-dense grids, not an inconsistency.

## Status / scope

- **Interface:** web app (React + TypeScript frontend, Node/TypeScript backend).
- **Data:** Yahoo Finance's public endpoints — genuinely global equity, FX,
  futures, rates and commodity coverage (US, LSE, HKEX, TSE, ASX, TSX,
  Euronext, and more) with no API key required. If Yahoo is unreachable, the
  server transparently falls back to deterministic mock data. Swap in
  Ruffer's own licensed data feeds later by replacing
  `apps/server/src/marketData.ts` / `apps/server/src/yahoo/client.ts` — the
  rest of the app only depends on the `@ruff-term/shared` types.
- **Refresh cadence:** prices are intraday, not end-of-day — the Watchlist
  polls the API every 30s, and the server itself caches each quote for 20s
  (`marketData.ts`'s `quoteCache`) before re-pulling from Yahoo. Yahoo's free
  endpoint is ~15 minutes delayed (same as the public finance.yahoo.com site),
  not tick-by-tick real-time. Once a market's closed, the price holds at the
  last print and gets a small "c" (close) suffix once the quote is more than
  20 minutes old, so a closed market reads as a close, not a stale live tick.
- **Self-sufficient by design:** no external API keys or paid services
  required to run it — "Ruffer Impact" news reframing runs on an in-repo
  rule-based heuristic, not a model call.
- **Not yet built:** auth/user accounts, real Ruffer holdings integration
  (Aladdin), FINRA TRACE / Citi Velocity credentials.
- **UK gilt yields are real**, not a proxy: `apps/server/src/ukGilts.ts` pulls
  the Bank of England's own daily nominal spot-curve publication (a stable,
  keyless URL, updated each business day) and parses the actual 2/5/10/30yr
  yields out of the bundled Excel workbook.

## Tabs

| Tab | What it is |
|---|---|
| Morning Brief | Default landing tab — biggest watchlist/universe movers, the day's growth-vs-protection regime signal, and top headlines, synthesized from data already live elsewhere in the app |
| Markets | Global watchlist (multiple saved lists, per-browser), candlestick/line chart with range selector, log/percentage/indexed scale modes, moving averages, Bollinger Bands, a second-ticker overlay, and PNG/CSV export; per-ticker/market news |
| Ruffer Research | Demo research notes — not real Ruffer output |
| Ruffer Portfolio | TM Ruffer Portfolio Fund snapshot, sourced from ruffer.co.uk's public monthly factsheet (manually refreshed, not a live feed) |
| Ruffer Impact | Portfolio newsflow reframed against the fund's disclosed allocation/holdings via an in-repo rule-based heuristic |
| Charts of the Day | Growth-vs-protection regime barometer (live ETF proxies) + newsflow theme breakdown |
| Macro | Multi-panel futures/indices/FX/US rates/UK gilts monitor plus a Global Rates & Credit ETF-proxy panel (international treasuries, EM bonds, US IG/HY credit) and US inflation expectations (TIPS breakevens via FRED) — all live |
| Commodities | Energy, metals and agriculture futures, live via Yahoo |
| RNS Newsfeed | UK-listed company news via Yahoo, with a rough keyword-based tone dot per headline — not the official LSE RNS feed (no free/keyless RNS API exists; real regulatory filings need a licensed source like LSEG RNS, ticker.app, or Investegate's API) |
| Portfolio Activity | Demo week-to-date trading actions log |
| UST Activity | Live Treasury ETF proxies + illustrative FINRA TRACE-style volume breakdown |
| Dividends & Corp Actions | Real dividend payment history (last 6 payments + a rough "next expected" projection) for the default watchlist names, live via Yahoo's chart endpoint. This is the watchlist's own history, not Ruffer's actual holdings calendar — that still needs Aladdin |
| Aladdin Explore | Placeholder for portfolio views/attribution/holdings charts, for users without Aladdin Explore access |
| JD Sleeve | Demo sleeve holdings with fabricated weights/values |
| FX | Live G10 spot grid; vol surface is a placeholder (needs Citi Velocity credentials via `rjre/fx-data`) |
| FMP Market Data | Catalog of data categories available under Ruffer's existing FMP subscription |
| Events | Placeholder for earnings/trading statements/calls |
| Historic Pricing | Dummy MSFT chart back to Nov 2021 — intended source: Aladdin |
| Live Orders | Placeholder order blotter — dataset used elsewhere, dashboard replica |
| Financial Headlines | Broad market news via Yahoo, unfiltered, with a rough keyword-based tone dot per headline |
| NAV Monitoring | UK investment trust premium/discount snapshot derived from `rjre/nav-monitoring-`'s committed data (not that repo's live roll-forward estimate), auto-refreshed daily — see [Keeping the GH-repo snapshots fresh](#keeping-the-gh-repo-snapshots-fresh) |
| Podcast Monitor | Stock/sector/theme mention volume, sentiment and momentum, plus a global sentiment KPI, derived from `rjre/podcast-monitor`'s committed `aggregates.json`, auto-refreshed daily — see [Keeping the GH-repo snapshots fresh](#keeping-the-gh-repo-snapshots-fresh) |
| Fed Voting | `rjre/fed-voting`, embedded live via iframe (already deployed to GitHub Pages) |
| Fed Statement | `rjre/fed-statement`, embedded live via iframe (already deployed to GitHub Pages) |
| Global Markets Calendar | UK/global market holidays; tries a live UBS CSV first, falls back to a bundled snapshot with a visible banner if UBS is unreachable |
| Guide to Global Markets | Country-by-country trading hours/conventions/exchange reference, extracted from UBS's 2025 Guide to Global Markets PDF |
| FX | G10 spot grid from Yahoo, plus a live Citi Velocity implied-vol smile — see [FX vol surface](#fx-vol-surface) |
| Citi Data | What the Citi Velocity entitlement reaches: the full 161,380-tag inventory (free to browse) and a G10 cross-rate grid triangulated from nine spot legs — see [Citi Data](#citi-data) |
| Screener | Momentum screener (price, %1D/1W/1M/3M/YTD, %52w high/low) over a curated ~65-name liquid large-cap universe, live via Yahoo, with CSV export. No P/E, market cap or dividend yield — Yahoo's fundamentals endpoints now require an auth crumb this environment can't obtain |
| CFTC Positioning | Weekly speculative net positioning (Commitments of Traders, Legacy Futures Only) in key equity index/rates/FX/commodity futures, live via CFTC's free Socrata API |
| Alerts | Price and news-keyword alerts, checked every 30s while the tab is open. Price alerts fire once then deactivate. Per-browser only — stored in `localStorage`, no server-side account or push/email/SMS, though an optional Notification API hook can show a real desktop notification |
| Short Position Data | UK aggregate net short position disclosures at/above the 0.5% threshold, live via the FCA's public CSVs (current + historic) |
| Ownership & Insider | Section 16 insider transactions (Form 4) for the US-listed watchlist names, live via SEC EDGAR. Foreign private issuers (SFL, South Bow) are exempt and show no rows |
| Central Bank Balance Sheets | Fed / ECB / BoJ total assets, live via FRED. BoE omitted — no equivalent free machine-readable weekly series found |
| Correlation Matrix | Pairwise Pearson correlation of daily log returns across 11 cross-asset instruments (equities, rates, gold, oil, USD, VIX), live via Yahoo, 3M/6M/1Y lookback, CSV export |
| Scenario Calculator | Shock sliders (equities/yields/credit/gold/FX) mapped onto the real disclosed Ruffer Portfolio allocation via assumed durations — explicitly an illustrative linear approximation, not a risk model |
| Bond Auctions | Upcoming US Treasury auctions, live via TreasuryDirect's own API. No equivalent free feed found for UK DMO gilt auctions (links out to DMO's site instead) |
| To Do | Static list of known gaps vs. a full FactSet/Bloomberg replacement (fundamentals, vol surfaces, true credit spreads/CDS, non-UK sovereign curves, comps, Excel plugin, AAII/CBOE sentiment — all checked and found blocked or unbuilt) |
| Copilot | Placeholder — intended to embed Ruffer's internal M&E Market Commentary Agent |
| Nic Perot's Chart | Placeholder (TBC) |

`rjre/fx-data` (Citi Velocity FX data tool) informs the FX tab's vol-surface
placeholder — it needs Citi credentials this environment doesn't have, so
it isn't embedded live like the two Fed tabs.

Anything marked "demo" or "placeholder" is clearly labeled in the UI itself,
not just here. Every tab also shows a "Source(s):" line at the bottom stating
exactly what powers it.

### Keeping the GH-repo snapshots fresh

`rjre/nav-monitoring-` and `rjre/podcast-monitor` are private repos with no
public raw-file access, so the NAV Monitoring and Podcast Monitor tabs can't
poll them live at request time the way the Yahoo/BoE/FCA/CFTC/SEC/FRED tabs
do. Instead, `scripts/refresh-external-snapshots.mjs` pulls each source
repo's latest commit and regenerates
`apps/server/src/data/navMonitoringSnapshot.json` /
`podcastMonitorAggregates.json` from their current data. A daily scheduled
job runs it (in a fresh session, with both source repos re-cloned) and
pushes to `main` only when the regenerated snapshot actually changed. Run it
by hand any time with `npm run refresh:external` (needs both source repos
cloned locally with pull access; see the script's header comment).

### On UK gilts

There's no free, real-time UK gilt yield ticker (unlike `^TNX` for US
Treasuries). For authoritative data, use the UK Debt Management Office
(dmo.gov.uk/data/gilt-market) or Bank of England yield curves — both free,
official, but not a simple JSON API (CSV/XML downloads). The Macro tab uses
UK gilt UCITS ETFs (`IGLS.L`, `IGLT.L`, `GLTY.L`, `INXG.L`) as a free, live
price proxy by duration bucket, same pattern as the US Treasury ETF proxies
on UST Activity.

## Project layout

```
apps/
  server/   Fastify API — wraps Yahoo Finance, falls back to mock data
  web/      React + Vite frontend
packages/
  shared/   TypeScript types shared between server and web
```

### Showing prices

Every price in the terminal carries its own "as of" stamp underneath it, so a
quote that stopped ticking hours ago can't be mistaken for a live one. Render
price cells as:

```tsx
<td className="num-cell price-cell">
  <div>{line.lastPrice.toFixed(2)}</div>
  <PriceStamp at={line.updatedAt} />
</td>
```

`PriceStamp` takes either an ISO instant (live quotes — it shows the time, and
adds the date once the quote is no longer from today) or a plain `YYYY-MM-DD`
for series that only publish daily, in which case pass `prefix="As of"`. Use
the source's own tick time (`updatedAt` / `asOfDate`), never the time the
server happened to fetch it — the two diverge by hours once a market closes.
Shared number formatting (`pctClass`, `formatSignedPct`) lives in
`apps/web/src/lib/format.ts`; import it rather than re-declaring per panel.

### Simulated data must say so

When an upstream fetch fails, the server substitutes fabricated but
plausible-looking numbers so the UI keeps working. Those payloads carry
`synthetic: true` (`WatchlistQuote`, `HistoryResponse`), and **anything
rendering them must label them** — pass `synthetic` to `PriceStamp`, which
prints "simulated" in place of a timestamp, and show a `demo-banner` on the
panel. An unmarked invented price is worse than a blank cell: a stamp reading
"as of now" is exactly what a real live tick looks like.

The screener reports symbols it could not price at all in `skipped`, rather
than silently returning a shorter table.

### Loading state without an effect

Async panels store a result *with the request it answers*, and derive
"loading" during render, rather than an effect blanking state before each
fetch:

```tsx
const [loaded, setLoaded] = useState<Loaded | null>(null);
const key = `${ticker}|${rangeDays}`;
const data = loaded?.key === key ? loaded.data : EMPTY;
const loading = loaded?.key !== key;
```

Besides satisfying `react-hooks/set-state-in-effect`, this drops a class of
race that was live in several panels: a slow response for a previous ticker
or range could land after a fast one and paint the wrong data. Two related
conventions: reset-on-prop-change adjusts state during render rather than in
an effect, and module-level stores (`recentTickers`, `tickerNames`) are read
with `useSyncExternalStore` instead of being copied into component state.

### FX vol surface

The FX tab's implied-vol smile is live Citi Velocity data (`FX.VOL.<base>.
<quote>.<strike>.<tenor>.IMPLIED.CITI`), gated behind `CITI_CLIENT_ID` /
`CITI_CLIENT_SECRET`. Without them the panel says so and nothing else changes.

Citi publishes seven points per (pair, tenor) — ATM plus 10/25/35-delta
strike-quoted vol. The server fits a natural cubic spline through whichever
came back and reads off a 5-delta ladder; the table shades quoted prints,
interpolated points and the extrapolated 5-delta wings differently, because
only the first are observed data.

**The quota is the thing to be careful with.** Citi meters `/data` at roughly
ten calls per tag, account-level, and a fresh OAuth token does not reset it.
One exhausted tag fails the whole batched query for that tenor. So:

- All seven points go out as **one** batched call per (pair, tenor).
- Results are cached **to disk** in `.citi-cache/`, not just in memory — with
  `tsx watch` an in-memory cache would re-spend the budget on every reload.
  The same directory holds a ledger of calls spent per tag, surfaced in the
  panel's footer.
- The cache holds for 12 hours and the panel **never polls**. When a fetch
  fails or the quota is spent, the last retrieved values are served with a
  banner saying so.
- Requests are serialised to one per second — Citi allows one concurrent
  request and one per second.

Widening `PAIRS` or `TENORS` in `apps/server/src/citi/volSurface.ts` spends
more of the budget, so add deliberately.

### Citi Data

A showcase tab for the Citi Velocity entitlement, built around the one fact
that governs everything here: **`/tagbrowsing` and `/taglisting` are free,
`/data` and `/metadata` are not.**

- **Tag tree explorer** — descend all 161,380 tags across the 24 FX
  sub-categories, with Citi's own labels for every coded level. Every click is
  an unmetered call, so browsing costs nothing. Sub-category counts are warmed
  in the background (one free call each, rate-limited to one per second) and
  cached for a week.
- **G10 cross-rate grid** — the full 10×10 matrix of rates, % change and a
  per-currency strength score. Citi publishes only the nine USD-quoted majors,
  so every other cross is triangulated through USD: 90 crosses for **one**
  metered call rather than 90 tags.

The grid caches to disk exactly as the vol surface does, and for the same
reason — including the *baseline* each change is measured against. Persisting
the latest close but not the baseline leaves a restarted server holding a
cache that looks fresh and a change grid with nothing to compare against.

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev
```

This starts the API on `http://localhost:4000` and the web app on
`http://localhost:5173` (which proxies `/api` to the server). Open the web
app — no configuration or API keys needed for the core experience.

The header badge shows the configured data source (`yahoo`). Individual
requests still fall back to simulated data if a Yahoo call fails — those are
flagged in the payload and labelled in the UI, see
[Simulated data must say so](#simulated-data-must-say-so).

## Watchlist

The watchlist table (`apps/web/src/components/Watchlist.tsx`) mirrors the
dense, color-coded grid traders are used to from Bloomberg/FactSet: ticker +
Bloomberg-style exchange code, short name, last price, and 1-day/2-day
percentage change columns colored green/red, with a small "c" suffix when a
price is a closed-market close rather than a live tick. It polls every 30s
and briefly flashes a price cell when it moves. The default seed watchlist
spans real tickers across Amsterdam, US, Hong Kong, Australia, Paris,
Copenhagen, Tokyo, and Toronto — verified to resolve against Yahoo. Supports
multiple named, saved watchlists (per-browser, via `localStorage`) for
organizing by book or theme; add/remove tickers via search. Click any column
header to sort (click again to flip direction), and export the current view
to CSV.

## Navigating

- Press **/** anywhere to jump into the ticker search (same convention as
  Slack/Linear/GitHub), or **?** to see the full shortcuts list.
- Press **Ctrl/Cmd+K** (or click "Jump to tab" in the header) to open a
  fuzzy-filterable command palette listing all 38 top-level tabs — the fast
  path since the nav bar itself needs horizontal scrolling to reach the
  later tabs. It also searches tickers (same results as the "/" search box),
  so it doubles as a single do-anything launcher.
- Click the ☾/☀ button in the header to switch between light and dark
  themes. The choice is remembered per-browser and applied before first
  paint, so there's no flash of the wrong theme on load; it defaults to
  your OS's light/dark preference the first time.
- The active tab lives in the URL (`#macro`), and the selected Markets
  ticker in `?t=` — `/?t=MSFT#markets` opens straight to that chart, so a
  link is shareable even if the recipient's own watchlist doesn't have that
  ticker. This works live too: pasting a different `#tab` hash while the app
  is already open (or browser back/forward) switches tabs immediately, no
  reload needed.
- Chart/categorical colors are drawn from a validated, colorblind-safe
  palette (see `apps/web/src/components/PortfolioPanel.tsx`) rather than
  picked by eye.
- Most data tables (Watchlist, Screener, CFTC Positioning, Short Position
  Data, Ownership & Insider, Dividends & Corp Actions, Correlation Matrix,
  Bond Auctions, Central Bank Balance Sheets, Portfolio Activity, NAV
  Monitoring, and the price chart itself) have an "Export CSV" button for
  pulling the current view into Excel. Financial Headlines and RNS
  Newsfeed have a keyword filter box instead, for narrowing a long list
  rather than exporting it.
- Click any ticker anywhere in the app — a watchlist/screener/ownership
  row, a correlation-matrix label, a headline's ticker tag, a Morning
  Brief mover — and it opens that ticker's chart on Markets. The chart
  itself remembers your last 8 tickers as one-click "Recently viewed"
  chips once you clear the selection, and has a "Set Alert" button that
  creates a price alert without leaving the chart.
- Click the Ruffer logo/title in the header to jump back to Morning Brief
  from anywhere.

## Scripts

- `npm run dev` — run server + web together
- `npm run build` — build both apps
- `npm run typecheck` — typecheck both apps
- `npm run lint` — ESLint over both apps. The `react-hooks` rules are errors:
  `exhaustive-deps` catches effect-dependency bugs, and `set-state-in-effect`
  keeps async loads deriving their state in render (see below)
- `npm run test` — Vitest unit tests (`npm run test:watch` to iterate)
- `npm run verify` — typecheck + lint + test, the same gate CI runs
