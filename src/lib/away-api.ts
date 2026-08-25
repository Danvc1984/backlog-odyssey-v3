import "server-only";

export const AWAY_URL =
  "https://raw.githubusercontent.com/AreWeAntiCheatYet/AreWeAntiCheatYet/master/games.json";
export const AWAY_SITE_URL = "https://areweanticheatyet.com/game";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type AwayStatus = "Supported" | "Running" | "Denied" | "Broken" | "Planned";

export type AwayProviderError = {
  category: "NETWORK" | "HTTP" | "MALFORMED_RESPONSE";
  message: string;
  status?: number;
};

export interface AwayResult {
  appId: string;
  name: string;
  status: AwayStatus;
  anticheats: string[];
}

export function awayGameUrl(appId: string): string {
  return `${AWAY_SITE_URL}/${encodeURIComponent(appId)}`;
}

interface AwayEntry {
  name?: unknown;
  status?: unknown;
  anticheats?: unknown;
  storeIds?: unknown;
}

let cache: { expiresAt: number; entries: Map<string, AwayResult> } | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function providerError(
  category: AwayProviderError["category"],
  message: string,
  status?: number,
): AwayProviderError {
  return status === undefined ? { category, message } : { category, message, status };
}

function parseEntries(payload: unknown): AwayResult[] | null {
  if (!Array.isArray(payload)) return null;

  const results: AwayResult[] = [];
  for (const value of payload) {
    if (!isRecord(value)) return null;
    const entry = value as AwayEntry;
    const storeIds = isRecord(entry.storeIds) ? entry.storeIds : null;
    if (
      typeof entry.name !== "string" ||
      typeof entry.status !== "string" ||
      !["Supported", "Running", "Denied", "Broken", "Planned"].includes(entry.status) ||
      !Array.isArray(entry.anticheats) ||
      entry.anticheats.some((item) => typeof item !== "string")
    ) {
      return null;
    }
    if (typeof storeIds?.steam !== "string") continue;
    results.push({
      appId: storeIds.steam,
      name: entry.name,
      status: entry.status as AwayStatus,
      anticheats: entry.anticheats as string[],
    });
  }
  return results;
}

async function fetchDataset(fetchFn: typeof fetch): Promise<Map<string, AwayResult> | AwayProviderError> {
  let response: Response;
  try {
    response = await fetchFn(AWAY_URL, { cache: "no-store" });
  } catch {
    return providerError("NETWORK", "AreWeAntiCheatYet could not be reached");
  }
  if (!response.ok) {
    return providerError("HTTP", "AreWeAntiCheatYet request failed", response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return providerError("MALFORMED_RESPONSE", "AreWeAntiCheatYet returned invalid JSON");
  }
  const entries = parseEntries(payload);
  if (!entries) {
    return providerError("MALFORMED_RESPONSE", "AreWeAntiCheatYet returned an invalid dataset");
  }
  return new Map(entries.map((entry) => [entry.appId, entry]));
}

export async function lookupAway(
  appId: string,
  fetchFn: typeof fetch = fetch,
  now = Date.now(),
): Promise<AwayResult | AwayProviderError | null> {
  if (!cache || cache.expiresAt <= now) {
    const result = await fetchDataset(fetchFn);
    if ("category" in result) return result;
    cache = { entries: result, expiresAt: now + CACHE_TTL_MS };
  }
  return cache.entries.get(appId) ?? null;
}

export function clearAwayCache(): void {
  cache = null;
}
