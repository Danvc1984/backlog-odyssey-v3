import "server-only";

const STEAMSPY_ENDPOINT = "https://steamspy.com/api.php";
const STEAMSPY_TIMEOUT_MS = 10_000;

export interface SteamSpyProviderError {
  category: "NETWORK" | "HTTP" | "MALFORMED_RESPONSE";
  message: string;
  status?: number;
}

export interface SteamSpyMedian {
  medianForeverMinutes: number;
}

export type SteamSpyResult =
  | { ok: true; data: SteamSpyMedian | null }
  | { ok: false; error: SteamSpyProviderError };

function positiveNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export async function fetchSteamSpyMedian(
  steamAppId: string,
  options: { fetchFn?: typeof fetch } = {},
): Promise<SteamSpyResult> {
  if (!/^\d+$/.test(steamAppId)) return { ok: true, data: null };
  const fetchFn = options.fetchFn ?? fetch;
  const params = new URLSearchParams({ request: "appdetails", appid: steamAppId });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STEAMSPY_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchFn(`${STEAMSPY_ENDPOINT}?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return { ok: false, error: { category: "NETWORK", message: "SteamSpy could not be reached" } };
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    return { ok: false, error: { category: "HTTP", message: "SteamSpy request failed", status: response.status } };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: { category: "MALFORMED_RESPONSE", message: "SteamSpy returned invalid JSON" } };
  }
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: { category: "MALFORMED_RESPONSE", message: "SteamSpy returned invalid app data" } };
  }
  const median = positiveNumberOrNull((payload as { median_forever?: unknown }).median_forever);
  return { ok: true, data: median === null ? null : { medianForeverMinutes: median } };
}
