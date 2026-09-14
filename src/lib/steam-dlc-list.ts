import "server-only";

import { requestIgdb } from "@/lib/igdb-api";
import { IGDB_STEAM_EXTERNAL_SOURCE } from "@/lib/igdb-types";

const STEAM_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";
const REQUEST_TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;
const IGDB_BATCH_SIZE = 500;

export type DlcNameResolution = "IGDB" | "STEAM" | "APP_ID";

export interface SteamDlcCandidate {
  steamAppId: string;
  name: string;
  resolvedVia: DlcNameResolution;
  igdbId: number | null;
}

export type SteamDlcListResult =
  | { status: "OK"; candidates: SteamDlcCandidate[] }
  | { status: "EMPTY"; candidates: [] };

interface SteamAppDetails {
  name?: unknown;
  dlc?: unknown;
}

interface SteamAppDetailsResponse {
  [appid: string]: {
    success?: unknown;
    data?: SteamAppDetails;
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseAppDetails(value: unknown): SteamAppDetails | null {
  if (!value || typeof value !== "object") return null;
  const row = value as SteamAppDetailsResponse[string];
  return row && typeof row.data === "object" && row.data !== null ? row.data : null;
}

async function fetchWithTimeout(fetchFn: typeof fetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchFn(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBasicAppDetails(
  steamAppId: string,
  fetchFn: typeof fetch,
): Promise<SteamAppDetails | null> {
  try {
    const params = new URLSearchParams({ appids: steamAppId, filters: "basic" });
    const response = await fetchWithTimeout(fetchFn, `${STEAM_APPDETAILS_URL}?${params}`);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return parseAppDetails(payload && typeof payload === "object" ? (payload as Record<string, unknown>)[steamAppId] : null);
  } catch {
    return null;
  }
}

async function resolveNamesFromIgdb(
  appIds: readonly string[],
  fetchFn: typeof fetch,
): Promise<Map<string, { name: string; igdbId: number | null }>> {
  const resolved = new Map<string, { name: string; igdbId: number | null }>();
  for (let offset = 0; offset < appIds.length; offset += IGDB_BATCH_SIZE) {
    const batch = appIds.slice(offset, offset + IGDB_BATCH_SIZE);
    const result = await requestIgdb(
      `fields game,uid; where uid = (${batch.map((id) => `"${id}"`).join(",")}) & external_game_source = ${IGDB_STEAM_EXTERNAL_SOURCE}; limit ${IGDB_BATCH_SIZE};`,
      { endpoint: "external_games", fetchFn },
    );
    if (!result.ok || !Array.isArray(result.data)) continue;

    const gameIds = [...new Set(result.data.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const game = (row as { game?: unknown }).game;
      return isPositiveInteger(game) ? [game] : [];
    }))];
    if (gameIds.length === 0) continue;

    const games = await requestIgdb(
      `fields id,name; where id = (${gameIds.join(",")}); limit ${gameIds.length};`,
      { endpoint: "games", fetchFn },
    );
    if (!games.ok || !Array.isArray(games.data)) continue;
    const namesByGameId = new Map<number, string>();
    for (const row of games.data) {
      if (!row || typeof row !== "object") continue;
      const gameId = (row as { id?: unknown }).id;
      const name = (row as { name?: unknown }).name;
      if (isPositiveInteger(gameId) && typeof name === "string" && name.trim()) {
        namesByGameId.set(gameId, name.trim());
      }
    }
    const gameIdsByAppId = new Map<string, number[]>();
    for (const row of result.data) {
      if (!row || typeof row !== "object") continue;
      const uid = (row as { uid?: unknown }).uid;
      const game = (row as { game?: unknown }).game;
      const appId = typeof uid === "string" && /^\d+$/.test(uid)
        ? uid
        : typeof uid === "number" && isPositiveInteger(uid)
          ? String(uid)
          : null;
      if (appId && isPositiveInteger(game)) {
        const ids = gameIdsByAppId.get(appId) ?? [];
        ids.push(game);
        gameIdsByAppId.set(appId, ids);
      }
    }
    for (const [appId, rawGameIds] of gameIdsByAppId) {
      const gameIds = [...new Set(rawGameIds)];
      const name = gameIds.map((gameId) => namesByGameId.get(gameId)).find((value): value is string => value !== undefined);
      if (name) resolved.set(appId, { name, igdbId: gameIds.length === 1 ? gameIds[0] : null });
    }
  }
  return resolved;
}

async function resolveSteamNames(
  appIds: readonly string[],
  fetchFn: typeof fetch,
): Promise<Map<string, { name: string; resolvedVia: DlcNameResolution; igdbId: number | null }>> {
  const result = new Map<string, { name: string; resolvedVia: DlcNameResolution; igdbId: number | null }>();
  const igdbNames = await resolveNamesFromIgdb(appIds, fetchFn);
  for (const [appId, match] of igdbNames) result.set(appId, { ...match, resolvedVia: "IGDB" });

  for (let offset = 0; offset < appIds.length; offset += CONCURRENCY) {
    await Promise.all(appIds.slice(offset, offset + CONCURRENCY).map(async (appId) => {
      if (result.has(appId)) return;
      const details = await fetchBasicAppDetails(appId, fetchFn);
      const name = details?.name;
      result.set(appId, {
        name: typeof name === "string" && name.trim() ? name.trim() : appId,
        resolvedVia: typeof name === "string" && name.trim() ? "STEAM" : "APP_ID",
        igdbId: null,
      });
    }));
  }
  return result;
}

export async function fetchSteamDlcList(
  baseSteamAppId: string,
  fetchFn: typeof fetch = fetch,
): Promise<SteamDlcListResult> {
  if (!/^\d+$/.test(baseSteamAppId)) return { status: "EMPTY", candidates: [] };
  const details = await fetchBasicAppDetails(baseSteamAppId, fetchFn);
  const rawDlc = details?.dlc;
  if (!Array.isArray(rawDlc)) return { status: "EMPTY", candidates: [] };
  const appIds = [...new Set(rawDlc.filter(isPositiveInteger).map(String))];
  if (appIds.length === 0) return { status: "EMPTY", candidates: [] };
  const names = await resolveSteamNames(appIds, fetchFn);
  return {
    status: "OK",
    candidates: appIds.map((steamAppId) => ({
      steamAppId,
      name: names.get(steamAppId)?.name ?? steamAppId,
      resolvedVia: names.get(steamAppId)?.resolvedVia ?? "APP_ID",
      igdbId: names.get(steamAppId)?.igdbId ?? null,
    })),
  };
}
