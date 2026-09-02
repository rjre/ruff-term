import type { CftcPositioningLine, CftcPositioningSnapshot } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";

/**
 * Weekly speculative (non-commercial) net positioning in key financial and
 * commodity futures, from the CFTC's own free Socrata Open Data API — the
 * "Legacy - Futures Only" Commitments of Traders report, published every
 * Friday for the prior Tuesday's data. No API key required.
 */
const CFTC_API = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

const CONTRACTS: Array<{ label: string; code: string }> = [
  { label: "E-mini S&P 500", code: "13874A" },
  { label: "UST 2Y Note", code: "042601" },
  { label: "UST 5Y Note", code: "044601" },
  { label: "UST 10Y Note", code: "043602" },
  { label: "Euro FX", code: "099741" },
  { label: "British Pound", code: "096742" },
  { label: "Japanese Yen", code: "097741" },
  { label: "Gold", code: "088691" },
  { label: "WTI Crude Oil", code: "067411" },
  { label: "VIX Futures", code: "1170E1" },
];

const cache = new TtlCache<CftcPositioningSnapshot>(6 * 60 * 60_000);

interface CftcRow {
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
}

async function fetchContractHistory(code: string): Promise<CftcRow[]> {
  const url = `${CFTC_API}?cftc_contract_market_code=${encodeURIComponent(
    code
  )}&$order=report_date_as_yyyy_mm_dd DESC&$limit=2`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CFTC request failed: ${res.status}`);
  return (await res.json()) as CftcRow[];
}

async function loadLine(contract: { label: string; code: string }): Promise<CftcPositioningLine | null> {
  try {
    const rows = await fetchContractHistory(contract.code);
    if (rows.length === 0) return null;
    const latest = rows[0];
    const prev = rows[1] ?? null;

    const long = Number(latest.noncomm_positions_long_all);
    const short = Number(latest.noncomm_positions_short_all);
    const net = long - short;

    let netChange1w = 0;
    if (prev) {
      const prevLong = Number(prev.noncomm_positions_long_all);
      const prevShort = Number(prev.noncomm_positions_short_all);
      netChange1w = net - (prevLong - prevShort);
    }

    return {
      label: contract.label,
      contractMarketCode: contract.code,
      reportDate: latest.report_date_as_yyyy_mm_dd.slice(0, 10),
      openInterest: Number(latest.open_interest_all),
      noncommLong: long,
      noncommShort: short,
      netNoncommPosition: net,
      netNoncommChange1w: netChange1w,
    };
  } catch (err) {
    console.warn(`[cftcPositioning] Skipping ${contract.label}:`, (err as Error).message);
    return null;
  }
}

async function loadSnapshot(): Promise<CftcPositioningSnapshot> {
  const lines = (await Promise.all(CONTRACTS.map(loadLine))).filter(
    (l): l is CftcPositioningLine => l !== null
  );
  return {
    asOf: new Date().toISOString(),
    lines,
    sourceLabel: "CFTC — Commitments of Traders, Legacy Futures Only report (weekly)",
    sourceUrl: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
  };
}

export async function getCftcPositioning(): Promise<CftcPositioningSnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
