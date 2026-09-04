import { useEffect, useMemo, useState } from "react";
import type { CentralBankMeeting, CentralBankMeetingsSnapshot } from "@ruff-term/shared";
import { fetchCentralBankMeetings } from "../api/client";

const BANK_ORDER: CentralBankMeeting["code"][] = ["FED", "ECB", "BOE", "BOJ"];
const BANK_CLASS: Record<CentralBankMeeting["code"], string> = {
  FED: "cb-fed",
  ECB: "cb-ecb",
  BOE: "cb-boe",
  BOJ: "cb-boj",
};
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + "T00:00:00Z").getTime();
  const to = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Mon-first grid: null cells pad the leading/trailing partial weeks. */
function buildMonthGrid(year: number, month: number): Array<string | null> {
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array(firstWeekday).fill(null);
  for (let d = 1; d <= totalDays; d++) cells.push(isoOf(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function expandByDay(meetings: CentralBankMeeting[]): Map<string, CentralBankMeeting[]> {
  const map = new Map<string, CentralBankMeeting[]>();
  for (const m of meetings) {
    let cursor = new Date(m.startDate + "T00:00:00Z");
    const end = new Date(m.endDate + "T00:00:00Z");
    while (cursor.getTime() <= end.getTime()) {
      const iso = cursor.toISOString().slice(0, 10);
      const existing = map.get(iso);
      if (existing) existing.push(m);
      else map.set(iso, [m]);
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
  }
  return map;
}

function formatRange(m: CentralBankMeeting): string {
  const start = new Date(m.startDate + "T00:00:00Z");
  const end = new Date(m.endDate + "T00:00:00Z");
  const startLabel = start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (m.startDate === m.endDate) return startLabel;
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const endLabel = end.toLocaleDateString(
    "en-GB",
    sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" },
  );
  return `${startLabel}–${endLabel}`;
}

function nextMeetingFor(
  code: CentralBankMeeting["code"],
  meetings: CentralBankMeeting[],
  today: string,
): CentralBankMeeting | null {
  const upcoming = meetings
    .filter((m) => m.code === code && m.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return upcoming[0] ?? null;
}

function countdownLabel(m: CentralBankMeeting, today: string): string {
  if (m.startDate <= today && today <= m.endDate) return "In progress";
  const days = daysBetween(today, m.startDate);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function CentralBankMeetingsPanel() {
  const [snapshot, setSnapshot] = useState<CentralBankMeetingsSnapshot | null>(null);
  const today = todayIso();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });

  useEffect(() => {
    fetchCentralBankMeetings()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  // Memoized, not a bare `?? []`: a fresh array literal each render would
  // invalidate expandByDay's useMemo on every render.
  const meetings = useMemo(() => snapshot?.meetings ?? [], [snapshot]);
  const byDay = useMemo(() => expandByDay(meetings), [meetings]);
  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      const year = c.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Central Bank Meetings</div>
          <div className="module-banner-sub">
            Interest-rate decision dates for the Fed, ECB, Bank of England and
            Bank of Japan — 2026 schedule.
          </div>
        </div>
      </div>

      {!snapshot ? (
        <div className="empty-state">Loading meeting schedule…</div>
      ) : (
        <>
          <div className="cb-summary-row">
            {BANK_ORDER.map((code) => {
              const next = nextMeetingFor(code, meetings, today);
              const label = meetings.find((m) => m.code === code)?.bank ?? code;
              return (
                <div key={code} className={`cb-summary-card ${BANK_CLASS[code]}`}>
                  <div className="cb-summary-code">{code}</div>
                  <div className="cb-summary-bank">{label}</div>
                  {next ? (
                    <>
                      <div className="cb-summary-date">{formatRange(next)}</div>
                      <div className="cb-summary-countdown">{countdownLabel(next, today)}</div>
                    </>
                  ) : (
                    <div className="cb-summary-date">No date scheduled</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="cb-month-nav">
            <button className="toggle-btn" onClick={() => shiftMonth(-1)}>
              ← Prev
            </button>
            <div className="cb-month-label">
              {MONTH_LABELS[cursor.month]} {cursor.year}
            </div>
            <button className="toggle-btn" onClick={() => shiftMonth(1)}>
              Next →
            </button>
            <button
              className="toggle-btn"
              onClick={() => {
                const now = new Date();
                setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
              }}
            >
              Today
            </button>
          </div>

          <div className="cb-grid">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="cb-weekday">
                {w}
              </div>
            ))}
            {grid.map((iso, i) => {
              if (!iso) return <div key={i} className="cb-day cb-day-outside" />;
              const dayMeetings = byDay.get(iso) ?? [];
              const dayNum = Number(iso.slice(8, 10));
              return (
                <div key={iso} className={`cb-day${iso === today ? " cb-day-today" : ""}`}>
                  <div className="cb-day-number">{dayNum}</div>
                  <div className="cb-day-chips">
                    {dayMeetings.map((m) => (
                      <div
                        key={m.code}
                        className={`cb-chip ${BANK_CLASS[m.code]}`}
                        title={`${m.bank} ${m.committee}, ${formatRange(m)}${m.hasProjections ? " (with SEP)" : ""}`}
                      >
                        {m.code}
                        {m.hasProjections ? " •" : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cb-legend">
            {BANK_ORDER.map((code) => {
              const label = meetings.find((m) => m.code === code)?.bank ?? code;
              return (
                <div key={code} className="cb-legend-item">
                  <span className={`cb-legend-swatch ${BANK_CLASS[code]}`} />
                  {code} — {label}
                </div>
              );
            })}
            <div className="cb-legend-item">
              <span className="cb-legend-dot">•</span> = meeting includes Summary of Economic Projections (Fed)
            </div>
          </div>

          <div className="source-footer">
            Sources:{" "}
            {snapshot.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 ? " · " : ""}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </span>
            ))}
            . Manually curated from each bank's published 2026 calendar — not
            a live feed; verify against the source before relying on it.
          </div>
        </>
      )}
    </div>
  );
}
