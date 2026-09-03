import type { ShortPositionHistoryPoint, ShortPositionLine, ShortPositionsSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";

/**
 * UK aggregate net short position disclosures — the FCA's own public
 * register of net short positions in UK shares at/above the 0.5% reporting
 * threshold (Short Selling Regulation). Free, keyless CSVs, updated daily.
 */
const CURRENT_CSV_URL = "https://www.fca.org.uk/publication/documents/aggregated-current-net-short-positions.csv";
const HISTORIC_CSV_URL = "https://www.fca.org.uk/publication/documents/aggregated-historic-net-short-positions.csv";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const cache = new TtlCache<ShortPositionsSnapshot>(60 * 60_000);

/** Minimal CSV line parser handling quoted fields with embedded commas. */
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

function ddmmyyyyToIso(d: string): string {
  const [dd, mm, yyyy] = d.split("/");
  if (!dd || !mm || !yyyy) return d;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

async function fetchCsv(url: string): Promise<string[][]> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`FCA CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.slice(1).map(parseCsvLine);
}

async function loadSnapshot(): Promise<ShortPositionsSnapshot> {
  const [currentRows, historicRows] = await Promise.all([
    fetchCsv(CURRENT_CSV_URL),
    fetchCsv(HISTORIC_CSV_URL),
  ]);

  const current: ShortPositionLine[] = currentRows
    .filter((r) => r.length >= 4 && r[2])
    .map((r) => ({
      name: r[0],
      isin: r[1],
      netShortPct: Number(r[2]),
      positionDate: ddmmyyyyToIso(r[3]),
    }))
    .filter((r) => Number.isFinite(r.netShortPct));

  const top = current.sort((a, b) => b.netShortPct - a.netShortPct).slice(0, 25);

  // Match on ISIN, not name — the FCA's current/historic exports don't share
  // consistent capitalisation for the same company (e.g. "Vistry Group PLC"
  // vs "VISTRY GROUP PLC"), but the ISIN is stable across both files.
  const history: Record<string, ShortPositionHistoryPoint[]> = {};
  const topIsins = new Set(top.map((t) => t.isin));
  for (const r of historicRows) {
    if (r.length < 4 || !topIsins.has(r[1])) continue;
    const pct = Number(r[2]);
    if (!Number.isFinite(pct)) continue;
    (history[r[1]] ??= []).push({ netShortPct: pct, positionDate: ddmmyyyyToIso(r[3]) });
  }
  for (const isin of Object.keys(history)) {
    history[isin].sort((a, b) => a.positionDate.localeCompare(b.positionDate));
  }

  return {
    asOf: new Date().toISOString(),
    top,
    history,
    sourceLabel: "FCA — Net short positions in UK shares (Short Selling Regulation disclosure)",
    sourceUrl: "https://www.fca.org.uk/markets/short-selling/notification-disclosure-net-short-positions",
  };
}

export async function getShortPositions(): Promise<ShortPositionsSnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
