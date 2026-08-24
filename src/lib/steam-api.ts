const OWNED_GAMES_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";
const STORE_SEARCH_ENDPOINT = "https://store.steampowered.com/api/storesearch/";
const STEAM_WISHLIST_ENDPOINT =
  "https://api.steampowered.com/IWishlistService/GetWishlist/v1/";
const STORE_DETAILS_CONCURRENCY = 8;
const STEAM_REQUEST_TIMEOUT_MS = 15_000;

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

    const details = await fetchOwnedGameDetails(
      wishlist.map((game) => game.appid),
      fetchFn,
    );
    const games = wishlist.flatMap((game) => {
      const detail = details.get(game.appid);
      if (!detail || typeof detail.name !== "string" || detail.name.trim().length === 0) {
        return [];
      }
      const normalized: SteamWishlistGame = { appid: game.appid, name: detail.name };
      if (detail.type === "dlc" && Number.isInteger(detail.fullGameAppId)) {
        normalized.type = "DLC";
        normalized.steamBaseAppId = String(detail.fullGameAppId);
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
