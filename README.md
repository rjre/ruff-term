# Ruff Term

An internal market data terminal for Ruffer — the first step toward
replacing FactSet for a subset of users. Built out as a multi-tab terminal
covering markets, portfolio, macro, and a number of Ruffer-specific and
placeholder sections requested along the way.

## Status / scope

- **Interface:** web app (React + TypeScript frontend, Node/TypeScript backend).
- **Data:** Yahoo Finance's public endpoints — genuinely global equity, FX,
  futures, rates and commodity coverage (US, LSE, HKEX, TSE, ASX, TSX,
  Euronext, and more) with no API key required. If Yahoo is unreachable, the
  server transparently falls back to deterministic mock data. Swap in
  Ruffer's own licensed data feeds later by replacing
  `apps/server/src/marketData.ts` / `apps/server/src/yahoo/client.ts` — the
  rest of the app only depends on the `@ruff-term/shared` types.
- **Optional:** set `ANTHROPIC_API_KEY` to unlock live Claude-generated
  "Ruffer Impact" news reframing; without it, a rule-based heuristic fallback
  is used.
- **Not yet built:** auth/user accounts, real Ruffer holdings integration
  (Aladdin), FINRA TRACE / Citi Velocity credentials.
- **UK gilt yields are real**, not a proxy: `apps/server/src/ukGilts.ts` pulls
  the Bank of England's own daily nominal spot-curve publication (a stable,
  keyless URL, updated each business day) and parses the actual 2/5/10/30yr
  yields out of the bundled Excel workbook.

## Tabs

| Tab | What it is |
|---|---|
| Markets | Global watchlist, candlestick chart, per-ticker/market news |
| Ruffer Research | Demo research notes — not real Ruffer output |
| Ruffer Portfolio | TM Ruffer Portfolio Fund snapshot, sourced from ruffer.co.uk's public monthly factsheet (manually refreshed, not a live feed) |
| Ruffer Impact | Portfolio newsflow reframed against the fund's disclosed allocation/holdings (Claude if `ANTHROPIC_API_KEY` set, else heuristic) |
| Charts of the Day | Growth-vs-protection regime barometer (live ETF proxies) + newsflow theme breakdown |
| Macro | Multi-panel futures/indices/FX/US rates/UK gilts monitor, live via Yahoo |
| Commodities | Energy, metals and agriculture futures, live via Yahoo |
| RNS Newsfeed | UK-listed company news via Yahoo — not the official LSE RNS feed (no free/keyless RNS API exists; real regulatory filings need a licensed source like LSEG RNS, ticker.app, or Investegate's API) |
| Portfolio Activity | Demo week-to-date trading actions log |
| UST Activity | Live Treasury ETF proxies + illustrative FINRA TRACE-style volume breakdown |
| Dividends & Corp Actions | Placeholder — to source from Aladdin |
| Aladdin Explore | Placeholder for portfolio views/attribution/holdings charts, for users without Aladdin Explore access |
| JD Sleeve | Demo sleeve holdings with fabricated weights/values |
| FX | Live G10 spot grid; vol surface is a placeholder (needs Citi Velocity credentials via `rjre/fx-data`) |
| FMP Market Data | Catalog of data categories available under Ruffer's existing FMP subscription |
| Events | Placeholder for earnings/trading statements/calls |
| Historic Pricing | Dummy MSFT chart back to Nov 2021 — intended source: Aladdin |
| Live Orders | Placeholder order blotter — dataset used elsewhere, dashboard replica |
| Financial Headlines | Broad market news via Yahoo, unfiltered |
| NAV Monitoring | UK investment trust premium/discount snapshot copied from `rjre/nav-monitoring-`'s committed data (not that repo's live roll-forward estimate) |
| Podcast Monitor | Stock/sector mention volume, sentiment and momentum, snapshot copied from `rjre/podcast-monitor`'s committed `aggregates.json` |
| Fed Voting | `rjre/fed-voting`, embedded live via iframe (already deployed to GitHub Pages) |
| Fed Statement | `rjre/fed-statement`, embedded live via iframe (already deployed to GitHub Pages) |
| Global Markets Calendar | UK/global market holidays; tries a live UBS CSV first, falls back to a bundled snapshot with a visible banner if UBS is unreachable |
| Guide to Global Markets | Country-by-country trading hours/conventions/exchange reference, extracted from UBS's 2025 Guide to Global Markets PDF |
| Screener | Momentum screener (price, %1D/1W/1M/3M/YTD, %52w high/low) over a curated ~65-name liquid large-cap universe, live via Yahoo. No P/E, market cap or dividend yield — Yahoo's fundamentals endpoints now require an auth crumb this environment can't obtain |
| CFTC Positioning | Weekly speculative net positioning (Commitments of Traders, Legacy Futures Only) in key equity index/rates/FX/commodity futures, live via CFTC's free Socrata API |
| Alerts | Price and news-keyword alerts, checked every 30s while the tab is open. Per-browser only — stored in `localStorage`, no server-side account or push/email/SMS |
| Short Position Data | UK aggregate net short position disclosures at/above the 0.5% threshold, live via the FCA's public CSVs (current + historic) |
| Ownership & Insider | Section 16 insider transactions (Form 4) for the US-listed watchlist names, live via SEC EDGAR. Foreign private issuers (SFL, South Bow) are exempt and show no rows |
| Central Bank Balance Sheets | Fed / ECB / BoJ total assets, live via FRED. BoE omitted — no equivalent free machine-readable weekly series found |
| To Do | Static list of known gaps vs. a full FactSet/Bloomberg replacement (fundamentals, vol surfaces, credit spreads, auction calendars, comps, export, Excel plugin) |
| Copilot | Placeholder — intended to embed Ruffer's internal M&E Market Commentary Agent |
| Nic Perot's Chart | Placeholder (TBC) |

`rjre/fx-data` (Citi Velocity FX data tool) informs the FX tab's vol-surface
placeholder — it needs Citi credentials this environment doesn't have, so
it isn't embedded live like the two Fed tabs.

Anything marked "demo" or "placeholder" is clearly labeled in the UI itself,
not just here. Every tab also shows a "Source(s):" line at the bottom stating
exactly what powers it.

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

## Getting started

Requires Node 20+.

```bash
npm install
npm run dev
```

This starts the API on `http://localhost:4000` and the web app on
`http://localhost:5173` (which proxies `/api` to the server). Open the web
app — no configuration or API keys needed for the core experience.

The header badge shows the active data source (`yahoo`; falls back to mock
per-request if a Yahoo call fails).

## Watchlist

The watchlist table (`apps/web/src/components/Watchlist.tsx`) mirrors the
dense, color-coded grid traders are used to from Bloomberg/FactSet: ticker +
Bloomberg-style exchange code, short name, last price, and 1-day/2-day
percentage change columns colored green/red, with a small "c" suffix when a
price is a closed-market close rather than a live tick. It polls every 30s
and briefly flashes a price cell when it moves. The default seed watchlist
spans real tickers across Amsterdam, US, Hong Kong, Australia, Paris,
Copenhagen, Tokyo, and Toronto — verified to resolve against Yahoo. The list
persists to `localStorage`; add/remove tickers via search.

## Branding

Colors and typography are pulled from ruffer.co.uk's actual site: a white
ground with the deep green (`#086132`) / medium green (`#4e9a33`) palette as
accents, and the Jost typeface (a free geometric-sans stand-in for Ruffer's
licensed Avenir) for UI chrome, with tabular monospace kept for numeric data
columns. Chart/categorical colors are drawn from a validated, colorblind-safe
palette (see `apps/web/src/components/PortfolioPanel.tsx`) rather than
picked by eye.

## Scripts

- `npm run dev` — run server + web together
- `npm run build` — build both apps
- `npm run typecheck` — typecheck both apps
