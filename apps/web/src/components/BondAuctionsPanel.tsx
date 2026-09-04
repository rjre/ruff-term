import { useEffect, useState } from "react";
import type { TreasuryAuctionsSnapshot } from "@ruff-term/shared";
import { fetchTreasuryAuctions } from "../api/client";
import { downloadCsv } from "../lib/exportCsv";
import { SourceFooter } from "./SourceFooter";

export function BondAuctionsPanel() {
  const [snapshot, setSnapshot] = useState<
    TreasuryAuctionsSnapshot | "error" | null
  >(null);

  useEffect(() => {
    fetchTreasuryAuctions()
      .then(setSnapshot)
      .catch(() => setSnapshot("error"));
  }, []);

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Bond Auctions</div>
          <div className="module-banner-sub">
            Upcoming US Treasury bill/note/bond auctions, live via
            TreasuryDirect.
          </div>
        </div>
      </div>

      {snapshot === null ? (
        <div className="empty-state">Loading upcoming auctions…</div>
      ) : snapshot === "error" ? (
        <div className="empty-state">TreasuryDirect fetch failed.</div>
      ) : (
        <>
          <div className="screener-toolbar">
            <button
              className="icon-btn"
              onClick={() =>
                downloadCsv("bond-auctions", [
                  [
                    "Security",
                    "Term",
                    "CUSIP",
                    "Announced",
                    "Auction date",
                    "Issue date",
                  ],
                  ...snapshot.auctions.map((a) => [
                    a.securityType,
                    a.securityTerm,
                    a.cusip,
                    a.announcementDate,
                    a.auctionDate,
                    a.issueDate,
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          </div>
          <table className="watchlist-table">
            <thead>
              <tr>
                <th>Security</th>
                <th>Term</th>
                <th>CUSIP</th>
                <th>Announced</th>
                <th>Auction date</th>
                <th>Issue date</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.auctions.map((a) => (
                <tr key={a.cusip}>
                  <td className="short-name-cell">{a.securityType}</td>
                  <td className="ticker-cell">{a.securityTerm}</td>
                  <td className="num-cell" style={{ textAlign: "left" }}>
                    {a.cusip}
                  </td>
                  <td>{a.announcementDate}</td>
                  <td style={{ fontWeight: 700 }}>{a.auctionDate}</td>
                  <td>{a.issueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="note-banner">
        UK DMO gilt auctions: no scrapable free feed found for this environment
        — see the{" "}
        <a
          href="https://www.dmo.gov.uk/data/gilt-market/"
          target="_blank"
          rel="noreferrer"
        >
          DMO's own gilt market data pages
        </a>{" "}
        directly.
      </div>

      <SourceFooter
        sources={[
          snapshot && snapshot !== "error"
            ? { label: snapshot.sourceLabel, url: snapshot.sourceUrl }
            : "TreasuryDirect (live, official, keyless)",
        ]}
      />
    </div>
  );
}
