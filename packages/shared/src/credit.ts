/**
 * Citi Velocity's CREDIT tag taxonomy, discovered by walking the live
 * `/tagbrowsing` tree (see credit.ts on the server for the fetch/cache
 * logic) rather than guessed: CREDIT.CDX and CREDIT.ITRAXX both bottom out at
 * `<index>.OTR.<tenor>.<field>`, and CREDIT.SOV_CDS at
 * `<country>.<ccy>.SNRFOR.CR.<tenor>.BLENDED`. OTR ("on the run") is Citi's
 * roll-adjusted continuous series identifier — the one that carries a
 * multi-year history rather than resetting every time the index rolls to a
 * new series number.
 */

export type CreditRegion = "US" | "EU";

export interface CreditIndexDef {
  key: string;
  label: string;
  region: CreditRegion;
  tenor: string;
  tag: string;
}

function cdsIndexTag(prefix: string, tenor: string, field = "COMPOSITE_SPREAD"): string {
  return `${prefix}.OTR.${tenor}.${field}`;
}

function sovereignTag(code: string, ccy: string, tenor: string): string {
  return `CREDIT.SOV_CDS.${code}.${ccy}.SNRFOR.CR.${tenor}.BLENDED`;
}

const CDX_NA_IG_PREFIX = "CREDIT.CDX.CDS_IDX_GRP_IG.CDS_INDEX_NAIG";
const CDX_NA_HY_PREFIX = "CREDIT.CDX.CDS_IDX_GRP_HY.CDS_INDEX_NAHY";
const ITRAXX_MAIN_PREFIX = "CREDIT.ITRAXX.CDS_IDX_GRP_EUROPE.CDS_INDEX_EUROPE";
const ITRAXX_XOVER_PREFIX = "CREDIT.ITRAXX.CDS_IDX_GRP_EUROPE.CDS_INDEX_XOVER";
const ITRAXX_SENFIN_PREFIX = "CREDIT.ITRAXX.CDS_IDX_GRP_EUROPE.CDS_INDEX_FINSEN";
const ITRAXX_SUBFIN_PREFIX = "CREDIT.ITRAXX.CDS_IDX_GRP_EUROPE.CDS_INDEX_FINSUB";

/** Headline CDS index board — the standard 5Y benchmark tenor per index. */
export const CDS_INDICES: CreditIndexDef[] = [
  { key: "CDX_NA_IG", label: "CDX.NA.IG", region: "US", tenor: "5Y", tag: cdsIndexTag(CDX_NA_IG_PREFIX, "5Y") },
  { key: "CDX_NA_HY", label: "CDX.NA.HY", region: "US", tenor: "5Y", tag: cdsIndexTag(CDX_NA_HY_PREFIX, "5Y") },
  { key: "ITRAXX_MAIN", label: "iTraxx Europe Main", region: "EU", tenor: "5Y", tag: cdsIndexTag(ITRAXX_MAIN_PREFIX, "5Y") },
  { key: "ITRAXX_XOVER", label: "iTraxx Crossover", region: "EU", tenor: "5Y", tag: cdsIndexTag(ITRAXX_XOVER_PREFIX, "5Y") },
  { key: "ITRAXX_SENFIN", label: "iTraxx Senior Financials", region: "EU", tenor: "5Y", tag: cdsIndexTag(ITRAXX_SENFIN_PREFIX, "5Y") },
  { key: "ITRAXX_SUBFIN", label: "iTraxx Sub Financials", region: "EU", tenor: "5Y", tag: cdsIndexTag(ITRAXX_SUBFIN_PREFIX, "5Y") },
];

/** 5Y sovereign CDS board, Europe + US. */
const SOVEREIGN_DEFS: Array<{ key: string; label: string; region: CreditRegion; code: string; ccy: string }> = [
  { key: "SOV_US", label: "United States", region: "US", code: "USGB", ccy: "USD" },
  // GBP-denominated UK sovereign CDS carries no quotes on Citi's feed —
  // confirmed against the live API — but USD does, which is also the more
  // standard sovereign CDS quoting currency internationally.
  { key: "SOV_UK", label: "United Kingdom", region: "EU", code: "UKIN", ccy: "USD" },
  { key: "SOV_DE", label: "Germany", region: "EU", code: "DBR", ccy: "EUR" },
  { key: "SOV_FR", label: "France", region: "EU", code: "FRTR", ccy: "EUR" },
  { key: "SOV_IT", label: "Italy", region: "EU", code: "ITALY", ccy: "EUR" },
  { key: "SOV_ES", label: "Spain", region: "EU", code: "SPAIN", ccy: "EUR" },
  { key: "SOV_GR", label: "Greece", region: "EU", code: "GREECE", ccy: "EUR" },
  { key: "SOV_IE", label: "Ireland", region: "EU", code: "IRELND", ccy: "EUR" },
  { key: "SOV_NL", label: "Netherlands", region: "EU", code: "NETHRS", ccy: "EUR" },
];

export const SOVEREIGN_INDICES: CreditIndexDef[] = SOVEREIGN_DEFS.map((s) => ({
  key: s.key,
  label: s.label,
  region: s.region,
  tenor: "5Y",
  tag: sovereignTag(s.code, s.ccy, "5Y"),
}));

export interface CreditCurveDef {
  key: string;
  label: string;
  region: CreditRegion;
  points: Array<{ tenor: string; tag: string }>;
}

/** Citi quotes iTraxx at these five tenors; CDX additionally has 2Y. */
const INDEX_CURVE_TENORS = ["1Y", "3Y", "5Y", "7Y", "10Y"];
const SOVEREIGN_CURVE_TENORS = ["6M", "1Y", "2Y", "3Y", "5Y", "7Y", "10Y", "15Y", "20Y", "30Y"];

export const CREDIT_CURVES: CreditCurveDef[] = [
  {
    key: "CDX_NA_IG_CURVE",
    label: "CDX.NA.IG term structure",
    region: "US",
    points: [...INDEX_CURVE_TENORS.slice(0, 1), "2Y", ...INDEX_CURVE_TENORS.slice(1)].map((tenor) => ({
      tenor,
      tag: cdsIndexTag(CDX_NA_IG_PREFIX, tenor),
    })),
  },
  {
    key: "ITRAXX_MAIN_CURVE",
    label: "iTraxx Europe Main term structure",
    region: "EU",
    points: INDEX_CURVE_TENORS.map((tenor) => ({ tenor, tag: cdsIndexTag(ITRAXX_MAIN_PREFIX, tenor) })),
  },
  {
    key: "SOV_DE_CURVE",
    label: "Germany sovereign CDS curve",
    region: "EU",
    points: SOVEREIGN_CURVE_TENORS.map((tenor) => ({ tenor, tag: sovereignTag("DBR", "EUR", tenor) })),
  },
  {
    key: "SOV_IT_CURVE",
    label: "Italy sovereign CDS curve",
    region: "EU",
    points: SOVEREIGN_CURVE_TENORS.map((tenor) => ({ tenor, tag: sovereignTag("ITALY", "EUR", tenor) })),
  },
];

/** Every distinct tag the historic panel needs, for one /data batch call. */
export const CREDIT_HISTORIC_TAGS: string[] = Array.from(
  new Set([
    ...CDS_INDICES.map((i) => i.tag),
    ...SOVEREIGN_INDICES.map((i) => i.tag),
    ...CREDIT_CURVES.flatMap((c) => c.points.map((p) => p.tag)),
  ]),
);

/**
 * The instruments streamed live for the Intraday tab.
 *
 * Confirmed against the live streaming API: `COMPOSITE_SPREAD` (Markit's
 * blended figure, used for the historic panel) has no intraday feed — Citi
 * rejects the subscription outright with "No intraday data for this tag".
 * `CITI_SPREAD`, Citi's own book, does stream. Sovereign CDS has no
 * equivalent alternative field (`BLENDED` is its only source), and it too
 * rejects a live subscription — so sovereigns are historic-only.
 */
export const CREDIT_STREAM_INSTRUMENTS: CreditIndexDef[] = [
  { key: "CDX_NA_IG", label: "CDX.NA.IG", region: "US", tenor: "5Y", tag: cdsIndexTag(CDX_NA_IG_PREFIX, "5Y", "CITI_SPREAD") },
  { key: "CDX_NA_HY", label: "CDX.NA.HY", region: "US", tenor: "5Y", tag: cdsIndexTag(CDX_NA_HY_PREFIX, "5Y", "CITI_SPREAD") },
  { key: "ITRAXX_MAIN", label: "iTraxx Europe Main", region: "EU", tenor: "5Y", tag: cdsIndexTag(ITRAXX_MAIN_PREFIX, "5Y", "CITI_SPREAD") },
  { key: "ITRAXX_XOVER", label: "iTraxx Crossover", region: "EU", tenor: "5Y", tag: cdsIndexTag(ITRAXX_XOVER_PREFIX, "5Y", "CITI_SPREAD") },
  { key: "ITRAXX_SENFIN", label: "iTraxx Senior Financials", region: "EU", tenor: "5Y", tag: cdsIndexTag(ITRAXX_SENFIN_PREFIX, "5Y", "CITI_SPREAD") },
  { key: "ITRAXX_SUBFIN", label: "iTraxx Sub Financials", region: "EU", tenor: "5Y", tag: cdsIndexTag(ITRAXX_SUBFIN_PREFIX, "5Y", "CITI_SPREAD") },
];

export const CREDIT_STREAM_TAGS: string[] = CREDIT_STREAM_INSTRUMENTS.map((i) => i.tag);

export interface CreditSeriesPoint {
  date: string;
  value: number;
}

export interface CreditSeriesResult {
  key: string;
  label: string;
  region: CreditRegion;
  tenor: string;
  tag: string;
  latest: number | null;
  latestDate: string | null;
  series: CreditSeriesPoint[];
}

export interface CreditCurvePointResult {
  tenor: string;
  value: number | null;
}

export interface CreditCurveResult {
  key: string;
  label: string;
  region: CreditRegion;
  asOfDate: string | null;
  points: CreditCurvePointResult[];
}

export interface CreditHistoricSnapshot {
  asOfDate: string | null;
  lookbackYears: number;
  indices: CreditSeriesResult[];
  sovereigns: CreditSeriesResult[];
  curves: CreditCurveResult[];
  note: string | null;
  callsSpent: number;
}
