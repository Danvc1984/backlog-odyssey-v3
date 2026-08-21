const OWNED_GAMES_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";
const STORE_SEARCH_ENDPOINT = "https://store.steampowered.com/api/storesearch/";

export interface OwnedGame {
  appid: number;
  name: string;
  playtimeForever: number;
  rtimeLastPlayed: number;
  type?: "DLC";
  steamBaseAppId?: string;
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
  type?: unknown;
  fullgame?: { appid?: unknown };
}

interface SteamAppDetailsResponse {
  [appid: string]: {
    success?: unknown;
    data?: SteamAppDetails;
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

async function fetchOwnedGameDetails(appids: number[]) {
  const details = new Map<number, { type: string; fullGameAppId: number | null }>();
  await Promise.all(
    appids.map(async (appid) => {
      try {
        const params = new URLSearchParams({ appids: String(appid), filters: "basic" });
        const response = await fetch(
          `https://store.steampowered.com/api/appdetails?${params}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as SteamAppDetailsResponse;
        const app = payload[String(appid)];
        const fullGameAppId = app?.data?.fullgame?.appid;
        details.set(appid, {
          type: typeof app?.data?.type === "string" ? app.data.type : "",
          fullGameAppId:
            typeof fullGameAppId === "number" && Number.isInteger(fullGameAppId)
              ? fullGameAppId
              : null,
        });
      } catch {
        // A details failure must not prevent importing the owned-game list.
      }
    }),
  );
  return details;
}
