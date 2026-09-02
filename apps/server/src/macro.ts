import type { MacroLine, MacroPanel, MacroSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import * as yahoo from "./yahoo/client.js";

interface Instrument {
  ticker: string;
  label: string;
  isRateLevel?: boolean;
}

const PANEL_DEFS: Array<{ title: string; instruments: Instrument[] }> = [
  {
    title: "Equity Futures",
    instruments: [
      { ticker: "ES=F", label: "S&P 500 Fut" },
      { ticker: "NQ=F", label: "Nasdaq 100 Fut" },
      { ticker: "YM=F", label: "Dow Fut" },
      { ticker: "RTY=F", label: "Russell 2000 Fut" },
      { ticker: "NKD=F", label: "Nikkei 225 Fut" },
    ],
  },
  {
    title: "Equity Indices",
    instruments: [
      { ticker: "^GSPC", label: "S&P 500" },
      { ticker: "^NDX", label: "Nasdaq 100" },
      { ticker: "^DJI", label: "Dow Jones" },
      { ticker: "^RUT", label: "Russell 2000" },
      { ticker: "^N225", label: "Nikkei 225" },
      { ticker: "^HSI", label: "Hang Seng" },
      { ticker: "^FTSE", label: "FTSE 100" },
      { ticker: "^GDAXI", label: "DAX" },
      { ticker: "000300.SS", label: "CSI 300" },
    ],
  },
  {
    title: "FX",
    instruments: [
      { ticker: "DX-Y.NYB", label: "Dollar Index" },
      { ticker: "EURUSD=X", label: "EUR/USD" },
      { ticker: "GBPUSD=X", label: "GBP/USD" },
      { ticker: "USDJPY=X", label: "USD/JPY" },
      { ticker: "EURGBP=X", label: "EUR/GBP" },
      { ticker: "GBPJPY=X", label: "GBP/JPY" },
      { ticker: "EURJPY=X", label: "EUR/JPY" },
      { ticker: "USDCNH=X", label: "USD/CNH" },
      { ticker: "AUDUSD=X", label: "AUD/USD" },
    ],
  },
  {
    title: "Rates & Volatility",
    instruments: [
      { ticker: "^IRX", label: "US 13wk T-Bill", isRateLevel: true },
      { ticker: "^FVX", label: "US Generic 5yr", isRateLevel: true },
      { ticker: "^TNX", label: "US Generic 10yr", isRateLevel: true },
      { ticker: "^TYX", label: "US Generic 30yr", isRateLevel: true },
      { ticker: "^VIX", label: "CBOE VIX", isRateLevel: true },
    ],
  },
  {
    title: "Commodities",
    instruments: [
      { ticker: "GC=F", label: "Gold" },
      { ticker: "SI=F", label: "Silver" },
      { ticker: "HG=F", label: "Copper Fut" },
      { ticker: "CL=F", label: "WTI Crude" },
      { ticker: "BZ=F", label: "Brent Crude" },
      { ticker: "NG=F", label: "Nat Gas" },
      { ticker: "DBC", label: "Commodity Index (CRB proxy)" },
    ],
  },
  {
    title: "Digital",
    instruments: [
      { ticker: "BTC-USD", label: "Bitcoin" },
      { ticker: "ETH-USD", label: "Ethereum" },
    ],
  },
];

const macroCache = new TtlCache<MacroSnapshot>(60_000);

function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return Math.round(((to - from) / from) * 10000) / 100;
}

/** Last bar strictly before `cutoffSeconds`, from ascending-sorted bars. */
function baseBefore(bars: { time: number; close: number }[], cutoffSeconds: number) {
  let base: { time: number; close: number } | null = null;
  for (const b of bars) {
    if (b.time < cutoffSeconds) base = b;
    else break;
  }
  return base;
}

async function computeMacroLine(instrument: Instrument): Promise<MacroLine | null> {
  try {
    const { meta, bars } = await yahoo.fetchChart(instrument.ticker, "1y");
    if (bars.length < 2) return null;

    const latest = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const lastPrice = meta.regularMarketPrice ?? latest.close;

    const now = new Date();
    const monthStartCutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
    const yearStartCutoff = Date.UTC(now.getUTCFullYear(), 0, 1) / 1000;

    const monthBase = baseBefore(bars, monthStartCutoff) ?? bars[0];
    const yearBase = baseBefore(bars, yearStartCutoff) ?? bars[0];

    return {
      ticker: instrument.ticker,
      label: instrument.label,
      lastPrice,
      currency: meta.currency,
      isRateLevel: instrument.isRateLevel ?? false,
      changePct1d: pctChange(prev.close, lastPrice),
      netChange1d: Math.round((lastPrice - prev.close) * 10000) / 10000,
      changePctMtd: pctChange(monthBase.close, lastPrice),
      changePctYtd: pctChange(yearBase.close, lastPrice),
    };
  } catch (err) {
    console.warn(`[macro] Skipping ${instrument.ticker}:`, (err as Error).message);
    return null;
  }
}

async function loadSnapshot(): Promise<MacroSnapshot> {
  const panels: MacroPanel[] = [];
  for (const def of PANEL_DEFS) {
    const lines = (await Promise.all(def.instruments.map(computeMacroLine))).filter(
      (l): l is MacroLine => l !== null
    );
    panels.push({ title: def.title, lines });
  }
  return { asOf: new Date().toISOString(), panels };
}

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  return macroCache.getOrLoad("snapshot", loadSnapshot);
}
