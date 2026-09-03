import path from "node:path";

export const BASE_URL = process.env.CITI_BASE_URL ?? "https://api.citivelocity.com";

export const TOKEN_URL =
  process.env.CITI_TOKEN_URL ??
  "https://api.citivelocity.com/markets/cv/api/oauth2/token";

/** The token endpoint rejects a request with no scope ({"error":"invalid_scope"}). */
export const TOKEN_SCOPE = process.env.CITI_TOKEN_SCOPE ?? "/api";

export const DATA_PATH =
  "/markets/analytics/chartingbe/rest/external/authed/data";

/**
 * On-disk home for the tag-value cache and the call ledger.
 *
 * Both MUST survive a restart. Citi meters /data at roughly ten calls per
 * tag, account-level and not reset by a fresh token, so an in-memory cache
 * would re-spend the budget every time the dev server reloads — which with
 * `tsx watch` is on every keystroke-triggered save.
 */
export const CACHE_DIR =
  process.env.CITI_CACHE_DIR ??
  path.join(process.cwd(), ".citi-cache");

export function credentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.CITI_CLIENT_ID;
  const clientSecret = process.env.CITI_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
