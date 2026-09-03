import type { MacroLine, MacroPanel } from "@ruff-term/shared";
import * as yahoo from "./yahoo/client.js";

export interface Instrument {
  ticker: string;
  label: string;
  isRateLevel?: boolean;
}

export interface PanelDef {
  title: string;
  instruments: Instrument[];
}

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

async function computeInstrumentLine(instrument: Instrument): Promise<MacroLine | null> {
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
      updatedAt: new Date(meta.regularMarketTime * 1000).toISOString(),
    };
  } catch (err) {
    console.warn(`[instrumentPanels] Skipping ${instrument.ticker}:`, (err as Error).message);
    return null;
  }
}

export async function loadPanels(defs: PanelDef[]): Promise<MacroPanel[]> {
  const panels: MacroPanel[] = [];
  for (const def of defs) {
    const lines = (await Promise.all(def.instruments.map(computeInstrumentLine))).filter(
      (l): l is MacroLine => l !== null
    );
    panels.push({ title: def.title, lines });
  }
  return panels;
}
