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

## Tabs

| Tab | What it is |
|---|---|
| Markets | Global watchlist, candlestick chart, per-ticker/market news |
| Ruffer Research | Demo research notes — not real Ruffer output |
| Ruffer Portfolio | TM Ruffer Portfolio Fund snapshot, sourced from ruffer.co.uk's public monthly factsheet (manually refreshed, not a live feed) |
| Ruffer Impact | Portfolio newsflow reframed against the fund's disclosed allocation/holdings (Claude if `ANTHROPIC_API_KEY` set, else heuristic) |
| Charts of the Day | Growth-vs-protection regime barometer (live ETF proxies) + newsflow theme breakdown |
| Macro | Multi-panel futures/indices/FX/rates/commodities monitor, live via Yahoo |
| Portfolio Activity | Demo week-to-date trading actions log |
| UST Activity | Live Treasury ETF proxies + illustrative FINRA TRACE-style volume breakdown |
| Dividends & Corp Actions | Placeholder — to source from Aladdin |
| Aladdin Explore | Placeholder for portfolio views/attribution/holdings charts, for users without Aladdin Explore access |
| JD Sleeve | Demo sleeve holdings with fabricated weights/values |
| FX | Live G10 spot grid; vol surface is a placeholder (needs Citi Velocity credentials via `rjre/fx-data`) |
| FMP Market Data | Catalog of data categories available under Ruffer's existing FMP subscription |
| Events | Placeholder for earnings/trading statements/calls |
| Nic Perot's Chart | Placeholder (TBC) |

Anything marked "demo" or "placeholder" is clearly labeled in the UI itself,
not just here.

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
