# Ruff Term

An internal market data terminal for Ruffer — the first step toward
replacing FactSet for a subset of users. This early version focuses on the
things FactSet is used for constantly: a live global watchlist, a price
chart, and company/portfolio news.

## Status / scope

- **Interface:** web app (React + TypeScript frontend, Node/TypeScript backend).
- **Data:** Yahoo Finance's public endpoints — genuinely global equity
  coverage (US, LSE, HKEX, TSE, ASX, TSX, Euronext, and more) with no API
  key required. If Yahoo is unreachable, the server transparently falls
  back to deterministic mock data, so the app always runs. Swap in Ruffer's
  own licensed data feeds later by replacing `apps/server/src/marketData.ts`
  / `apps/server/src/yahoo/client.ts` — the rest of the app only depends on
  the `@ruff-term/shared` types.
- **In scope now:** a global multi-currency watchlist with live-ish pricing,
  a per-ticker candlestick chart, ticker search, and news — either
  per-ticker, aggregated "portfolio newsflow" across the whole watchlist
  (a stand-in for real holdings until Ruffer portfolio data is wired in),
  or general market headlines.
- **Not yet built:** portfolio analytics, fundamentals/screening, auth/user
  accounts, real Ruffer holdings integration.
- **On the data source:** Yahoo's endpoints are public but unofficial (no
  formal SLA or ToS-sanctioned API contract) — they're a strong, free way to
  prototype global coverage today, and a fine long-term choice if it holds
  up, but a paid vendor (e.g. EODHD's ~$20/mo "All World" plan, or Ruffer's
  own licensed feeds) is the credible fallback if reliability becomes an
  issue.

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
app — no configuration or API keys needed.

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

Colors and typography are pulled from ruffer.co.uk: the deep green
(`#086132`) / lime (`#64b446`, `#abfc8d`) palette as accents on a dark
terminal background, and the Jost typeface (a free geometric-sans stand-in
for Ruffer's Avenir) for UI chrome, with tabular monospace kept for numeric
data.

## Scripts

- `npm run dev` — run server + web together
- `npm run build` — build both apps
- `npm run typecheck` — typecheck both apps
