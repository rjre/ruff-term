import { useEffect, useRef, useState } from "react";
import { fetchNews, fetchWatchlist } from "../api/client";
import {
  type Alert,
  type NewsAlert,
  type PriceAlert,
  loadAlerts,
  saveAlerts,
} from "../lib/alerts";
import { formatQuoteTime } from "../lib/format";

interface TriggeredEvent {
  id: string;
  message: string;
  triggeredAt: string;
  url?: string;
}

const TRIGGERED_KEY = "ruffterm.alerts.triggered";
const POLL_MS = 30_000;

function loadTriggered(): TriggeredEvent[] {
  try {
    return JSON.parse(localStorage.getItem(TRIGGERED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTriggered(events: TriggeredEvent[]) {
  localStorage.setItem(TRIGGERED_KEY, JSON.stringify(events.slice(0, 50)));
}

function notificationPermission(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission;
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts);
  const [triggered, setTriggered] = useState<TriggeredEvent[]>(loadTriggered);
  const [tickerInput, setTickerInput] = useState("");
  const [conditionInput, setConditionInput] = useState<"above" | "below">(
    "above",
  );
  const [thresholdInput, setThresholdInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [notifPermission, setNotifPermission] = useState(
    notificationPermission,
  );
  const seenNewsIds = useRef(new Set<string>());

  useEffect(() => saveAlerts(alerts), [alerts]);
  useEffect(() => saveTriggered(triggered), [triggered]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const current = loadAlerts();
      const newEvents: TriggeredEvent[] = [];
      const firedPriceAlertIds = new Set<string>();

      const priceAlerts = current.filter(
        (a): a is PriceAlert => a.kind === "price",
      );
      if (priceAlerts.length > 0) {
        try {
          // One request for every watched ticker rather than one per alert:
          // the endpoint already takes a list, and several alerts commonly
          // sit on the same symbol.
          const tickers = [...new Set(priceAlerts.map((a) => a.ticker))];
          const quotes = await fetchWatchlist(tickers);
          const byTicker = new Map(quotes.map((q) => [q.ticker, q]));

          for (const alert of priceAlerts) {
            const quote = byTicker.get(alert.ticker);
            if (!quote) continue;
            const hit =
              alert.condition === "above"
                ? quote.lastPrice >= alert.threshold
                : quote.lastPrice <= alert.threshold;
            if (!hit) continue;
            firedPriceAlertIds.add(alert.id);
            newEvents.push({
              id: `${alert.id}-${Date.now()}`,
              // The quote's own tick time, not the time this check ran — a
              // market that closed hours ago can still cross a threshold on
              // the first poll after the alert is created.
              message: `${alert.ticker} is ${alert.condition === "above" ? "at/above" : "at/below"} ${alert.threshold} (last ${quote.lastPrice} @ ${formatQuoteTime(quote.updatedAt)})`,
              triggeredAt: new Date().toISOString(),
            });
          }
        } catch {
          // skip on fetch failure, try again next poll
        }
      }

      const newsAlerts = current.filter(
        (a): a is NewsAlert => a.kind === "news",
      );
      if (newsAlerts.length > 0) {
        try {
          const news = await fetchNews();
          for (const item of news) {
            if (seenNewsIds.current.has(item.id)) continue;
            seenNewsIds.current.add(item.id);
            for (const alert of newsAlerts) {
              if (
                item.headline
                  .toLowerCase()
                  .includes(alert.keyword.toLowerCase())
              ) {
                newEvents.push({
                  id: `${alert.id}-${item.id}`,
                  message: `"${alert.keyword}" — ${item.headline}`,
                  triggeredAt: new Date().toISOString(),
                  url: item.url,
                });
              }
            }
          }
        } catch {
          // skip on fetch failure
        }
      }

      if (!cancelled && newEvents.length > 0) {
        setTriggered((prev) => [...newEvents, ...prev].slice(0, 50));
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          for (const event of newEvents)
            new Notification("Ruff Term alert", { body: event.message });
        }
      }
      // Price alerts fire once, then deactivate — otherwise a price sitting
      // past its threshold would re-fire on every 30s poll indefinitely.
      if (!cancelled && firedPriceAlertIds.size > 0) {
        setAlerts((prev) => prev.filter((a) => !firedPriceAlertIds.has(a.id)));
      }
    }

    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function addPriceAlert() {
    if (!tickerInput.trim() || !thresholdInput.trim()) return;
    const alert: PriceAlert = {
      id: `price-${Date.now()}`,
      kind: "price",
      ticker: tickerInput.trim().toUpperCase(),
      condition: conditionInput,
      threshold: Number(thresholdInput),
    };
    setAlerts((prev) => [...prev, alert]);
    setTickerInput("");
    setThresholdInput("");
  }

  function addNewsAlert() {
    if (!keywordInput.trim()) return;
    const alert: NewsAlert = {
      id: `news-${Date.now()}`,
      kind: "news",
      keyword: keywordInput.trim(),
    };
    setAlerts((prev) => [...prev, alert]);
    setKeywordInput("");
  }

  function removeAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function clearTriggered() {
    setTriggered([]);
  }

  function requestNotifications() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setNotifPermission);
  }

  return (
    <div className="module-view">
      <div className="module-banner">
        <div>
          <div className="module-banner-title">Alerts</div>
          <div className="module-banner-sub">
            Price and news-keyword alerts, checked every 30s while this tab is
            open.
          </div>
        </div>
      </div>

      <div className="demo-banner">
        Per-browser only: alerts and history are stored in this browser's local
        storage, not a server-side account, and are only checked while this tab
        is open (background tabs are throttled by the browser, so a trigger may
        be delayed) — not server-side push/email/SMS. Price alerts fire once,
        then deactivate.
        {notifPermission === "unsupported" ? null : notifPermission ===
          "granted" ? (
          " Desktop notifications are enabled — a triggered alert will show even if you're not looking at this tab."
        ) : (
          <>
            {" "}
            <button
              className="icon-btn"
              onClick={requestNotifications}
              disabled={notifPermission === "denied"}
              style={{ marginLeft: 6 }}
            >
              {notifPermission === "denied"
                ? "Notifications blocked"
                : "Enable desktop notifications"}
            </button>
          </>
        )}
      </div>

      <div className="portfolio-grid">
        <section className="portfolio-section">
          <h3 className="section-heading">Price alert</h3>
          <div className="alert-form-row">
            <input
              className="search-input"
              placeholder="Ticker (e.g. AAPL)"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              style={{ maxWidth: 140 }}
            />
            <select
              className="search-input"
              value={conditionInput}
              onChange={(e) =>
                setConditionInput(e.target.value as "above" | "below")
              }
              style={{ maxWidth: 110 }}
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
            <input
              className="search-input"
              placeholder="Price"
              type="number"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              style={{ maxWidth: 110 }}
            />
            <button className="icon-btn" onClick={addPriceAlert}>
              Add
            </button>
          </div>

          <h3 className="section-heading" style={{ marginTop: 20 }}>
            News keyword alert
          </h3>
          <div className="alert-form-row">
            <input
              className="search-input"
              placeholder="Keyword (e.g. tariff)"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              style={{ maxWidth: 220 }}
            />
            <button className="icon-btn" onClick={addNewsAlert}>
              Add
            </button>
          </div>

          <h3 className="section-heading" style={{ marginTop: 20 }}>
            Active alerts
          </h3>
          {alerts.length === 0 ? (
            <div className="empty-state">No alerts set up yet.</div>
          ) : (
            <ul className="news-list">
              {alerts.map((a) => (
                <li
                  className="news-item"
                  key={a.id}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    {a.kind === "price"
                      ? `${a.ticker} ${a.condition} ${a.threshold}`
                      : `News contains "${a.keyword}"`}
                  </span>
                  <button
                    className="icon-btn"
                    onClick={() => removeAlert(a.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="portfolio-section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 className="section-heading" style={{ margin: 0 }}>
              Triggered
            </h3>
            {triggered.length > 0 && (
              <button className="icon-btn" onClick={clearTriggered}>
                Clear
              </button>
            )}
          </div>
          {triggered.length === 0 ? (
            <div className="empty-state">Nothing triggered yet.</div>
          ) : (
            <ul className="news-list">
              {triggered.map((t) => (
                <li className="news-item" key={t.id}>
                  {t.url ? (
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.message}
                    </a>
                  ) : (
                    t.message
                  )}
                  <div className="news-meta">
                    {new Date(t.triggeredAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="source-footer">
        Prices: Yahoo Finance (live). News: Yahoo Finance search. Alerts logic
        and storage: this browser only.
      </div>
    </div>
  );
}
