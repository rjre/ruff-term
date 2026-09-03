import type { MacroLine, MacroPanel } from "@ruff-term/shared";
import {
  baseBeforeOrFirst,
  monthStartSeconds,
  pctChange,
  yearStartSeconds,
} from "./series.js";
import { mapLimit, YAHOO_CONCURRENCY } from "./concurrency.js";
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

async function computeInstrumentLine(instrument: Instrument): Promise<MacroLine | null> {
  try {
    const { meta, bars } = await yahoo.fetchChart(instrument.ticker, "1y");
    if (bars.length < 2) return null;

    const latest = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    const lastPrice = meta.regularMarketPrice ?? latest.close;

    const monthBase = baseBeforeOrFirst(bars, monthStartSeconds());
    const yearBase = baseBeforeOrFirst(bars, yearStartSeconds());

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
  // One shared budget across every panel. Previously each panel's instruments
  // went out via Promise.all, so a 6-panel sheet still hit Yahoo in wide
  // bursts; mapLimit preserves input order, so results regroup by offset.
  const flattened = defs.flatMap((def) => def.instruments);
  const lines = await mapLimit(flattened, YAHOO_CONCURRENCY, computeInstrumentLine);

  const panels: MacroPanel[] = [];
  let cursor = 0;
  for (const def of defs) {
    const slice = lines.slice(cursor, cursor + def.instruments.length);
    cursor += def.instruments.length;
    panels.push({
      title: def.title,
      lines: slice.filter((l): l is MacroLine => l !== null),
    });
  }
  return panels;
}
