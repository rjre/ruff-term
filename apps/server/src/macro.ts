import type { MacroSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import { loadPanels, type PanelDef } from "./instrumentPanels.js";

const PANEL_DEFS: PanelDef[] = [
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
    title: "Rates & Volatility (US)",
    instruments: [
      { ticker: "^IRX", label: "US 13wk T-Bill", isRateLevel: true },
      { ticker: "^FVX", label: "US Generic 5yr", isRateLevel: true },
      { ticker: "^TNX", label: "US Generic 10yr", isRateLevel: true },
      { ticker: "^TYX", label: "US Generic 30yr", isRateLevel: true },
      { ticker: "^VIX", label: "CBOE VIX", isRateLevel: true },
    ],
  },
  {
    // No free real-time UK gilt yield ticker exists on Yahoo (unlike ^TNX for
    // US Treasuries) — these UCITS ETFs are a live, free price proxy by
    // duration bucket. For authoritative yields/prices see the UK DMO
    // (https://www.dmo.gov.uk/data/gilt-market/) or Bank of England yield
    // curves (https://www.bankofengland.co.uk/statistics/yield-curves).
    title: "UK Gilts (ETF proxies)",
    instruments: [
      { ticker: "IGLS.L", label: "0-5yr Gilts (IGLS)" },
      { ticker: "IGLT.L", label: "All Gilts (IGLT)" },
      { ticker: "GLTY.L", label: "20yr+ Gilts (GLTY)" },
      { ticker: "INXG.L", label: "Index-Linked Gilts (INXG)" },
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

async function loadSnapshot(): Promise<MacroSnapshot> {
  const panels = await loadPanels(PANEL_DEFS);
  return { asOf: new Date().toISOString(), panels };
}

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  return macroCache.getOrLoad("snapshot", loadSnapshot);
}
