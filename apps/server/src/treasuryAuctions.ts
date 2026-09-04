import type { TreasuryAuctionLine, TreasuryAuctionsSnapshot } from "@ruff-term/shared";
import { LiveCache } from "./cache.js";

/**
 * Upcoming US Treasury auctions — TreasuryDirect's own free, keyless public
 * API. No equivalent scrapable feed was found for UK DMO gilt auctions
 * (their site's auction calendar isn't exposed as static HTML or an obvious
 * JSON/CSV endpoint), so that half is a link out rather than live data.
 */
const UPCOMING_URL = "https://www.treasurydirect.gov/TA_WS/securities/upcoming?format=json";

// Fetched only on mount (tab visit or the header's Refresh button, which
// fully remounts the active view), never polled — a TTL cache here would
// just make Refresh look like it does nothing.
const cache = new LiveCache<TreasuryAuctionsSnapshot>();

interface RawAuction {
  securityType: string;
  securityTerm: string;
  cusip: string;
  announcementDate: string;
  auctionDate: string;
  issueDate: string;
}

async function loadSnapshot(): Promise<TreasuryAuctionsSnapshot> {
  const res = await fetch(UPCOMING_URL, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
  if (!res.ok) throw new Error(`TreasuryDirect request failed: ${res.status}`);
  const raw = (await res.json()) as RawAuction[];

  const auctions: TreasuryAuctionLine[] = raw
    .map((r) => ({
      securityType: r.securityType,
      securityTerm: r.securityTerm,
      cusip: r.cusip,
      announcementDate: r.announcementDate.slice(0, 10),
      auctionDate: r.auctionDate.slice(0, 10),
      issueDate: r.issueDate.slice(0, 10),
    }))
    .sort((a, b) => a.auctionDate.localeCompare(b.auctionDate));

  return { asOf: new Date().toISOString(), auctions };
}

export async function getTreasuryAuctions(): Promise<TreasuryAuctionsSnapshot> {
  return cache.get("snapshot", loadSnapshot);
}
