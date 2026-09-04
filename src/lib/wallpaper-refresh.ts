import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import {
  WALLPAPER_POOL_SIZE,
  WALLPAPER_QUERY_VERSION,
  buildSearchPlan,
  isPoolStale,
  isWallpaperRefreshThrottled,
  type WallpaperFreshnessState,
  type WallpaperGameReference,
  type WallpaperPool,
  type WallpaperSearchTerm,
} from "./wallpaper";
import { searchWallhaven, type WallhavenProviderError } from "./wallhaven-api";

export type WallpaperRefreshStatus = "REFRESHED" | "SKIPPED" | "THROTTLED" | "FAILED";

export interface WallpaperRefreshResult {
  success: boolean;
  status: WallpaperRefreshStatus;
  searched: WallpaperSearchTerm[];
  itemCount: number;
  error: string | null;
}

interface WallpaperCatalogRow {
  id: string;
  name: string;
  libraryEntry: { isMainGame: boolean; playState: string } | null;
}

interface WallpaperStateRow extends WallpaperFreshnessState {
  id: number;
}

interface TermOutcome {
  searched: WallpaperSearchTerm[];
  items: WallpaperPool["items"];
  diagnostics: string[];
  hadSuccessfulResponse: boolean;
}

let inFlightRefresh: Promise<WallpaperRefreshResult> | null = null;

export function refreshWallpaperPool(now = new Date()): Promise<WallpaperRefreshResult> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const refresh = runWallpaperRefresh(now);
  inFlightRefresh = refresh.finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function runWallpaperRefresh(now: Date): Promise<WallpaperRefreshResult> {
  let state: WallpaperStateRow | null = null;
  try {
    state = await prisma.wallpaperState.findUnique({ where: { id: 1 } });
    const games = await loadWallpaperGames();
    const plan = buildSearchPlan(games.mainGame, games.inProgressGames);

    if (!isPoolStale(state, plan, now)) {
      return {
        success: true,
        status: state && isWallpaperRefreshThrottled(state.lastAttemptAt, now)
          ? "THROTTLED"
          : "SKIPPED",
        searched: [],
        itemCount: 0,
        error: null,
      };
    }

    await markAttempt(now);
    const outcome = await searchTerms(plan);
    if (plan.length > 0 && !outcome.hadSuccessfulResponse) {
      const error = formatDiagnostics(outcome.diagnostics) ?? "Wallhaven refresh failed";
      await recordError(now, error);
      return { success: false, status: "FAILED", searched: outcome.searched, itemCount: 0, error };
    }

    const candidates: WallpaperPool = {
      queryVersion: WALLPAPER_QUERY_VERSION,
      fetchedAt: now.toISOString(),
      searched: outcome.searched,
      items: outcome.items,
    };
    const error = formatDiagnostics(outcome.diagnostics);
    await prisma.wallpaperState.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        candidates: candidates as unknown as Prisma.InputJsonValue,
        cachedAt: now,
        lastAttemptAt: now,
        lastError: error,
      },
      update: {
        candidates: candidates as unknown as Prisma.InputJsonValue,
        cachedAt: now,
        lastError: error,
      },
    });
    return { success: true, status: "REFRESHED", searched: outcome.searched, itemCount: outcome.items.length, error };
  } catch {
    const error = "Wallhaven refresh failed";
    await recordError(now, error).catch(() => undefined);
    return { success: false, status: "FAILED", searched: [], itemCount: 0, error };
  }
}

async function loadWallpaperGames(): Promise<{
  mainGame: WallpaperGameReference | null;
  inProgressGames: WallpaperGameReference[];
}> {
  const rows = (await prisma.game.findMany({
    where: {
      type: "BASE_GAME",
      libraryEntry: {
        is: {
          hidden: false,
          OR: [{ isMainGame: true }, { playState: "IN_PROGRESS" }],
        },
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      libraryEntry: { select: { isMainGame: true, playState: true } },
    },
  })) as WallpaperCatalogRow[];

  const mainGame = rows.find((row) => row.libraryEntry?.isMainGame === true) ?? null;
  return {
    mainGame: mainGame ? { id: mainGame.id, name: mainGame.name } : null,
    inProgressGames: rows
      .filter((row) => row.libraryEntry?.playState === "IN_PROGRESS")
      .map(({ id, name }) => ({ id, name })),
  };
}

async function markAttempt(now: Date): Promise<void> {
  await prisma.wallpaperState.upsert({
    where: { id: 1 },
    create: { id: 1, lastAttemptAt: now },
    update: { lastAttemptAt: now },
  });
}

async function searchTerms(plan: readonly WallpaperSearchTerm[]): Promise<TermOutcome> {
  const searched: WallpaperSearchTerm[] = [];
  const diagnostics: string[] = [];
  const resultBuckets: WallpaperPool["items"][] = [];
  let hadSuccessfulResponse = false;

  for (const term of plan) {
    searched.push(term);
    let result;
    try {
      result = await searchWallhaven(term.name);
    } catch {
      result = {
        ok: false as const,
        error: { category: "NETWORK" as const, message: "Wallhaven could not be reached" },
      };
    }

    if (!result.ok) {
      diagnostics.push(formatProviderError(term, result.error));
      continue;
    }
    hadSuccessfulResponse = true;
    if (result.items.length === 0) {
      diagnostics.push(`${term.name}: no results`);
      continue;
    }
    resultBuckets.push(result.items);
  }

  const byId = new Map<string, WallpaperPool["items"][number]>();
  for (let resultIndex = 0; byId.size < WALLPAPER_POOL_SIZE; resultIndex += 1) {
    let addedItem = false;
    for (const bucket of resultBuckets) {
      const item = bucket[resultIndex];
      if (!item || byId.has(item.id)) {
        continue;
      }
      byId.set(item.id, item);
      addedItem = true;
      if (byId.size >= WALLPAPER_POOL_SIZE) {
        break;
      }
    }
    if (!addedItem) {
      break;
    }
  }

  return {
    searched,
    items: [...byId.values()],
    diagnostics,
    hadSuccessfulResponse,
  };
}

function formatProviderError(term: WallpaperSearchTerm, error: WallhavenProviderError): string {
  return `${term.name}: ${error.category}`;
}

function formatDiagnostics(diagnostics: readonly string[]): string | null {
  return diagnostics.length > 0 ? diagnostics.join("; ") : null;
}

async function recordError(now: Date, error: string): Promise<void> {
  await prisma.wallpaperState.upsert({
    where: { id: 1 },
    create: { id: 1, lastAttemptAt: now, lastError: error },
    update: { lastAttemptAt: now, lastError: error },
  });
}
