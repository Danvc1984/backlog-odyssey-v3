import "server-only";

import { withIgdbRateLimit } from "./igdb-rate-limit";
import {
  getIgdbAccessToken,
  getIgdbConfig,
  invalidateIgdbToken,
} from "./igdb-token";
import { fuzzyMatch } from "./fuzzy-match";
import { normalizeName } from "./duplicate-utils";
import {
  IGDB_STEAM_EXTERNAL_CATEGORY,
  type IgdbCategoryClass,
  type IgdbGameResponse,
  type IgdbGameTimeToBeats,
  type IgdbMatchRequest,
  type IgdbMatchResult,
  type IgdbProviderError,
  type IgdbSearchCandidate,
} from "./igdb-types";

const IGDB_API_BASE_URL = "https://api.igdb.com/v4";
const REQUEST_TIMEOUT_MS = 10_000;
export const IGDB_SEARCH_PAGE_SIZE = 30;

const SEARCH_STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to"]);

function typoTolerantSearchTerm(title: string): string {
  const terms = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !SEARCH_STOP_WORDS.has(term.toLowerCase()));
  return [...terms].sort((left, right) => right.length - left.length)[0] ?? title.trim();
}

export interface IgdbRequestOptions {
  fetchFn?: typeof fetch;
  delayFn?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
  endpoint?: "games" | "external_games" | "game_time_to_beats";
  offset?: number;
  searchTerm?: string;
}

export type IgdbRequestResult =
  | { ok: true; data: unknown }
  | { ok: false; error: IgdbProviderError };

function providerError(
  category: IgdbProviderError["category"],
  message: string,
  status?: number,
): IgdbProviderError {
  return status === undefined ? { category, message } : { category, message, status };
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterMilliseconds(response: Response): number | null {
  const retryAfter = Number(response.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1_000 : null;
}

async function fetchIgdb(
  fetchFn: typeof fetch,
  query: string,
  accessToken: string,
  clientId: string,
  endpoint: "games" | "external_games" | "game_time_to_beats",
): Promise<Response> {
  return withIgdbRateLimit(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetchFn(`${IGDB_API_BASE_URL}/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "text/plain",
        },
        body: query,
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}

export async function requestIgdb(
  query: string,
  options: IgdbRequestOptions = {},
): Promise<IgdbRequestResult> {
  const configResult = getIgdbConfig();
  if (!configResult.ok) return configResult;

  const fetchFn = options.fetchFn ?? fetch;
  const endpoint = options.endpoint ?? "games";
  const delayFn = options.delayFn ?? defaultDelay;
  const maxAttempts = options.maxAttempts ?? 3;
  let tokenResult = await getIgdbAccessToken();
  if (!tokenResult.ok) return tokenResult;

  let reauthenticated = false;
  let lastError = providerError("NETWORK", "IGDB could not be reached");
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchIgdb(fetchFn, query, tokenResult.token, configResult.config.clientId, endpoint);
    } catch {
      lastError = providerError("NETWORK", "IGDB could not be reached");
      if (attempt < maxAttempts) await delayFn(500 * attempt);
      continue;
    }

    if (response.ok) {
      try {
        return { ok: true, data: await response.json() };
      } catch {
        return { ok: false, error: providerError("MALFORMED_RESPONSE", "IGDB returned invalid JSON") };
      }
    }

    if (response.status === 401 && !reauthenticated) {
      reauthenticated = true;
      invalidateIgdbToken();
      tokenResult = await getIgdbAccessToken();
      if (!tokenResult.ok) return tokenResult;
      attempt -= 1;
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      lastError = providerError("HTTP", "IGDB request failed", response.status);
      if (attempt < maxAttempts) {
        await delayFn(retryAfterMilliseconds(response) ?? 500 * attempt);
        continue;
      }
    } else {
      return {
        ok: false,
        error: providerError("HTTP", "IGDB rejected the request", response.status),
      };
    }
  }

  return { ok: false, error: lastError };
}

export const IGDB_CATEGORY_CLASS_MAP: Readonly<Record<number, IgdbCategoryClass>> = {
  0: "MAIN_GAME",
  1: "DLC",
  2: "DLC",
  3: "NEVER_AUTO",
  4: "DLC",
  5: "NEVER_AUTO",
  6: "DLC",
  7: "DLC",
  8: "MAIN_GAME",
  9: "MAIN_GAME",
  10: "MAIN_GAME",
  11: "MAIN_GAME",
  12: "NEVER_AUTO",
  13: "NEVER_AUTO",
  14: "NEVER_AUTO",
};

export function classifyIgdbCategory(
  game: Pick<IgdbGameResponse, "category" | "game_type">,
): IgdbCategoryClass {
  const category = game.category ?? game.game_type;
  return typeof category === "number"
    ? (IGDB_CATEGORY_CLASS_MAP[category] ?? "NEVER_AUTO")
    : "NEVER_AUTO";
}

type IgdbLookupResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IgdbProviderError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseGame(value: unknown): IgdbGameResponse | null {
  return isRecord(value) && isPositiveInteger(value.id)
    ? (value as unknown as IgdbGameResponse)
    : null;
}

function parseGameList(data: unknown): IgdbGameResponse[] | null {
  if (!Array.isArray(data)) return null;
  return data.map(parseGame).filter((game): game is IgdbGameResponse => game !== null);
}

function imageUrl(imageId: unknown, size: "t_cover_big" | "t_screenshot_big"): string | null {
  return typeof imageId === "string" && imageId.length > 0
    ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`
    : null;
}

function parseCandidate(value: unknown): IgdbSearchCandidate | null {
  if (!isRecord(value) || !isPositiveInteger(value.id) || typeof value.name !== "string") {
    return null;
  }
  const alternativeNames = Array.isArray(value.alternative_names)
    ? value.alternative_names
        .filter(isRecord)
        .map((item) => item.name)
        .filter((name): name is string => typeof name === "string")
    : [];
  const cover = isRecord(value.cover) ? value.cover.image_id : null;
  const firstReleaseDate = isPositiveInteger(value.first_release_date)
    ? new Date(value.first_release_date * 1_000).toISOString()
    : null;
  return {
    id: value.id,
    slug: typeof value.slug === "string" ? value.slug : "",
    name: value.name,
    alternativeNames,
    category: typeof value.category === "number" ? value.category : null,
    firstReleaseDate,
    coverUrl: imageUrl(cover, "t_cover_big"),
  };
}

function candidateFromGame(game: IgdbGameResponse): IgdbSearchCandidate {
  const cover = isRecord(game.cover) ? game.cover.image_id : null;
  return {
    id: game.id,
    slug: typeof game.slug === "string" ? game.slug : "",
    name: typeof game.name === "string" ? game.name : "",
    alternativeNames: [],
    category: typeof game.category === "number" ? game.category : null,
    firstReleaseDate: isPositiveInteger(game.first_release_date)
      ? new Date(game.first_release_date * 1_000).toISOString()
      : null,
    coverUrl: imageUrl(cover, "t_cover_big"),
  };
}

async function fetchGameById(
  id: number,
  options: IgdbRequestOptions,
): Promise<IgdbLookupResult<IgdbGameResponse | null>> {
  const result = await requestIgdb(
    `fields id,slug,name,summary,first_release_date,genres.name,themes.name,keywords.name,involved_companies.company.id,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,age_ratings.category,age_ratings.rating,websites.url,websites.category,alternative_names.name,collection.id,collection.name,franchise.id,franchise.name,game_type,category,game_modes.id,multiplayer_modes.*,dlcs.id,dlcs.name,expansions.id,expansions.name,expanded_games.id,expanded_games.name,forks.id,forks.name,ports.id,ports.name,remakes.id,remakes.name,remasters.id,remasters.name,standalone_expansions.id,standalone_expansions.name,cover.image_id,artworks.image_id,artworks.image_type.name,screenshots.image_id,screenshots.width,screenshots.height,aggregated_rating,aggregated_rating_count,rating,rating_count,total_rating,total_rating_count,updated_at; where id = ${id}; limit 1;`,
    options,
  );
  if (!result.ok) return result;
  const games = parseGameList(result.data);
  return games === null
    ? { ok: false, error: { category: "MALFORMED_RESPONSE", message: "IGDB returned invalid game data" } }
    : { ok: true, data: games[0] ?? null };
}

export async function resolveIgdbGameBySteamAppId(
  steamAppId: string,
  options: IgdbRequestOptions = {},
): Promise<IgdbLookupResult<IgdbGameResponse[]>> {
  if (!/^\d+$/.test(steamAppId)) return { ok: true, data: [] };
  const external = await requestIgdb(
    `fields game; where uid = "${steamAppId}" & category = ${IGDB_STEAM_EXTERNAL_CATEGORY}; limit 20;`,
    { ...options, endpoint: "external_games" },
  );
  if (!external.ok) return external;
  if (!Array.isArray(external.data)) {
    return { ok: false, error: { category: "MALFORMED_RESPONSE", message: "IGDB returned invalid external game data" } };
  }
  const ids = [...new Set(external.data.filter(isRecord).map((item) => item.game).filter(isPositiveInteger))];
  const games: IgdbGameResponse[] = [];
  for (const id of ids) {
    const result = await fetchGameById(id, options);
    if (!result.ok) return result;
    if (result.data) games.push(result.data);
  }
  return { ok: true, data: games };
}

function positiveNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export async function fetchIgdbGameTimeToBeats(
  igdbId: number,
  options: IgdbRequestOptions = {},
): Promise<IgdbLookupResult<IgdbGameTimeToBeats | null>> {
  if (!Number.isSafeInteger(igdbId) || igdbId <= 0) return { ok: true, data: null };
  const result = await requestIgdb(
    `fields game_id,count,hastily,normally,completely; where game_id = ${igdbId}; limit 1;`,
    { ...options, endpoint: "game_time_to_beats" },
  );
  if (!result.ok) return result;
  if (!Array.isArray(result.data)) {
    return { ok: false, error: { category: "MALFORMED_RESPONSE", message: "IGDB returned invalid time-to-beats data" } };
  }
  const row = result.data[0];
  if (!isRecord(row)) return { ok: true, data: null };
  return {
    ok: true,
    data: {
      count: positiveNumberOrNull(row.count),
      hastilySeconds: positiveNumberOrNull(row.hastily),
      normallySeconds: positiveNumberOrNull(row.normally),
      completelySeconds: positiveNumberOrNull(row.completely),
    },
  };
}

export async function searchIgdbCandidatePage(
  title: string,
  options: IgdbRequestOptions = {},
): Promise<IgdbLookupResult<IgdbSearchCandidate[]> & { searchTerm?: string | null }> {
  const offset = Number.isInteger(options.offset) && (options.offset ?? 0) >= 0
    ? options.offset
    : 0;
  const requestPage = (searchTerm: string) => requestIgdb(
    `search "${searchTerm.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"; fields id,slug,name,alternative_names.name,category,first_release_date,cover.image_id; limit ${IGDB_SEARCH_PAGE_SIZE}; offset ${offset};`,
    options,
  );
  const primaryTerm = options.searchTerm?.trim() || title.trim();
  let searchTerm = primaryTerm;
  let result = await requestPage(primaryTerm);
  if (offset === 0 && !options.searchTerm && result.ok && Array.isArray(result.data) && result.data.length === 0) {
    const anchor = typoTolerantSearchTerm(title);
    if (anchor && anchor.toLowerCase() !== primaryTerm.toLowerCase()) {
      searchTerm = anchor;
      result = await requestPage(anchor);
    }
  }
  if (!result.ok) return result;
  if (!Array.isArray(result.data)) {
    return { ok: false, error: { category: "MALFORMED_RESPONSE", message: "IGDB returned invalid search data" } };
  }
  const candidates = result.data.map(parseCandidate).filter((candidate): candidate is IgdbSearchCandidate => candidate !== null);
  return {
    ok: true,
    data: candidates
      .map((candidate) => ({ ...candidate, score: candidateScore(title, candidate) }))
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0)),
    searchTerm,
  };
}

export async function searchIgdbCandidates(
  title: string,
  options: IgdbRequestOptions = {},
): Promise<IgdbLookupResult<IgdbSearchCandidate[]>> {
  const result = await searchIgdbCandidatePage(title, options);
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

function isCompatible(
  requested: IgdbCategoryClass,
  candidate: { category?: number | null; game_type?: number | null },
): boolean {
  const candidateClass = classifyIgdbCategory({
    category: candidate.category,
    game_type: candidate.game_type ?? null,
  });
  return candidateClass === requested;
}

function candidateScore(title: string, candidate: IgdbSearchCandidate): number {
  return Math.max(
    titleScore(title, candidate.name),
    ...candidate.alternativeNames.map((name) => titleScore(title, name)),
  );
}

function titleScore(title: string, candidateName: string): number {
  const query = normalizeName(title);
  const candidate = normalizeName(candidateName);
  if (candidate === query) return 1;
  if (candidate.startsWith(`${query} `)) {
    return Math.max(0.9, 0.98 - (candidate.length - query.length) / 500);
  }
  if (candidate.includes(query)) return 0.75;
  return fuzzyMatch(title, candidateName).score;
}

export async function matchIgdbGame(
  request: IgdbMatchRequest,
  options: IgdbRequestOptions = {},
): Promise<IgdbMatchResult> {
  if (request.selectedIgdbId) {
    const selected = await fetchGameById(request.selectedIgdbId, options);
    if (!selected.ok) return { outcome: "UNAVAILABLE", error: selected.error };
    if (!selected.data) return { outcome: "NOT_FOUND" };
    return {
      outcome: "MATCHED",
      matchMethod: "MANUAL_IGDB_SEARCH",
      game: selected.data,
      classMismatch: classifyIgdbCategory(selected.data) !== request.category,
    };
  }

  if (request.steamAppId) {
    const resolved = await resolveIgdbGameBySteamAppId(request.steamAppId, options);
    if (!resolved.ok) return { outcome: "UNAVAILABLE", error: resolved.error };
    if (resolved.data.length === 1) {
      const game = resolved.data[0];
      const candidate = candidateFromGame(game);
      if (isCompatible(request.category, game)) {
        return { outcome: "MATCHED", matchMethod: "EXACT_STEAM_APP_ID", game };
      }
      return { outcome: "AMBIGUOUS", candidates: [candidate] };
    }
    if (resolved.data.length > 1) {
      return { outcome: "AMBIGUOUS", candidates: resolved.data.map(candidateFromGame) };
    }
  }

  const search = await searchIgdbCandidates(request.title, options);
  if (!search.ok) return { outcome: "UNAVAILABLE", error: search.error };
  if (search.data.length === 0) return { outcome: "NOT_FOUND" };
  const normalizedTitle = normalizeName(request.title);
  const ranked = search.data
    .map((candidate) => ({ ...candidate, score: candidateScore(request.title, candidate) }))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  const exact = ranked.find((candidate) =>
    [candidate.name, ...candidate.alternativeNames].some((name) => normalizeName(name) === normalizedTitle),
  );
  const top = exact ?? ranked[0];
  const secondScore = ranked.find((candidate) => candidate.id !== top.id)?.score ?? 0;
  const confidentTitleMatch = exact !== undefined || ((top.score ?? 0) >= 0.9 && (top.score ?? 0) - secondScore >= 0.05);
  const knownIncompatibleCategory = top.category !== null && !isCompatible(request.category, top);
  if (!confidentTitleMatch || knownIncompatibleCategory) {
    return { outcome: "AMBIGUOUS", candidates: ranked };
  }
  const game = await fetchGameById(top.id, options);
  if (!game.ok) return { outcome: "UNAVAILABLE", error: game.error };
  if (!game.data) return { outcome: "NOT_FOUND" };
  if (!isCompatible(request.category, game.data)) {
    return { outcome: "AMBIGUOUS", candidates: ranked };
  }
  return { outcome: "MATCHED", matchMethod: "INFERRED", game: game.data };
}
