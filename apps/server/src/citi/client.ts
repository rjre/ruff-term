import { BASE_URL, TOKEN_SCOPE, TOKEN_URL, credentials } from "./config.js";

interface TokenResponse {
  access_token: string;
  expires_in?: number;
}

let token: string | null = null;
let expiresAt = 0;
let refreshing: Promise<string> | null = null;

async function refresh(): Promise<string> {
  const creds = credentials();
  if (!creds) throw new Error("Citi credentials not configured");

  // Confirmed against the live endpoint: client_id/client_secret go as form
  // fields rather than HTTP Basic, and omitting `scope` is rejected outright
  // with {"error":"invalid_scope"}.
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: TOKEN_SCOPE,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Citi token request failed: ${res.status}`);
  }
  const payload = (await res.json()) as TokenResponse;
  token = payload.access_token;
  // Refresh a minute early so an in-flight request never races expiry.
  expiresAt = Date.now() + Math.max((payload.expires_in ?? 1800) - 60, 0) * 1000;
  return token;
}

async function getToken(): Promise<string> {
  if (token && Date.now() < expiresAt) return token;
  // Share one refresh across concurrent callers.
  refreshing ??= refresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * Citi allows one concurrent request and at most one per second. This chains
 * every call onto a single promise so both hold without a worker pool.
 */
let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;
const MIN_INTERVAL_MS = 1000;

function serialize<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return run();
  });
  // Keep the chain alive even if this call rejects.
  queue = next.catch(() => undefined);
  return next;
}

export function isConfigured(): boolean {
  return credentials() !== null;
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  return serialize(async () => {
    const bearer = await getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Citi ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const parsed = JSON.parse(text) as T & {
      error?: unknown;
      status?: string;
      message?: string;
    };
    // The API reports failures with HTTP 200 in two different shapes: an
    // `error` object, or {"status":"ERROR","message":"Invalid Input"}. Missing
    // the second made a rejected request look like an empty result.
    if (parsed && typeof parsed === "object") {
      if (parsed.error) {
        throw new Error(
          `Citi ${path} error: ${JSON.stringify(parsed.error).slice(0, 200)}`,
        );
      }
      if (parsed.status === "ERROR") {
        throw new Error(
          `Citi ${path} error: ${parsed.message ?? "unspecified"}`,
        );
      }
    }
    return parsed;
  });
}
