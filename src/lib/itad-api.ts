import "server-only";

const ITAD_API_BASE_URL = "https://api.isthereanydeal.com";
const STEAM_SHOP_ID = 61;
const PRICES_CHUNK_SIZE = 200;

export interface ItadProviderError {
  category: "CONFIGURATION" | "NETWORK" | "HTTP" | "MALFORMED_RESPONSE";
  message: string;
  status?: number;
}

export interface ItadPlatform {
  id: number;
  name: string;
}

export interface ItadDeal {
  shopId: number | null;
  shopName: string | null;
  price: number | null;
  currency: string | null;
  regular: number | null;
  cut: number | null;
  voucher: string | null;
  storeLow: number | null;
  flag: string | null;
  drm: string[];
  platforms: ItadPlatform[];
  timestamp: string | null;
  expiry: string | null;
  url: string | null;
}

export interface ItadGamePrices {
  itadId: string;
  historyLow: number | null;
  deals: ItadDeal[];
}

interface ItadFetchOptions {
  fetchFn?: typeof fetch;
}

function providerError(
  category: ItadProviderError["category"],
  message: string,
  status?: number,
): ItadProviderError {
  return status === undefined ? { category, message } : { category, message, status };
}

export interface ItadRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  delayFn?: (ms: number) => Promise<void>;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RequestInitLike = Parameters<typeof fetch>[1];

export async function requestItad(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInitLike,
  retryOptions: ItadRetryOptions = {},
): Promise<{ ok: true; response: Response } | { ok: false; error: ItadProviderError }> {  const maxAttempts = retryOptions.maxAttempts ?? 3;
  const baseDelayMs = retryOptions.baseDelayMs ?? 500;
  const delayFn = retryOptions.delayFn ?? defaultDelay;

  let lastError = providerError("NETWORK", "ITAD could not be reached");
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response | null = null;
    try {
      response = await fetchFn(url, init);
    } catch {
      lastError = providerError("NETWORK", "ITAD could not be reached");
    }

    if (response) {
      if (response.ok) {
        return { ok: true, response };
      }
      if (response.status === 429) {
        lastError = providerError("HTTP", "ITAD rate limited the request", 429);
        if (attempt < maxAttempts) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const waitMs =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : baseDelayMs * attempt;
          await delayFn(waitMs);
        }
        continue;
      }
      if (response.status >= 500) {
        lastError = providerError("HTTP", "ITAD request failed", response.status);
      } else {
        // Client errors are terminal: hand the response back for classification.
        return { ok: true, response };
      }
    }

    if (attempt < maxAttempts) {
      await delayFn(baseDelayMs * attempt);
    }
  }
  return { ok: false, error: lastError };
}

async function parseJsonResponse(
  response: Response,
): Promise<{ ok: true; payload: unknown } | { ok: false; error: ItadProviderError }> {
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: providerError("CONFIGURATION", "ITAD rejected the API key", response.status),
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: providerError("HTTP", "ITAD request failed", response.status),
    };
  }
  try {
    return { ok: true, payload: await response.json() };
  } catch {
    return { ok: false, error: providerError("MALFORMED_RESPONSE", "ITAD returned invalid JSON") };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function chunkItadIds(ids: string[], size = PRICES_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

function appKey(appId: string): string {
  return `app/${appId}`;
}

export async function lookupItadIdsByAppIds(
  apiKey: string,
  appIds: string[],
  options: ItadFetchOptions = {},
): Promise<Map<string, string | null> | ItadProviderError> {
  if (!apiKey || appIds.length === 0) {
    return new Map();
  }

  const fetchFn = options.fetchFn ?? fetch;
  const url = `${ITAD_API_BASE_URL}/lookup/id/shop/${STEAM_SHOP_ID}/v1?key=${encodeURIComponent(apiKey)}`;
  const outcome = await requestItad(fetchFn, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(appIds.map(appKey)),
    cache: "no-store",
  });
  if (!outcome.ok) {
    return outcome.error;
  }

  const parsed = await parseJsonResponse(outcome.response);
  if (!parsed.ok) {
    return parsed.error;
  }
  const payload = parsed.payload;
  if (!isRecord(payload)) {
    return providerError("MALFORMED_RESPONSE", "ITAD lookup returned an invalid payload");
  }

  const result = new Map<string, string | null>();
  for (const appId of appIds) {
    const value = payload[appKey(appId)];
    result.set(appId, typeof value === "string" && value.length > 0 ? value : null);
  }
  return result;
}

function parsePlatform(value: unknown): ItadPlatform | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = value.id;
  const name = value.name;
  if ((typeof id !== "number" && typeof id !== "string") || typeof name !== "string") {
    return null;
  }
  return { id: typeof id === "number" ? id : Number.NaN, name };
}

function parseDeal(value: unknown): ItadDeal | null {
  if (!isRecord(value)) {
    return null;
  }
  const shop = isRecord(value.shop) ? value.shop : {};
  const price = isRecord(value.price) ? value.price : {};
  const regular = isRecord(value.regular) ? value.regular : {};
  const storeLow = isRecord(value.storeLow) ? value.storeLow : {};

  const hasAnyData =
    nullableNumber(shop.id) !== null ||
    nullableString(shop.name) !== null ||
    nullableNumber(price.amount) !== null;
  if (!hasAnyData) {
    return null;
  }

  const drm = Array.isArray(value.drm)
    ? value.drm.flatMap((entry) =>
        isRecord(entry) && typeof entry.name === "string" ? [entry.name] : [],
      )
    : [];
  const platforms = Array.isArray(value.platforms)
    ? value.platforms.flatMap((entry) => {
        const parsed = parsePlatform(entry);
        return parsed ? [parsed] : [];
      })
    : [];

  return {
    shopId: nullableNumber(shop.id),
    shopName: nullableString(shop.name),
    price: nullableNumber(price.amount),
    currency: nullableString(price.currency),
    regular: nullableNumber(regular.amount),
    cut: nullableNumber(value.cut),
    voucher: nullableString(value.voucher),
    storeLow: nullableNumber(storeLow.amount),
    flag: nullableString(value.flag),
    drm,
    platforms,
    timestamp: nullableString(value.timestamp),
    expiry: nullableString(value.expiry),
    url: nullableString(value.url),
  };
}

function parseGamePrices(value: unknown): ItadGamePrices | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }
  const historyLow = isRecord(value.historyLow) ? value.historyLow : {};
  const all = isRecord(historyLow.all) ? historyLow.all : {};
  const deals = Array.isArray(value.deals)
    ? value.deals.flatMap((entry) => {
        const deal = parseDeal(entry);
        return deal ? [deal] : [];
      })
    : [];
  return {
    itadId: value.id,
    historyLow: nullableNumber(all.amount),
    deals,
  };
}

async function postJson(
  fetchFn: typeof fetch,
  url: string,
  body: string,
): Promise<{ ok: true; payload: unknown } | { ok: false; error: ItadProviderError }> {
  const outcome = await requestItad(fetchFn, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  if (!outcome.ok) {
    return outcome;
  }
  return parseJsonResponse(outcome.response);
}

export async function fetchItadPrices(
  apiKey: string,
  itadIds: string[],
  options: ItadFetchOptions = {},
): Promise<ItadGamePrices[] | ItadProviderError> {
  if (!apiKey || itadIds.length === 0) {
    return [];
  }

  const fetchFn = options.fetchFn ?? fetch;
  const results: ItadGamePrices[] = [];

  for (const chunk of chunkItadIds(itadIds)) {
    // No deals filter: full-price games must still yield their current price.
    const url = `${ITAD_API_BASE_URL}/games/prices/v3?country=MX&key=${encodeURIComponent(apiKey)}`;
    const outcome = await postJson(fetchFn, url, JSON.stringify(chunk));
    if (!outcome.ok) {
      return outcome.error;
    }
    if (!Array.isArray(outcome.payload)) {
      return providerError("MALFORMED_RESPONSE", "ITAD prices returned an invalid payload");
    }
    for (const entry of outcome.payload) {
      const game = parseGamePrices(entry);
      if (game) {
        results.push(game);
      }
    }
  }

  return results;
}
