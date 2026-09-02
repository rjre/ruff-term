# Ruff Term

An internal market data terminal — the first step toward replacing FactSet
for a subset of users. This early version focuses on two things FactSet is
used for constantly: a live watchlist and market news, plus a price chart.

## Status / scope

- **Interface:** web app (React + TypeScript frontend, Node/TypeScript backend).
- **Data:** [Polygon.io](https://polygon.io) free tier (end-of-day US equities +
  news). If no API key is configured, the server transparently serves
  deterministic mock data instead, so the app runs out of the box with zero
  setup. Swap in Ruffer's own licensed data feeds later by replacing
  `apps/server/src/marketData.ts` / `apps/server/src/polygon/client.ts` — the
  rest of the app only depends on the `@ruff-term/shared` types, not on
  Polygon specifically.
- **In scope now:** watchlist with live-ish pricing, a per-ticker candlestick
  chart, ticker search, and a news feed (market-wide or per-ticker).
- **Not yet built:** portfolio analytics, fundamentals/screening, multi-exchange
  coverage (the free data tier is US-equities only), auth/user accounts.

## Project layout

```
apps/
  server/   Fastify API — wraps Polygon.io, falls back to mock data
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
app — it works immediately with mock data.

To use real (delayed/EOD) market data instead of mock data:

1. Get a free API key at https://polygon.io/dashboard/signup
2. `cp apps/server/.env.example apps/server/.env` and set `POLYGON_API_KEY`
3. Restart the server (`npm run dev:server`)

The header badge in the app shows whether it's currently serving `mock` or
`polygon` data.

## Watchlist

The watchlist table (`apps/web/src/components/Watchlist.tsx`) mirrors the
dense, color-coded grid layout traders are used to from Bloomberg/FactSet:
ticker + exchange, short name, last price, and 1-day/2-day percentage change
columns colored green/red. It polls for updates every 30s and briefly
flashes a price cell when it moves. The list persists to `localStorage` and
starts from a default seed watchlist of large US names (the free data tier
doesn't cover the non-US exchanges shown in FactSet by default — add those
once a real multi-exchange vendor is wired in).

## Scripts

- `npm run dev` — run server + web together
- `npm run build` — build both apps
- `npm run typecheck` — typecheck both apps
