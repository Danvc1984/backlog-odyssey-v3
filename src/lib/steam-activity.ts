import "server-only";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSteamFlowContext } from "@/lib/steam-flow";
import { fetchRecentlyPlayedGames } from "@/lib/steam-api";

export interface SteamActivityEntry {
  steamAppId: string;
  name: string;
  lastPlayedAt: string | null;
  playtimeForeverMinutes: number;
  playtimeTwoWeeksMinutes: number | null;
}

export type SteamActivityViewState =
  | "NO_CONNECTION"
  | "FRESH"
  | "FRESH_EMPTY"
  | "STALE_ERROR";

export interface SteamActivityView {
  state: SteamActivityViewState;
  imported: SteamActivityEntry[];
  unimported: SteamActivityEntry[];
  checkedAt: Date | null;
  errorMessage: string | null;
}

export interface SteamActivityCacheRow {
  entries: unknown;
  refreshedAt: Date | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
}

export const ACTIVITY_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const RECENT_ACTIVITY_MAX_ENTRIES = 10;

export const ACTIVITY_UNAVAILABLE_MESSAGE =
  "Steam activity could not be refreshed right now.";

const storedEntrySchema = z.object({
  steamAppId: z.string(),
  name: z.string(),
  lastPlayedAt: z.string().nullable(),
  playtimeForeverMinutes: z.number(),
  playtimeTwoWeeksMinutes: z.number().nullable(),
});

export function readRecentEntries(value: unknown): SteamActivityEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((row) => {
    const parsed = storedEntrySchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

export function isActivityRefreshDue(
  cache: { lastAttemptAt: Date | null } | null,
  now: Date,
): boolean {
  if (!cache?.lastAttemptAt) {
    return true;
  }
  return now.getTime() - cache.lastAttemptAt.getTime() >= ACTIVITY_REFRESH_INTERVAL_MS;
}

export function capRecentEntries(entries: SteamActivityEntry[]): SteamActivityEntry[] {
  const byAppId = new Map<string, SteamActivityEntry>();
  for (const entry of entries) {
    if (!byAppId.has(entry.steamAppId)) {
      byAppId.set(entry.steamAppId, entry);
    }
  }
  return [...byAppId.values()]
    .sort((left, right) => {
      const leftTime = parseLastPlayed(left.lastPlayedAt);
      const rightTime = parseLastPlayed(right.lastPlayedAt);
      if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      if (leftTime === null && rightTime !== null) {
        return 1;
      }
      if (leftTime !== null && rightTime === null) {
        return -1;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, RECENT_ACTIVITY_MAX_ENTRIES);
}

function parseLastPlayed(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function classifyRecentEntries(
  entries: SteamActivityEntry[],
  importedAppIds: ReadonlySet<string>,
): { imported: SteamActivityEntry[]; unimported: SteamActivityEntry[] } {
  const imported: SteamActivityEntry[] = [];
  const unimported: SteamActivityEntry[] = [];
  for (const entry of entries) {
    if (importedAppIds.has(entry.steamAppId)) {
      imported.push(entry);
    } else {
      unimported.push(entry);
    }
  }
  return { imported, unimported };
}

export function buildSteamActivityView(
  cache: SteamActivityCacheRow | null,
  importedAppIds: ReadonlySet<string>,
): SteamActivityView {
  if (!cache) {
    return {
      state: "NO_CONNECTION",
      imported: [],
      unimported: [],
      checkedAt: null,
      errorMessage: null,
    };
  }
  const entries = readRecentEntries(cache.entries);
  const { imported, unimported } = classifyRecentEntries(entries, importedAppIds);
  if (cache.lastError) {
    return {
      state: "STALE_ERROR",
      imported,
      unimported,
      checkedAt: cache.refreshedAt,
      errorMessage: cache.lastError,
    };
  }
  return {
    state: entries.length === 0 ? "FRESH_EMPTY" : "FRESH",
    imported,
    unimported,
    checkedAt: cache.refreshedAt,
    errorMessage: null,
  };
}

export async function refreshSteamActivityCacheIfStale(
  now = new Date(),
): Promise<SteamActivityView> {
  try {
    const context = await requireSteamFlowContext();
    if (!context.ok) {
      return buildSteamActivityView(null, new Set());
    }

    const cached = await prisma.steamRecentActivityCache.findUnique({ where: { id: 1 } });
    if (isActivityRefreshDue(cached, now)) {
      await prisma.steamRecentActivityCache.upsert({
        where: { id: 1 },
        create: { id: 1, lastAttemptAt: now },
        update: { lastAttemptAt: now },
      });

      const result = await fetchRecentlyPlayedGames(context.steamId64, context.apiKey);
      if (result.status === "OK") {
        const entries = capRecentEntries(result.games) as unknown as Prisma.InputJsonValue;
        await prisma.steamRecentActivityCache.upsert({
          where: { id: 1 },
          create: { id: 1, entries, refreshedAt: now, lastAttemptAt: now, lastError: null },
          update: { entries, refreshedAt: now, lastError: null },
        });
      } else {
        await prisma.steamRecentActivityCache.upsert({
          where: { id: 1 },
          create: { id: 1, lastAttemptAt: now, lastError: ACTIVITY_UNAVAILABLE_MESSAGE },
          update: { lastError: ACTIVITY_UNAVAILABLE_MESSAGE },
        });
      }
    }

    const updated = await prisma.steamRecentActivityCache.findUnique({ where: { id: 1 } });
    const imported = await loadImportedSteamAppIds(updated?.entries ?? null);
    return buildSteamActivityView(updated, imported);
  } catch {
    const cached = await prisma.steamRecentActivityCache
      .findUnique({ where: { id: 1 } })
      .catch(() => null);
    const imported = await loadImportedSteamAppIds(cached?.entries ?? null).catch(
      () => new Set<string>(),
    );
    return buildSteamActivityView(cached, imported);
  }
}

async function loadImportedSteamAppIds(entries: unknown): Promise<Set<string>> {
  const appIds = [
    ...new Set(readRecentEntries(entries).map((entry) => entry.steamAppId)),
  ];
  if (appIds.length === 0) {
    return new Set();
  }
  const rows = await prisma.externalGameId.findMany({
    where: { namespace: "STEAM_APP", externalId: { in: appIds } },
    select: { externalId: true },
  });
  return new Set(rows.map((row) => row.externalId));
}