import type { ShortPositionHistoryPoint, ShortPositionLine, ShortPositionsSnapshot } from "@ruff-term/shared";
import * as XLSX from "xlsx";
import { LiveCache, TtlCache } from "./cache.js";

/**
 * UK aggregate net short position disclosures — the FCA's own public
 * register of net short positions in UK shares at/above the 0.5% reporting
 * threshold (Short Selling Regulation). Free, keyless CSVs, updated daily.
 */
const CURRENT_CSV_URL = "https://www.fca.org.uk/publication/documents/aggregated-current-net-short-positions.csv";
const HISTORIC_CSV_URL = "https://www.fca.org.uk/publication/documents/aggregated-historic-net-short-positions.csv";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

/**
 * The current aggregate feed only carries a rolling ~3 months. FCA's own
 * predecessor regime — individual holders disclosing their own position,
 * rather than one anonymised aggregate — publishes an "archived" register
 * of every such disclosure back to 2012. Reconstructing a per-company
 * aggregate from it (see `reconstructIndividualRegime`) extends the history
 * chart by over a decade.
 */
const INDIVIDUAL_ARCHIVE_URL = "https://www.fca.org.uk/publication/data/short-positions-daily-update.xlsx";
const INDIVIDUAL_ARCHIVE_LABEL =
  "FCA — Public individual disclosures under the previous regime (archived)";
const INDIVIDUAL_ARCHIVE_PAGE_URL =
  "https://www.fca.org.uk/markets/short-selling/notification-disclosure-net-short-positions";

// Fetched only on mount (tab visit or the header's Refresh button, which
// fully remounts the active view), never polled — a TTL cache here would
// just make Refresh look like it does nothing.
const cache = new LiveCache<ShortPositionsSnapshot>();

/**
 * The archive is a different kind of cache to the one above, deliberately:
 * it's a ~3MB, 100k-row file FCA itself calls an archive of a discontinued
 * regime, so unlike the daily current/historic feeds there is no "give me
 * the latest" to lose by holding onto it — a day-long TTL just avoids
 * re-downloading and re-parsing it on every tab visit.
 */
const archiveCache = new TtlCache<Map<string, ShortPositionHistoryPoint[]>>(24 * 60 * 60_000);

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

/**
 * Reconstructs a per-company aggregate net short % history from individual
 * holder-level disclosures.
 *
 * The old regime required each holder to disclose their own position
 * whenever it crossed the 0.5% threshold (or moved another 0.1% once
 * above it) — so at any date, a company's aggregate is the sum of every
 * holder's most recently disclosed value as of that date, carried forward
 * until they report again. A holder reporting 0 has dropped back under the
 * threshold and drops out of the sum until they next report non-zero. This
 * walks each company's disclosures in date order maintaining exactly that
 * running sum, emitting one point per distinct date (holders who disclose
 * on the same day are merged into a single point for that day).
 */
export function reconstructIndividualRegime(
  rows: Array<{ holder: string; isin: string; pct: number; date: Date }>,
): Map<string, ShortPositionHistoryPoint[]> {
  const byIsin = new Map<string, typeof rows>();
  for (const row of rows) {
    (byIsin.get(row.isin) ?? byIsin.set(row.isin, []).get(row.isin)!).push(row);
  }

  const result = new Map<string, ShortPositionHistoryPoint[]>();
  for (const [isin, events] of byIsin) {
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    const latestByHolder = new Map<string, number>();
    let total = 0;
    const points: ShortPositionHistoryPoint[] = [];
    let i = 0;
    while (i < events.length) {
      const day = events[i].date.getTime();
      while (i < events.length && events[i].date.getTime() === day) {
        const { holder, pct } = events[i];
        total += pct - (latestByHolder.get(holder) ?? 0);
        latestByHolder.set(holder, pct);
        i++;
      }
      points.push({
        netShortPct: Math.round(total * 100) / 100,
        positionDate: new Date(day).toISOString().slice(0, 10),
        reconstructed: true,
      });
    }
    result.set(isin, points);
  }
  return result;
}

async function loadIndividualArchive(): Promise<Map<string, ShortPositionHistoryPoint[]>> {
  return archiveCache.getOrLoad("archive", async () => {
    const res = await fetch(INDIVIDUAL_ARCHIVE_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`FCA individual-regime archive fetch failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    // Named for whatever date FCA last refreshed it, e.g. "Historic
    // Disclosures 10.07.2026" — read positionally rather than by name so a
    // future refresh with a different date in the sheet name doesn't break this.
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];

    const rows: Array<{ holder: string; isin: string; pct: number; date: Date }> = [];
    for (const r of raw.slice(1)) {
      const [holder, , isin, pct, date] = r;
      if (typeof isin !== "string" || !isin) continue;
      if (typeof pct !== "number" || !Number.isFinite(pct)) continue;
      if (!(date instanceof Date)) continue;
      rows.push({ holder: typeof holder === "string" ? holder : String(holder), isin, pct, date });
    }
    return reconstructIndividualRegime(rows);
  });
}

async function loadSnapshot(): Promise<ShortPositionsSnapshot> {
  const [currentRows, historicRows, archive] = await Promise.all([
    fetchCsv(CURRENT_CSV_URL),
    fetchCsv(HISTORIC_CSV_URL),
    loadIndividualArchive().catch((err) => {
      // Non-fatal: the current-regime history below still works fine alone,
      // just without the pre-2026 reconstructed points.
      console.warn("[shortPositions] Individual-regime archive unavailable:", (err as Error).message);
      return null;
    }),
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

  // Prepend the reconstructed pre-2026 history, but only the part that
  // predates what the current-regime feed already covers — the two regimes
  // overlap by several weeks, and the aggregate feed is FCA's own real
  // figure for that window, not a self-computed one.
  if (archive) {
    for (const isin of topIsins) {
      const reconstructed = archive.get(isin);
      if (!reconstructed || reconstructed.length === 0) continue;
      const earliestCurrent = history[isin]?.[0]?.positionDate;
      const older = earliestCurrent
        ? reconstructed.filter((p) => p.positionDate < earliestCurrent)
        : reconstructed;
      if (older.length === 0) continue;
      history[isin] = [...older, ...(history[isin] ?? [])];
    }
  }

  return {
    asOf: new Date().toISOString(),
    top,
    history,
    sourceLabel: "FCA — Net short positions in UK shares (Short Selling Regulation disclosure)",
    sourceUrl: "https://www.fca.org.uk/markets/short-selling/notification-disclosure-net-short-positions",
    individualRegimeSourceLabel: archive ? INDIVIDUAL_ARCHIVE_LABEL : null,
    individualRegimeSourceUrl: archive ? INDIVIDUAL_ARCHIVE_PAGE_URL : null,
  };
}

export async function getShortPositions(): Promise<ShortPositionsSnapshot> {
  return cache.get("snapshot", loadSnapshot);
}
