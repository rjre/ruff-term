import https from "node:https";

/**
 * FRED's server has a TLS/HTTP2 negotiation quirk that undici's global
 * `fetch` reliably trips on in some environments (connection reset before
 * headers) even though curl and Node's core https module reach it fine.
 * Use the core client here rather than fetch.
 */
function httpsGetText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "curl/8.0" } }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Request failed: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

export interface FredPoint {
  date: string;
  value: number;
}

/** Fetches a FRED series' full observation history via its free, keyless
 * CSV export (no API key needed for the graph-download endpoint). */
export async function fetchFredSeries(seriesId: string): Promise<FredPoint[]> {
  const text = await httpsGetText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`);
  const lines = text.trim().split("\n").slice(1);
  const points: FredPoint[] = [];
  for (const line of lines) {
    const [date, raw] = line.split(",");
    const value = Number(raw);
    if (!date || !Number.isFinite(value)) continue;
    points.push({ date, value });
  }
  return points;
}
