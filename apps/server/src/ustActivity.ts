import type { TreasuryEtfLine, UstActivitySnapshot, UstVolumeLine } from "@ruff-term/shared";
import { TtlCache } from "./cache.js";
import * as yahoo from "./yahoo/client.js";

/** Real, live proxies for UST trading activity: the major Treasury ETFs by
 * maturity bucket. FINRA's own TRACE Treasury aggregate statistics (trade
 * counts, par value by security subtype/maturity) require an account and
 * API key (see ustActivity's demo section below), so this is the free,
 * keyless stand-in for "is anything happening in Treasuries today". */
const TREASURY_ETFS: Array<{ ticker: string; label: string }> = [
  { ticker: "SHV", label: "0-1yr Bills (SHV)" },
  { ticker: "SHY", label: "1-3yr (SHY)" },
  { ticker: "IEI", label: "3-7yr (IEI)" },
  { ticker: "IEF", label: "7-10yr (IEF)" },
  { ticker: "TLT", label: "20yr+ (TLT)" },
  { ticker: "TIP", label: "TIPS (TIP)" },
];

/** Illustrative only — approximate shape of FINRA's published UST secondary
 * market composition, not a live figure. Real numbers require a FINRA API
 * key (see about-treasury). Regenerated with a small daily wobble so it
 * doesn't look frozen, but it is demo data end to end. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function wobble(base: number, rand: () => number, spread: number): number {
  return Math.round(base * (1 + (rand() - 0.5) * spread) * 10) / 10;
}

function demoVolumes(daySeed: string): { bySubtype: UstVolumeLine[]; byMaturity: UstVolumeLine[] } {
  const rand = seededRandom(`ust-${daySeed}`);
  return {
    bySubtype: [
      { label: "Nominal coupons", parValueBn: wobble(620, rand, 0.15) },
      { label: "Bills", parValueBn: wobble(210, rand, 0.2) },
      { label: "TIPS", parValueBn: wobble(45, rand, 0.25) },
      { label: "FRNs", parValueBn: wobble(18, rand, 0.3) },
    ],
    byMaturity: [
      { label: "≤ 2yr", parValueBn: wobble(280, rand, 0.15) },
      { label: ">2-3yr", parValueBn: wobble(150, rand, 0.15) },
      { label: ">3-5yr", parValueBn: wobble(160, rand, 0.15) },
      { label: ">5-7yr", parValueBn: wobble(110, rand, 0.2) },
      { label: ">7-10yr", parValueBn: wobble(120, rand, 0.2) },
      { label: ">10yr", parValueBn: wobble(75, rand, 0.25) },
    ],
  };
}

const cache = new TtlCache<UstActivitySnapshot>(60_000);

async function loadSnapshot(): Promise<UstActivitySnapshot> {
  const etfResults = await Promise.all(
    TREASURY_ETFS.map(async (t): Promise<TreasuryEtfLine | null> => {
      try {
        const { meta, bars } = await yahoo.fetchChart(t.ticker, "5d");
        if (bars.length < 2) return null;
        const latest = bars[bars.length - 1];
        const prev = bars[bars.length - 2];
        const lastPrice = meta.regularMarketPrice ?? latest.close;
        return {
          ticker: t.ticker,
          label: t.label,
          lastPrice,
          changePct1d: Math.round(((lastPrice - prev.close) / prev.close) * 10000) / 100,
          volume: latest.volume,
          currency: meta.currency,
          updatedAt: new Date(meta.regularMarketTime * 1000).toISOString(),
        };
      } catch (err) {
        console.warn(`[ustActivity] Skipping ${t.ticker}:`, (err as Error).message);
        return null;
      }
    })
  );

  const daySeed = new Date().toISOString().slice(0, 10);
  const { bySubtype, byMaturity } = demoVolumes(daySeed);

  return {
    asOf: new Date().toISOString(),
    etfs: etfResults.filter((e): e is TreasuryEtfLine => e !== null),
    demoVolumeBySubtype: bySubtype,
    demoVolumeByMaturity: byMaturity,
    sourceLabel: "FINRA — About Treasury (TRACE) data",
    sourceUrl: "https://www.finra.org/finra-data/browse-catalog/about-treasury",
  };
}

export async function getUstActivity(): Promise<UstActivitySnapshot> {
  return cache.getOrLoad("snapshot", loadSnapshot);
}
