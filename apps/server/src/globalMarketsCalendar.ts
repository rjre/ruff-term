import type { GlobalMarketsCalendarSnapshot, MarketHolidayDay } from "@ruff-term/shared";
import fallbackDays from "./data/ubsFxCalendar2026.json" with { type: "json" };
import { LiveCache } from "./cache.js";

const CSV_URL =
  "https://www.ubs.com/content/dam/content-fragments/html-custom-code/investment-bank/global-markets-calendar/data/foreign-exchange.csv";
const SOURCE_LABEL = "UBS Global Markets Calendar — FX & precious metals holidays";

/** Minimal parser for this file's shape: 3 columns, values may be
 * comma-containing and double-quoted. Good enough for this one feed;
 * not a general CSV parser. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text: string): MarketHolidayDay[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const days: MarketHolidayDay[] = [];
  for (const line of lines.slice(1)) {
    const [dateRaw, indexRaw, holidaysRaw] = parseCsvLine(line);
    if (!dateRaw) continue;
    const [mm, dd, yyyy] = dateRaw.trim().split("/");
    if (!mm || !dd || !yyyy) continue;
    const currencies = (holidaysRaw ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    days.push({
      date: `${yyyy}-${mm}-${dd}`,
      preciousMetalsNote: indexRaw?.trim() || null,
      currenciesClosed: [...new Set(currencies)].sort(),
    });
  }
  return days;
}

// Fetched only on mount (tab visit or the header's Refresh button, which
// fully remounts the active view), never polled — a TTL cache here would
// just make Refresh look like it does nothing. loadSnapshot() already
// catches its own fetch failure and falls back to the bundled snapshot, so
// this rarely needs LiveCache's own fail-open fallback in practice.
const cache = new LiveCache<GlobalMarketsCalendarSnapshot>();

async function loadSnapshot(): Promise<GlobalMarketsCalendarSnapshot> {
  try {
    const res = await fetch(CSV_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) throw new Error(`UBS calendar fetch failed: ${res.status}`);
    const text = await res.text();
    const days = parseCsv(text);
    if (days.length === 0) throw new Error("Parsed 0 rows from live CSV");
    return { live: true, days, sourceLabel: SOURCE_LABEL, sourceUrl: CSV_URL };
  } catch (err) {
    console.warn("[globalMarketsCalendar] Live fetch failed, using bundled snapshot:", (err as Error).message);
    return {
      live: false,
      days: fallbackDays as MarketHolidayDay[],
      sourceLabel: SOURCE_LABEL,
      sourceUrl: CSV_URL,
    };
  }
}

export async function getGlobalMarketsCalendar(): Promise<GlobalMarketsCalendarSnapshot> {
  return cache.get("snapshot", loadSnapshot);
}
