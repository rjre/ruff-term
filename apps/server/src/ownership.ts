import { XMLParser } from "fast-xml-parser";
import type { InsiderTransaction, OwnershipSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";

/**
 * Section 16 insider transactions (Form 4) straight from SEC EDGAR — free,
 * keyless, official data. Only US-domestic issuers file Form 4; foreign
 * private issuers on the watchlist (e.g. SFL, South Bow) are exempt under
 * Exchange Act Rule 3a12-3 and simply show no transactions here.
 */
const TICKERS_JSON_URL = "https://www.sec.gov/files/company_tickers.json";
const UA = "RuffTermDemo/1.0 (+https://ruffer.co.uk; educational Claude Code demo)";
const MAX_FILINGS_PER_TICKER = 4;

const TRANSACTION_CODE_LABELS: Record<string, string> = {
  P: "Open market purchase",
  S: "Open market sale",
  A: "Grant/award",
  D: "Disposition to issuer",
  F: "Tax withholding",
  M: "Option exercise",
  G: "Gift",
  C: "Conversion",
  X: "Option exercise (in-the-money)",
};

const cikCache = new TtlCache<Record<string, { cik: number; title: string }>>(24 * 60 * 60_000);
const snapshotCache = new TtlCache<OwnershipSnapshot>(60 * 60_000);

const xmlParser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "nonDerivativeTransaction" || name === "derivativeTransaction" });

async function loadTickerCikMap(): Promise<Record<string, { cik: number; title: string }>> {
  return cikCache.getOrLoad("map", async () => {
    const res = await fetch(TICKERS_JSON_URL, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`SEC ticker map fetch failed: ${res.status}`);
    const data = (await res.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
    const map: Record<string, { cik: number; title: string }> = {};
    for (const v of Object.values(data)) {
      map[v.ticker] = { cik: v.cik_str, title: v.title };
    }
    return map;
  });
}

interface RecentFilings {
  form: string[];
  accessionNumber: string[];
  primaryDocument: string[];
}

async function fetchRecentForm4Filings(cik: number): Promise<Array<{ accession: string }>> {
  const cikPadded = String(cik).padStart(10, "0");
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cikPadded}.json`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`SEC submissions fetch failed: ${res.status}`);
  const data = (await res.json()) as { filings: { recent: RecentFilings } };
  const recent = data.filings.recent;
  const filings: Array<{ accession: string }> = [];
  for (let i = 0; i < recent.form.length && filings.length < MAX_FILINGS_PER_TICKER; i++) {
    if (recent.form[i] === "4") filings.push({ accession: recent.accessionNumber[i] });
  }
  return filings;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown): number {
  const n = typeof v === "object" && v !== null ? (v as { value?: unknown }).value : v;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(v: unknown): string {
  if (typeof v === "object" && v !== null) return String((v as { value?: unknown }).value ?? "");
  return String(v ?? "");
}

async function fetchForm4Transactions(cik: number, ticker: string, accession: string): Promise<InsiderTransaction[]> {
  const accNoDash = accession.replace(/-/g, "");
  const primaryUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDash}/form4.xml`;
  const res = await fetch(primaryUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const xml = await res.text();
  if (!xml.trim().startsWith("<?xml")) return [];

  const doc = xmlParser.parse(xml);
  const root = doc.ownershipDocument;
  if (!root) return [];

  const owner = root.reportingOwner;
  const ownerName = str(owner?.reportingOwnerId?.rptOwnerName ?? "Unknown");
  const rel = owner?.reportingOwnerRelationship ?? {};
  const isOfficer = str(rel.isOfficer) === "true" || str(rel.isOfficer) === "1";
  const isDirector = str(rel.isDirector) === "true" || str(rel.isDirector) === "1";
  const officerTitle = rel.officerTitle ? str(rel.officerTitle) : null;

  const filingUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDash}/${accession}-index.htm`;

  const nonDeriv = toArray(root.nonDerivativeTable?.nonDerivativeTransaction);
  const deriv = toArray(root.derivativeTable?.derivativeTransaction);

  const transactions: InsiderTransaction[] = [];
  for (const t of [...nonDeriv, ...deriv]) {
    const code = str(t.transactionCoding?.transactionCode);
    if (!code) continue;
    transactions.push({
      ticker,
      ownerName,
      isOfficer,
      isDirector,
      officerTitle,
      transactionDate: str(t.transactionDate).slice(0, 10),
      transactionCode: code,
      transactionCodeLabel: TRANSACTION_CODE_LABELS[code] ?? code,
      shares: num(t.transactionAmounts?.transactionShares),
      pricePerShare: t.transactionAmounts?.transactionPricePerShare ? num(t.transactionAmounts.transactionPricePerShare) : null,
      acquiredDisposed: (str(t.transactionAmounts?.transactionAcquiredDisposedCode) as "A" | "D") || "A",
      sharesOwnedAfter: num(t.postTransactionAmounts?.sharesOwnedFollowingTransaction),
      filingUrl,
    });
  }
  return transactions;
}

async function loadTickerTransactions(ticker: string, cik: number): Promise<InsiderTransaction[]> {
  try {
    const filings = await fetchRecentForm4Filings(cik);
    const perFiling = await Promise.all(
      filings.map((f) => fetchForm4Transactions(cik, ticker, f.accession).catch(() => []))
    );
    return perFiling.flat();
  } catch (err) {
    console.warn(`[ownership] Skipping ${ticker}:`, (err as Error).message);
    return [];
  }
}

async function loadSnapshot(tickers: string[]): Promise<OwnershipSnapshot> {
  const cikMap = await loadTickerCikMap();
  const perTicker = await Promise.all(
    tickers.map(async (ticker) => {
      const entry = cikMap[ticker];
      if (!entry) return [];
      return loadTickerTransactions(ticker, entry.cik);
    })
  );
  const transactions = perTicker
    .flat()
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  return {
    asOf: new Date().toISOString(),
    tickers,
    transactions,
    sourceLabel: "SEC EDGAR — Form 4 (Section 16 insider transactions)",
    sourceUrl: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany",
  };
}

export async function getOwnershipSnapshot(tickers: string[]): Promise<OwnershipSnapshot> {
  return snapshotCache.getOrLoad(tickers.join(","), () => loadSnapshot(tickers));
}
