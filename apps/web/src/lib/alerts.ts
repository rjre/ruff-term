export interface PriceAlert {
  id: string;
  kind: "price";
  ticker: string;
  condition: "above" | "below";
  threshold: number;
}

export interface NewsAlert {
  id: string;
  kind: "news";
  keyword: string;
}

export type Alert = PriceAlert | NewsAlert;

const ALERTS_KEY = "ruffterm.alerts";

export function loadAlerts(): Alert[] {
  try {
    return JSON.parse(localStorage.getItem(ALERTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: Alert[]): void {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function addPriceAlert(
  ticker: string,
  condition: "above" | "below",
  threshold: number,
): void {
  const alert: PriceAlert = {
    id: `price-${Date.now()}`,
    kind: "price",
    ticker,
    condition,
    threshold,
  };
  saveAlerts([...loadAlerts(), alert]);
}
