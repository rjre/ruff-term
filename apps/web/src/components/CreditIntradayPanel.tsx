import { useEffect, useState } from "react";
import type { CreditHistoricSnapshot, CreditSeriesResult } from "@ruff-term/shared";
import { CREDIT_STREAM_INSTRUMENTS } from "@ruff-term/shared";
import { fetchCreditHistoric } from "../api/client";
import { STATUS_LABEL, useCitiStream } from "../lib/citiStream";
import { formatSigned } from "../lib/format";
import { PriceStamp } from "./PriceStamp";
import { SourceFooter } from "./SourceFooter";

function formatBp(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} bp`;
}

function creditChangeClass(value: number | null): string {
  if (value === null || value === 0) return "pct-flat";
  return value > 0 ? "pct-down" : "pct-up";
}

function DayOverDayRow({ instrument }: { instrument: CreditSeriesResult }) {
  const points = instrument.series;
  const prev = points.length >= 2 ? points[points.length - 2] : null;
  const change = prev && instrument.latest !== null ? instrument.latest - prev.value : null;
  return (
    <tr>
      <td className="ticker-cell">{instrument.label}</td>
      <td className="num-cell">{formatBp(prev?.value ?? null)}</td>
      <td className="num-cell">{formatBp(instrument.latest)}</td>
      <td className={`num-cell ${creditChangeClass(change)}`}>
        {change === null ? "—" : `${formatSigned(change, 1)} bp`}
      </td>
      <td>
        <PriceStamp at={instrument.latestDate} prefix="As of" />
      </td>
    </tr>
  );
}

/**
 * Citi Velocity's Credit content is end-of-day only.
 *
 * Confirmed against the live API, not assumed: the streaming websocket
 * rejects every CDS index and sovereign CDS tag tested — both the Markit
 * composite field the historic tab uses and Citi's own book price — with an
 * explicit "No intraday data for this tag", and the Historical Data endpoint
 * silently serves MINUTE/INTRADAY/HOURLY frequency requests as daily closes.
 * FX is the only Citi content on this account with a live tick feed.
 *
 * Rather than a dead page, this shows the one genuinely intraday-adjacent
 * thing the data supports — the latest close against the prior one — and
 * keeps a real (if permanently empty) subscription attempt running so the
 * page would start working on its own if Citi ever lit up a feed for these
 * tags, without needing a client rebuild.
 */
export function CreditIntradayPanel() {
  const [historic, setHistoric] = useState<CreditHistoricSnapshot | null>(null);
  const { state, prices } = useCitiStream(true, "/api/citi/credit/stream");

  useEffect(() => {
    let cancelled = false;
    fetchCreditHistoric()
      .then((s) => !cancelled && setHistoric(s))
      .catch(() => !cancelled && setHistoric(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const streamTags = new Set(CREDIT_STREAM_INSTRUMENTS.map((i) => i.tag));
  const liveTicks = Object.values(prices).filter((t) => streamTags.has(t.tag));
  const rejectedCount = Object.keys(state.rejected).filter((tag) => streamTags.has(tag)).length;
  const allRejectedSameReason =
    rejectedCount === CREDIT_STREAM_INSTRUMENTS.length &&
    new Set(CREDIT_STREAM_INSTRUMENTS.map((i) => state.rejected[i.tag])).size === 1;

  return (
    <>
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Citi — Credit Intraday</div>
          <div className="module-banner-sub">
            Credit content on this Citi Velocity account is end-of-day only —
            see the note below. Latest close vs prior close for the headline
            CDS indices in the meantime.
          </div>
        </div>
      </div>

      <div className="demo-banner">
        {liveTicks.length > 0 ? (
          <>
            Live ticks are arriving — see the board below.
          </>
        ) : allRejectedSameReason ? (
          <>
            <strong>No intraday feed for Credit.</strong> Citi's streaming
            API rejected every subscription attempt below with:{" "}
            <em>"{state.rejected[CREDIT_STREAM_INSTRUMENTS[0].tag]}"</em>. The
            Historical Data endpoint behaves the same way — requesting
            MINUTE/INTRADAY/HOURLY frequency silently returns daily closes
            instead. This is confirmed against the live API, not a
            configuration gap: unlike FX, Credit does not stream on this
            account.
          </>
        ) : (
          <>Waiting on Citi's streaming API — {STATUS_LABEL[state.status] ?? state.status}.</>
        )}
      </div>

      <h3 className="section-heading">Latest close vs prior close</h3>
      {!historic ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <table className="watchlist-table">
          <thead>
            <tr>
              <th>Index</th>
              <th className="num">Prior close</th>
              <th className="num">Latest close</th>
              <th className="num">Change</th>
              <th>As of</th>
            </tr>
          </thead>
          <tbody>
            {historic.indices.map((i) => (
              <DayOverDayRow key={i.key} instrument={i} />
            ))}
          </tbody>
        </table>
      )}

      <h3 className="section-heading" style={{ marginTop: 24 }}>
        Live subscription attempt
      </h3>
      <table className="watchlist-table">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Field</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {CREDIT_STREAM_INSTRUMENTS.map((i) => {
            const tick = prices[i.tag];
            const rejection = state.rejected[i.tag];
            return (
              <tr key={i.key}>
                <td className="ticker-cell">{i.label}</td>
                <td className="num-cell">{i.tag.split(".").at(-1)}</td>
                <td>
                  {tick
                    ? `${tick.value.toFixed(2)} (${STATUS_LABEL.live})`
                    : rejection
                      ? rejection
                      : (STATUS_LABEL[state.status] ?? state.status)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <SourceFooter
        sources={[
          { label: "Citi Velocity (live ticks, when available)", url: "https://velocity.citi.com" },
          { label: "Citi Velocity (latest/prior EOD close)", url: "https://velocity.citi.com" },
        ]}
      />
    </>
  );
}
