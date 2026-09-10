const OWNED_GAMES_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";
const STORE_SEARCH_ENDPOINT = "https://store.steampowered.com/api/storesearch/";
const STEAM_WISHLIST_ENDPOINT =
  "https://api.steampowered.com/IWishlistService/GetWishlist/v1/";
const STEAM_APP_LIST_ENDPOINT =
  "https://api.steampowered.com/IStoreService/GetAppList/v1/";
const RECENTLY_PLAYED_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/";
const STORE_DETAILS_CONCURRENCY = 8;
const STEAM_REQUEST_TIMEOUT_MS = 15_000;
const STEAM_APP_LIST_PAGE_SIZE = 50_000;

export interface OwnedGame {
  appid: number;
  name: string;
  playtimeForever: number;
  rtimeLastPlayed: number;
  type?: "DLC";
  steamBaseAppId?: string;
}

export interface SteamWishlistGame {
  appid: number;
  name: string;
  type?: "DLC";
  steamBaseAppId?: string;
}

export interface RecentSteamGame {
  steamAppId: string;
  name: string;
  lastPlayedAt: string | null;
  playtimeForeverMinutes: number;
  playtimeTwoWeeksMinutes: number | null;
}

export type SteamRecentActivityFetchResult =
  | { status: "OK"; games: RecentSteamGame[] }
  | { status: "UNAVAILABLE" };

export type SteamWishlistFetchResult = {
  games: SteamWishlistGame[];
  status: "OK" | "EMPTY" | "UNAVAILABLE";
};

export interface SteamStorePrice {
  appid: number;
  currency: string;
  price: number;
  regularPrice: number;
  discount: number;
  url: string;
}

interface SteamOwnedGameResponse {
  appid?: unknown;
  name?: unknown;
  playtime_forever?: unknown;
  rtime_last_played?: unknown;
}

interface SteamOwnedGamesResponse {
  response?: {
    games?: unknown;
  };
}

interface SteamAppDetails {
  name?: unknown;
  type?: unknown;
  fullgame?: { appid?: unknown };
  price_overview?: {
    currency?: unknown;
    initial?: unknown;
    final?: unknown;
    discount_percent?: unknown;
  };
}

interface SteamAppDetailsResponse {
  [appid: string]: {
    success?: unknown;
    data?: SteamAppDetails;
  };
}

interface SteamWishlistItem {
  appid?: unknown;
}

interface SteamWishlistResponse {
  response?: {
    items?: unknown;
  };
}

interface SteamAppListItem {
  appid?: unknown;
  name?: unknown;
}

interface SteamAppListResponse {
  response?: {
    apps?: unknown;
    have_more_results?: unknown;
    last_appid?: unknown;
  };
}

interface SteamRecentGameResponse {
  appid?: unknown;
  name?: unknown;
  playtime_2weeks?: unknown;
  playtime_forever?: unknown;
  rtime_last_played?: unknown;
}

interface SteamRecentActivityResponse {
  response?: {
    total_count?: unknown;
    games?: unknown;
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeGame(value: unknown): OwnedGame | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const game = value as SteamOwnedGameResponse;
  if (
    !isFiniteNumber(game.appid) ||
    !Number.isInteger(game.appid) ||
    typeof game.name !== "string" ||
    game.name.trim().length === 0
  ) {
    return null;
  }

  return {
    appid: game.appid,
    name: game.name,
    playtimeForever: isFiniteNumber(game.playtime_forever)
      ? game.playtime_forever
      : 0,
    rtimeLastPlayed: isFiniteNumber(game.rtime_last_played)
      ? game.rtime_last_played
      : 0,
  };
}

import type { WishlistStoreLink } from "./rawg-types";

interface SteamStoreSearchItem {
  type?: unknown;
  name?: unknown;
  id?: unknown;
}

interface SteamStoreSearchResponse {
  items?: unknown;
}

export async function findSteamAppIdByName(
  name: string,
  fetchFn: typeof fetch = fetch,
): Promise<WishlistStoreLink | null> {
  const term = name.trim();
  if (term.length === 0) {
    return null;
  }

  try {
    const params = new URLSearchParams({ term, cc: "MX", l: "en" });
    const response = await fetchFn(`${STORE_SEARCH_ENDPOINT}?${params}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const payload: unknown = await response.json();
    const items = (payload as SteamStoreSearchResponse).items;
    if (!Array.isArray(items)) {
      return null;
    }

    const exact = items.find((item): item is SteamStoreSearchItem => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const candidate = item as SteamStoreSearchItem;
      return (
        candidate.type === "app" &&
        typeof candidate.name === "string" &&
        typeof candidate.id === "number" &&
        Number.isInteger(candidate.id) &&
        candidate.id > 0 &&
        candidate.name.trim().toLowerCase() === term.toLowerCase()
      );
    });
    if (!exact || typeof exact.id !== "number") {
      return null;
    }
    const appId = String(exact.id);
    return { steamAppId: appId, steamUrl: `https://store.steampowered.com/app/${appId}` };
  } catch {
    return null;
  }
}

export async function fetchOwnedGames(
  steamId64: string,
  apiKey: string,
): Promise<OwnedGame[]> {
  const params = new URLSearchParams({
    key: apiKey,
    steamid: steamId64,
    include_appinfo: "1",
    format: "json",
  });

  try {
    const response = await fetch(`${OWNED_GAMES_ENDPOINT}?${params}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") {
      return [];
    }

    const games = (payload as SteamOwnedGamesResponse).response?.games;
    if (!Array.isArray(games)) {
      return [];
    }

    const ownedGames = games.flatMap((game) => {
      const normalized = normalizeGame(game);
      return normalized ? [normalized] : [];
    });

    const details = await fetchOwnedGameDetails(ownedGames.map((game) => game.appid));
    return ownedGames.map((game) => {
      const detail = details.get(game.appid);
      if (detail?.type !== "dlc" || !Number.isInteger(detail.fullGameAppId)) {
        return game;
      }
      return {
        ...game,
        type: "DLC" as const,
        steamBaseAppId: String(detail.fullGameAppId),
      };
    });
  } catch {
    return [];
  }
}

export async function fetchSteamWishlist(
  steamId64: string,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<SteamWishlistFetchResult> {
  try {
    const params = new URLSearchParams({
      key: apiKey,
      steamid: steamId64,
      format: "json",
    });
    const response = await fetchWithTimeout(
      fetchFn,
      `${STEAM_WISHLIST_ENDPOINT}?${params}`,
    );
    if (!response.ok) {
      return { games: [], status: "UNAVAILABLE" };
    }

    const payload: unknown = await response.json();
    const items = (payload as SteamWishlistResponse).response?.items;
    if (!Array.isArray(items)) {
      return { games: [], status: "UNAVAILABLE" };
    }

    const wishlist = items.flatMap((value) => {
      if (!value || typeof value !== "object") {
        return [];
      }
      const item = value as SteamWishlistItem;
      const parsedAppId = item.appid;
      if (
        isFiniteNumber(parsedAppId) &&
        Number.isInteger(parsedAppId) &&
        parsedAppId > 0
      ) {
        return [{ appid: parsedAppId }];
      }
      return [];
    });
    if (wishlist.length === 0) {
      return { games: [], status: "EMPTY" };
    }

    const appids = wishlist.map((game) => game.appid);
    const [gameNames, dlcNames] = await Promise.all([
      fetchSteamAppList(appids, "games", apiKey, fetchFn),
      fetchSteamAppList(appids, "dlc", apiKey, fetchFn),
    ]);
    const details = await fetchOwnedGameDetails([...dlcNames.keys()], fetchFn);
    const games = wishlist.flatMap((game) => {
      const name = gameNames.get(game.appid) ?? dlcNames.get(game.appid);
      const detail = details.get(game.appid);
      if (typeof name !== "string" || name.trim().length === 0) {
        return [];
      }
      const normalized: SteamWishlistGame = { appid: game.appid, name };
      const fullGameAppId = detail?.fullGameAppId;
      if (dlcNames.has(game.appid)) {
        normalized.type = "DLC";
        if (Number.isInteger(fullGameAppId)) {
          normalized.steamBaseAppId = String(fullGameAppId);
        }
      }
      return [normalized];
    });
    return {
      games,
      status: games.length > 0 ? "OK" : "UNAVAILABLE",
    };
  } catch {
    return { games: [], status: "UNAVAILABLE" };
  }
}

export async function fetchSteamStorePrices(
  appids: readonly string[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, SteamStorePrice>> {
  const prices = new Map<string, SteamStorePrice>();
  const validAppids = [...new Set(appids)]
    .map((value) => parseSteamAppId(value))
    .filter((value): value is number => value !== null);

  for (let index = 0; index < validAppids.length; index += STORE_DETAILS_CONCURRENCY) {
    await Promise.all(
      validAppids.slice(index, index + STORE_DETAILS_CONCURRENCY).map(async (appid) => {
        try {
          const params = new URLSearchParams({
            appids: String(appid),
            cc: "MX",
            l: "spanish",
            filters: "price_overview",
          });
          const response = await fetchWithTimeout(
            fetchFn,
            `https://store.steampowered.com/api/appdetails?${params}`,
          );
          if (!response.ok) return;
          const payload = (await response.json()) as SteamAppDetailsResponse;
          const overview = payload[String(appid)]?.data?.price_overview;
          const currency = typeof overview?.currency === "string" ? overview.currency.trim() : "";
          const regularMinor = overview?.initial;
          const priceMinor = overview?.final;
          const discount = overview?.discount_percent;
          if (
            !currency ||
            !isFiniteNumber(regularMinor) ||
            !isFiniteNumber(priceMinor) ||
            !isFiniteNumber(discount)
          ) {
            return;
          }
          prices.set(String(appid), {
            appid,
            currency,
            regularPrice: regularMinor / 100,
            price: priceMinor / 100,
            discount: Math.round(discount),
            url: `https://store.steampowered.com/app/${appid}/?cc=mx`,
          });
        } catch {
          // Direct Store prices are optional. ITAD can still provide offers.
        }
      }),
    );
  }
  return prices;
}

function normalizeRecentGame(value: unknown): RecentSteamGame | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const game = value as SteamRecentGameResponse;
  if (
    !isFiniteNumber(game.appid) ||
    !Number.isInteger(game.appid) ||
    typeof game.name !== "string" ||
    game.name.trim().length === 0
  ) {
    return null;
  }

  const lastPlayedSeconds = isFiniteNumber(game.rtime_last_played)
    ? Math.floor(game.rtime_last_played)
    : null;
  return {
    steamAppId: String(game.appid),
    name: game.name,
    lastPlayedAt:
      lastPlayedSeconds !== null && lastPlayedSeconds > 0
        ? new Date(lastPlayedSeconds * 1000).toISOString()
        : null,
    playtimeForeverMinutes: isFiniteNumber(game.playtime_forever)
      ? Math.floor(game.playtime_forever)
      : 0,
    playtimeTwoWeeksMinutes: isFiniteNumber(game.playtime_2weeks)
      ? Math.floor(game.playtime_2weeks)
      : null,
  };
}

export async function fetchRecentlyPlayedGames(
  steamId64: string,
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<SteamRecentActivityFetchResult> {
  try {
    const params = new URLSearchParams({
      key: apiKey,
      steamid: steamId64,
      format: "json",
    });
    const response = await fetchWithTimeout(
      fetchFn,
      `${RECENTLY_PLAYED_ENDPOINT}?${params}`,
    );
    if (!response.ok) {
      return { status: "UNAVAILABLE" };
    }

    const payload: unknown = await response.json();
    const games = (payload as SteamRecentActivityResponse).response?.games;
    if (!Array.isArray(games)) {
      // A capped or private profile returns an empty games list rather than an error.
      return { status: "OK", games: [] };
    }

    const recent = games.flatMap((value) => {
      const game = normalizeRecentGame(value);
      return game ? [game] : [];
    });
    return { status: "OK", games: recent };
  } catch {
    return { status: "UNAVAILABLE" };
  }
}

async function fetchSteamAppList(
  appids: readonly number[],
  kind: "games" | "dlc",
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<Map<number, string>> {
  const targetAppids = new Set(appids);
  const names = new Map<number, string>();
  if (targetAppids.size === 0) return names;

  const minAppid = Math.min(...targetAppids);
  const maxAppid = Math.max(...targetAppids);
  let lastAppid = Math.max(0, minAppid - 1);

  while (true) {
    const payload = await fetchSteamAppListPage(kind, apiKey, lastAppid, fetchFn);
    if (!payload) return names;
    const apps = payload?.response?.apps;
    if (!Array.isArray(apps) || apps.length === 0) return names;
    addSteamAppNames(apps, targetAppids, names);

    const nextAppid = getNextAppListCursor(payload, lastAppid, maxAppid);
    if (nextAppid === null) return names;
    lastAppid = nextAppid;
  }
}

async function fetchSteamAppListPage(
  kind: "games" | "dlc",
  apiKey: string,
  lastAppid: number,
  fetchFn: typeof fetch,
): Promise<SteamAppListResponse | null> {
  const input = {
    include_games: kind === "games",
    include_dlc: kind === "dlc",
    include_software: kind === "games",
    include_videos: false,
    include_hardware: false,
    last_appid: lastAppid,
    max_results: STEAM_APP_LIST_PAGE_SIZE,
  };
  const params = new URLSearchParams({
    key: apiKey,
    format: "json",
    input_json: JSON.stringify(input),
  });

  try {
    const response = await fetchWithTimeout(
      fetchFn,
      `${STEAM_APP_LIST_ENDPOINT}?${params}`,
    );
    return response.ok ? (await response.json()) as SteamAppListResponse : null;
  } catch {
    return null;
  }
}

function addSteamAppNames(
  apps: unknown[],
  targetAppids: Set<number>,
  names: Map<number, string>,
): void {
  for (const value of apps) {
    if (!value || typeof value !== "object") continue;
    const app = value as SteamAppListItem;
    if (
      isFiniteNumber(app.appid) &&
      Number.isInteger(app.appid) &&
      targetAppids.has(app.appid) &&
      typeof app.name === "string" &&
      app.name.trim().length > 0
    ) {
      names.set(app.appid, app.name);
    }
  }
}

function getNextAppListCursor(
  payload: SteamAppListResponse,
  lastAppid: number,
  maxAppid: number,
): number | null {
  const nextAppid = parseSteamAppId(payload.response?.last_appid);
  return payload.response?.have_more_results === true &&
    nextAppid !== null &&
    nextAppid > lastAppid &&
    nextAppid < maxAppid
    ? nextAppid
    : null;
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  input: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STEAM_REQUEST_TIMEOUT_MS);
  try {
    return await fetchFn(input, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOwnedGameDetails(
  appids: number[],
  fetchFn: typeof fetch = fetch,
) {
  const details = new Map<number, { name?: string; type: string; fullGameAppId: number | null }>();
  for (let index = 0; index < appids.length; index += STORE_DETAILS_CONCURRENCY) {
    await Promise.all(
      appids.slice(index, index + STORE_DETAILS_CONCURRENCY).map(async (appid) => {
        try {
          const params = new URLSearchParams({ appids: String(appid), filters: "basic" });
          const response = await fetchWithTimeout(
            fetchFn,
            `https://store.steampowered.com/api/appdetails?${params}`,
          );
          if (!response.ok) return;
          const payload = (await response.json()) as SteamAppDetailsResponse;
          const app = payload[String(appid)];
          const fullGameAppId = parseSteamAppId(app?.data?.fullgame?.appid);
          const name = app?.data?.name;
          details.set(appid, {
            name: typeof name === "string" && name.trim().length > 0 ? name : undefined,
            type: typeof app?.data?.type === "string" ? app.data.type : "",
            fullGameAppId,
          });
        } catch {
          // A details failure must not prevent importing the wishlist IDs.
        }
      }),
    );
  }
  return details;
}

function parseSteamAppId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
