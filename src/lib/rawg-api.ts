import "server-only";

import type {
  RawgEsrbRating,
  RawgGameDetails,
  RawgMatchRequest,
  RawgMatchResult,
  RawgNamedValue,
  RawgProviderError,
  RawgSearchCandidate,
  RawgSeriesEntry,
  RawgStoreEntry,
} from "./rawg-types";

const RAWG_API_BASE_URL = "https://api.rawg.io/api";
const RAWG_WEB_BASE_URL = "https://rawg.io/games";
export const RAWG_SEARCH_PAGE_SIZE = 5;
const RAWG_SERIES_PAGE_CAP = 20;
const RAWG_REQUEST_TIMEOUT_MS = 10_000;

interface RawgHttpResponse {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}

interface RawgFetchOptions {
  fetchFn?: typeof fetch;
}

interface RawgApiGame {
  id?: unknown;
  slug?: unknown;
  name?: unknown;
  description_raw?: unknown;
  description?: unknown;
  released?: unknown;
  background_image?: unknown;
  background_image_additional?: unknown;
  genres?: unknown;
  tags?: unknown;
  developers?: unknown;
  publishers?: unknown;
  website?: unknown;
  rating?: unknown;
  metacritic?: unknown;
  playtime?: unknown;
  alternative_names?: unknown;
  updated?: unknown;
  stores?: unknown;
  esrb_rating?: unknown;
}

interface RawgApiSearchResponse {
  results?: unknown;
}

function providerError(
  category: RawgProviderError["category"],
  message: string,
  status?: number,
): RawgProviderError {
  return status === undefined ? { category, message } : { category, message, status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function parseNamedValues(value: unknown): RawgNamedValue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const values: RawgNamedValue[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isPositiveInteger(item.id) || typeof item.name !== "string") {
      return null;
    }

    values.push({
      id: item.id,
      name: item.name,
      slug: nullableString(item.slug),
    });
  }

  return values;
}

function parseAlternativeNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const names: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim().length > 0) {
      names.push(item);
      continue;
    }

    if (isRecord(item) && typeof item.name === "string" && item.name.trim().length > 0) {
      names.push(item.name);
      continue;
    }

    return null;
  }

  return names;
}

function parseEsrbRating(value: unknown): RawgEsrbRating | null {
  if (!isRecord(value) || typeof value.name !== "string" || value.name.trim().length === 0) {
    return null;
  }
  return { name: value.name, slug: nullableString(value.slug) };
}

function parseSeriesGames(value: unknown): RawgSeriesEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: RawgSeriesEntry[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      !isPositiveInteger(item.id) ||
      typeof item.name !== "string" ||
      item.name.trim().length === 0
    ) {
      continue;
    }

    entries.push({
      rawgId: item.id,
      name: item.name,
      slug: nullableString(item.slug),
      released: nullableString(item.released),
    });
  }

  return entries.slice(0, RAWG_SERIES_PAGE_CAP);
}

function parseGame(value: unknown): RawgGameDetails | null {
  if (!isRecord(value)) {
    return null;
  }

  const game = value as RawgApiGame;
  if (!isPositiveInteger(game.id) || typeof game.slug !== "string" || typeof game.name !== "string") {
    return null;
  }

  const genres = parseNamedValues(game.genres);
  const tags = parseNamedValues(game.tags);
  const developers = parseNamedValues(game.developers);
  const publishers = parseNamedValues(game.publishers);
  const alternativeNames = parseAlternativeNames(game.alternative_names ?? []);
  if (!genres || !tags || !developers || !publishers || !alternativeNames) {
    return null;
  }

  const description = nullableString(game.description_raw ?? game.description);
  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    description,
    released: nullableString(game.released),
    backgroundImage: nullableString(game.background_image),
    backgroundImageAdditional: nullableString(game.background_image_additional),
    genres,
    tags,
    developers,
    publishers,
    website: nullableString(game.website),
    rating: nullableNumber(game.rating),
    metacritic: nullableNumber(game.metacritic),
    playtime: nullableNumber(game.playtime),
    alternativeNames,
    rawgUpdatedAt: nullableString(game.updated),
    rawgUrl: `${RAWG_WEB_BASE_URL}/${encodeURIComponent(game.slug)}`,
    stores: parseStores(game.stores),
    esrbRating: parseEsrbRating(game.esrb_rating),
    seriesGames: [],
  };
}

function parseStores(value: unknown): RawgStoreEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item): RawgStoreEntry[] => {
    if (!isRecord(item)) {
      return [];
    }
    const store = isRecord(item.store) ? item.store : {};
    return [
      {
        storeSlug: nullableString(store.slug),
        storeName: nullableString(store.name),
        url: nullableString(item.url),
      },
    ];
  });
}

function parseSearchCandidate(value: unknown): RawgSearchCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = value as RawgApiGame;
  if (
    !isPositiveInteger(candidate.id) ||
    typeof candidate.slug !== "string" ||
    typeof candidate.name !== "string" ||
    candidate.name.trim().length === 0
  ) {
    return null;
  }

  return {
    id: candidate.id,
    slug: candidate.slug,
    name: candidate.name,
    released: nullableString(candidate.released),
    backgroundImage: nullableString(candidate.background_image),
  };
}

export function normalizeRawgTitle(title: string): string {
  return title
    .replace(/[®™]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function unavailable(error: RawgProviderError): RawgMatchResult {
  return { outcome: "UNAVAILABLE", error };
}

async function requestJson(
  url: string,
  fetchFn: typeof fetch,
): Promise<{ response: RawgHttpResponse; payload: unknown } | { error: RawgProviderError }> {
  let response: RawgHttpResponse;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RAWG_REQUEST_TIMEOUT_MS);
  try {
    response = await fetchFn(url, { cache: "no-store", signal: controller.signal });
  } catch {
    return {
      error: providerError("NETWORK", "RAWG could not be reached"),
    };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return { response, payload: null };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      error: providerError("MALFORMED_RESPONSE", "RAWG returned invalid JSON", response.status),
    };
  }

  return { response, payload };
}

async function fetchGameSeries(
  id: number,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<RawgSeriesEntry[]> {
  try {
    const url = `${RAWG_API_BASE_URL}/games/${encodeURIComponent(String(id))}/game-series?key=${encodeURIComponent(apiKey)}`;
    const result = await requestJson(url, fetchFn);
    if ("error" in result || !result.response.ok) {
      return [];
    }

    const results = isRecord(result.payload)
      ? (result.payload as RawgApiSearchResponse).results
      : null;
    if (!Array.isArray(results)) {
      return [];
    }

    return parseSeriesGames(results);
  } catch {
    return [];
  }
}

async function fetchGame(
  id: number,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<RawgGameDetails | RawgProviderError | null> {
  const url = `${RAWG_API_BASE_URL}/games/${encodeURIComponent(String(id))}?key=${encodeURIComponent(apiKey)}`;
  const result = await requestJson(url, fetchFn);
  if ("error" in result) {
    return result.error;
  }

  if (result.response.status === 404) {
    return null;
  }
  if (!result.response.ok) {
    return providerError("HTTP", "RAWG returned an unsuccessful response", result.response.status);
  }

  const game = parseGame(result.payload);
  if (!game) {
    return providerError("MALFORMED_RESPONSE", "RAWG returned an invalid game response", result.response.status);
  }

  const seriesGames = await fetchGameSeries(game.id, apiKey, fetchFn);
  return { ...game, seriesGames };
}

async function searchGames(
  title: string,
  apiKey: string,
  fetchFn: typeof fetch,
  page = 1,
): Promise<RawgSearchCandidate[] | RawgProviderError> {
  const params = new URLSearchParams({
    key: apiKey,
    search: title,
    page: String(page),
    page_size: String(RAWG_SEARCH_PAGE_SIZE),
  });
  const result = await requestJson(`${RAWG_API_BASE_URL}/games?${params}`, fetchFn);
  if ("error" in result) {
    return result.error;
  }
  if (!result.response.ok) {
    return providerError("HTTP", "RAWG returned an unsuccessful response", result.response.status);
  }
  const results = isRecord(result.payload)
    ? (result.payload as RawgApiSearchResponse).results
    : null;
  if (!Array.isArray(results)) {
    return providerError("MALFORMED_RESPONSE", "RAWG returned an invalid search response", result.response.status);
  }

  const candidates: RawgSearchCandidate[] = [];
  for (const item of results as unknown[]) {
    const candidate = parseSearchCandidate(item);
    if (!candidate) {
      return providerError("MALFORMED_RESPONSE", "RAWG returned an invalid search result", result.response.status);
    }
    candidates.push(candidate);
  }

  return candidates;
}

export async function searchRawgCandidates(
  title: string,
  page = 1,
  options: RawgFetchOptions = {},
): Promise<RawgSearchCandidate[] | RawgProviderError> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    return providerError("CONFIGURATION", "RAWG is not configured");
  }
  if (title.trim().length === 0 || !Number.isInteger(page) || page < 1) {
    return providerError("MALFORMED_RESPONSE", "RAWG search request is invalid");
  }

  const normalizedTitle = normalizeRawgTitle(title);
  if (normalizedTitle.length === 0) {
    return providerError("MALFORMED_RESPONSE", "RAWG search request is invalid");
  }

  return searchGames(normalizedTitle, apiKey, options.fetchFn ?? fetch, page);
}

async function resolveCandidate(
  candidate: RawgSearchCandidate,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<RawgMatchResult> {
  const details = await fetchGame(candidate.id, apiKey, fetchFn);
  if (details === null) {
    return { outcome: "NOT_FOUND" };
  }
  if ("category" in details) {
    return unavailable(details);
  }
  return { outcome: "MATCHED", matchMethod: "MANUAL_RAWG_SEARCH", game: details };
}

export async function matchRawgGame(
  request: RawgMatchRequest,
  options: RawgFetchOptions = {},
): Promise<RawgMatchResult> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    return unavailable({
      category: "CONFIGURATION",
      message: "RAWG is not configured",
    });
  }

  const fetchFn = options.fetchFn ?? fetch;
  if (request.selectedRawgId !== null && request.selectedRawgId !== undefined) {
    if (!isPositiveInteger(request.selectedRawgId)) {
      return unavailable(providerError("MALFORMED_RESPONSE", "RAWG match ID is invalid"));
    }

    const selected = await fetchGame(request.selectedRawgId, apiKey, fetchFn);
    if (selected === null) {
      return { outcome: "NOT_FOUND" };
    }
    if ("category" in selected) {
      return unavailable(selected);
    }
    return { outcome: "MATCHED", matchMethod: "MANUAL_RAWG_SEARCH", game: selected };
  }

  if (request.title.trim().length === 0) {
    return { outcome: "NOT_FOUND" };
  }

  const normalizedTitle = normalizeRawgTitle(request.title);
  if (normalizedTitle.length === 0) {
    return { outcome: "NOT_FOUND" };
  }

  const search = await searchGames(normalizedTitle, apiKey, fetchFn);
  if (!Array.isArray(search)) {
    return unavailable(search);
  }

  const exactTitleCandidates = search.filter(
    (candidate) => normalizeRawgTitle(candidate.name) === normalizedTitle,
  );
  if (exactTitleCandidates.length === 0) {
    return search.length > 1 ? { outcome: "AMBIGUOUS", candidates: search } : { outcome: "NOT_FOUND" };
  }
  if (exactTitleCandidates.length > 1) {
    return { outcome: "AMBIGUOUS", candidates: exactTitleCandidates };
  }

  return resolveCandidate(exactTitleCandidates[0], apiKey, fetchFn);
}
