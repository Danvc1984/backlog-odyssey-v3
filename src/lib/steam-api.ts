const OWNED_GAMES_ENDPOINT =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/";

export interface OwnedGame {
  appid: number;
  name: string;
  playtimeForever: number;
  rtimeLastPlayed: number;
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

    return games.flatMap((game) => {
      const normalized = normalizeGame(game);
      return normalized ? [normalized] : [];
    });
  } catch {
    return [];
  }
}
