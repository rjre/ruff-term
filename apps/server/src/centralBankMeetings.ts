import type {
  CentralBankMeeting,
  CentralBankMeetingsSnapshot,
  CentralBankMeetingsSource,
} from "@ruff-term/shared";

/**
 * None of these four central banks publish a machine-readable meeting
 * calendar, so this is a manually curated schedule transcribed from each
 * bank's own published 2026 dates (see SOURCES below). It's a static
 * snapshot, not a live feed — central banks do occasionally amend dates
 * (e.g. around holidays or emergency meetings), so cross-check the source
 * link before relying on it for anything time-sensitive.
 */
const MEETINGS: CentralBankMeeting[] = [
  // Federal Reserve — FOMC. Mar/Jun/Sep/Dec meetings also carry the Summary
  // of Economic Projections and a post-meeting press conference.
  { bank: "Federal Reserve", code: "FED", committee: "FOMC", startDate: "2026-01-27", endDate: "2026-01-28" },
  { bank: "Federal Reserve", code: "FED", committee: "FOMC", startDate: "2026-03-17", endDate: "2026-03-18", hasProjections: true },
  { bank: "Federal Reserve", code: "FED", committee: "FOMC", startDate: "2026-04-28", endDate: "2026-04-29" },
  { bank: "Federal Reserve", code: "FED", committee: "FOMC", startDate: "2026-06-16", endDate: "2026-06-17", hasProjections: true },
  { bank: "Federal Reserve", code: "FED", committee: "FOMC", startDate: "2026-07-28", endDate: "2026-07-29" },
  { bank: "Federal Reserve", code: "FED", committee: "FOMC", startDate: "2026-09-15", endDate: "2026-09-16", hasProjections: true },
  { bank: "Federal Reserve", code: "FED", committee: "FOMC", startDate: "2026-10-27", endDate: "2026-10-28" },
  { bank: "Federal Reserve", code: "FED", committee: "FOMC", startDate: "2026-12-08", endDate: "2026-12-09", hasProjections: true },

  // European Central Bank — Governing Council monetary policy meetings.
  { bank: "European Central Bank", code: "ECB", committee: "Governing Council", startDate: "2026-02-05", endDate: "2026-02-05" },
  { bank: "European Central Bank", code: "ECB", committee: "Governing Council", startDate: "2026-03-19", endDate: "2026-03-19" },
  { bank: "European Central Bank", code: "ECB", committee: "Governing Council", startDate: "2026-04-30", endDate: "2026-04-30" },
  { bank: "European Central Bank", code: "ECB", committee: "Governing Council", startDate: "2026-06-11", endDate: "2026-06-11" },
  { bank: "European Central Bank", code: "ECB", committee: "Governing Council", startDate: "2026-07-23", endDate: "2026-07-23" },
  { bank: "European Central Bank", code: "ECB", committee: "Governing Council", startDate: "2026-09-09", endDate: "2026-09-10" },
  { bank: "European Central Bank", code: "ECB", committee: "Governing Council", startDate: "2026-10-28", endDate: "2026-10-29" },
  { bank: "European Central Bank", code: "ECB", committee: "Governing Council", startDate: "2026-12-16", endDate: "2026-12-17" },

  // Bank of England — MPC. Decision, minutes and (quarterly) Monetary
  // Policy Report all publish together at noon on the date shown.
  { bank: "Bank of England", code: "BOE", committee: "MPC", startDate: "2026-02-05", endDate: "2026-02-05" },
  { bank: "Bank of England", code: "BOE", committee: "MPC", startDate: "2026-03-19", endDate: "2026-03-19" },
  { bank: "Bank of England", code: "BOE", committee: "MPC", startDate: "2026-04-30", endDate: "2026-04-30" },
  { bank: "Bank of England", code: "BOE", committee: "MPC", startDate: "2026-06-18", endDate: "2026-06-18" },
  { bank: "Bank of England", code: "BOE", committee: "MPC", startDate: "2026-07-30", endDate: "2026-07-30" },
  { bank: "Bank of England", code: "BOE", committee: "MPC", startDate: "2026-09-17", endDate: "2026-09-17" },
  { bank: "Bank of England", code: "BOE", committee: "MPC", startDate: "2026-11-05", endDate: "2026-11-05" },
  { bank: "Bank of England", code: "BOE", committee: "MPC", startDate: "2026-12-17", endDate: "2026-12-17" },

  // Bank of Japan — Monetary Policy Meeting.
  { bank: "Bank of Japan", code: "BOJ", committee: "MPM", startDate: "2026-01-22", endDate: "2026-01-23" },
  { bank: "Bank of Japan", code: "BOJ", committee: "MPM", startDate: "2026-03-18", endDate: "2026-03-19" },
  { bank: "Bank of Japan", code: "BOJ", committee: "MPM", startDate: "2026-04-27", endDate: "2026-04-28" },
  { bank: "Bank of Japan", code: "BOJ", committee: "MPM", startDate: "2026-06-15", endDate: "2026-06-16" },
  { bank: "Bank of Japan", code: "BOJ", committee: "MPM", startDate: "2026-07-30", endDate: "2026-07-31" },
  { bank: "Bank of Japan", code: "BOJ", committee: "MPM", startDate: "2026-09-17", endDate: "2026-09-18" },
  { bank: "Bank of Japan", code: "BOJ", committee: "MPM", startDate: "2026-10-29", endDate: "2026-10-30" },
  { bank: "Bank of Japan", code: "BOJ", committee: "MPM", startDate: "2026-12-17", endDate: "2026-12-18" },
];

const SOURCES: CentralBankMeetingsSource[] = [
  {
    bank: "Federal Reserve",
    label: "federalreserve.gov — FOMC meeting calendars",
    url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
  },
  {
    bank: "European Central Bank",
    label: "ecb.europa.eu — Governing Council meeting calendar",
    url: "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html",
  },
  {
    bank: "Bank of England",
    label: "bankofengland.co.uk — Upcoming MPC dates",
    url: "https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates",
  },
  {
    bank: "Bank of Japan",
    label: "boj.or.jp — Monetary Policy Meetings schedule",
    url: "https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm",
  },
];

export function getCentralBankMeetings(): CentralBankMeetingsSnapshot {
  return {
    asOf: new Date().toISOString(),
    meetings: [...MEETINGS].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    sources: SOURCES,
  };
}
