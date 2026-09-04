import AdmZip from "adm-zip";
import type { UkGiltYieldLine, UkGiltYieldSnapshot } from "@ruff-term/shared";
import * as XLSX from "xlsx";

/**
 * Real UK gilt spot yields from the Bank of England's own daily yield-curve
 * publication — free, keyless, stable URL, updated each business day. This
 * is the actual gilt market, not a price proxy (compare to the ETF-based
 * "UK Gilts (ETF proxies)" panel on the Macro tab, which is a live tradeable
 * stand-in but not the yield itself).
 */
const BOE_ZIP_URL =
  "https://www.bankofengland.co.uk/-/media/boe/files/statistics/yield-curves/latest-yield-curve-data.zip";
const ZIP_ENTRY = "GLC Nominal daily data current month.xlsx";
const SHEET_NAME = "4. spot curve";
const TENORS = [2, 5, 10, 30];

/**
 * No TTL cache here on purpose: this panel only ever fetches on mount (tab
 * visit or the header's Refresh button, which fully remounts the active
 * view) rather than on a poll, so every call already represents a genuine
 * "get me the current curve" moment — a time-gated cache would just be a
 * reason for Refresh to visibly do nothing. `lastGood` is a fail-open
 * fallback for when BoE is unreachable, not a freshness gate; `inFlight`
 * only dedupes genuinely concurrent callers (React StrictMode's double
 * effect invocation in dev, or more than one browser tab loading at once).
 */
let lastGood: UkGiltYieldSnapshot | undefined;
let inFlight: Promise<UkGiltYieldSnapshot> | undefined;

async function loadSnapshot(): Promise<UkGiltYieldSnapshot> {
  const res = await fetch(BOE_ZIP_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`BoE yield curve download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry(ZIP_ENTRY);
  if (!entry) throw new Error(`Zip entry not found: ${ZIP_ENTRY}`);

  const workbook = XLSX.read(entry.getData(), { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Sheet not found: ${SHEET_NAME}`);

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][];
  const headerRow = rows.find((r) => r[0] === "years:");
  if (!headerRow) throw new Error("Could not find tenor header row");

  const dataRows = rows.filter((r): r is [Date, ...(number | null)[]] => r[0] instanceof Date);
  if (dataRows.length === 0) throw new Error("No dated rows found in spot curve sheet");

  const latest = dataRows[dataRows.length - 1];
  const prev = dataRows.length >= 2 ? dataRows[dataRows.length - 2] : null;

  const lines: UkGiltYieldLine[] = TENORS.map((tenor) => {
    const colIndex = headerRow.findIndex((v) => v === tenor);
    const yieldPct = colIndex >= 0 ? (latest[colIndex] as number | null) : null;
    const prevYield = prev && colIndex >= 0 ? (prev[colIndex] as number | null) : null;
    return {
      tenorYears: tenor,
      yieldPct: yieldPct ?? 0,
      changeBp1d: yieldPct != null && prevYield != null ? Math.round((yieldPct - prevYield) * 100) : 0,
    };
  }).filter((l) => l.yieldPct !== 0);

  return {
    asOfDate: latest[0].toISOString().slice(0, 10),
    lines,
    sourceLabel: "Bank of England — UK nominal spot yield curve (daily)",
    sourceUrl: "https://www.bankofengland.co.uk/statistics/yield-curves",
  };
}

export async function getUkGiltYields(): Promise<UkGiltYieldSnapshot> {
  if (inFlight) return inFlight;
  inFlight = loadSnapshot()
    .then((value) => {
      lastGood = value;
      return value;
    })
    .catch((err) => {
      // BoE hiccup: serve the last real curve rather than an error banner —
      // it's still yesterday's actual print, not stale in a misleading way
      // since gilts only move once a business day regardless.
      if (lastGood) return lastGood;
      throw err;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}
