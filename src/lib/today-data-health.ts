import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface TodayDataHealth {
  activeBacklog: { started: number; total: number };
  rawgMetadata: { covered: number; total: number };
  recommendationProfile: { complete: number; total: number };
}

export const todayDataHealthGameSelect = {
  id: true,
  libraryEntry: {
    select: {
      playState: true,
      interest: true,
      priority: true,
      preferredEnvironment: true,
      gameExperience: true,
    },
  },
  metadataSnapshots: {
    where: { provider: "RAWG" },
    select: { id: true },
  },
} as const;

export type TodayDataHealthGameRow = Prisma.GameGetPayload<{
  select: typeof todayDataHealthGameSelect;
}>;

const ACTIVE_BACKLOG_STATES = ["NOT_STARTED", "IN_PROGRESS", "PLAYED_BEFORE"] as const;
const STARTED_STATES = ["IN_PROGRESS", "PLAYED_BEFORE"] as const;

export function computeActiveBacklogProgress(
  rows: readonly TodayDataHealthGameRow[],
): { started: number; total: number } {
  let total = 0;
  let started = 0;
  for (const row of rows) {
    const playState = row.libraryEntry?.playState;
    if (
      playState &&
      (ACTIVE_BACKLOG_STATES as readonly string[]).includes(playState)
    ) {
      total += 1;
      if ((STARTED_STATES as readonly string[]).includes(playState)) {
        started += 1;
      }
    }
  }
  return { started, total };
}

export function computeRawgCoverage(
  rows: readonly TodayDataHealthGameRow[],
): { covered: number; total: number } {
  return {
    covered: rows.filter((row) => row.metadataSnapshots.length > 0).length,
    total: rows.length,
  };
}

export function computeProfileCoverage(
  rows: readonly TodayDataHealthGameRow[],
): { complete: number; total: number } {
  let complete = 0;
  for (const row of rows) {
    const entry = row.libraryEntry;
    if (!entry) {
      continue;
    }
    const hasNonNonePriority =
      entry.priority !== null && entry.priority !== "NONE";
    const hasPreferredEnvironment = entry.preferredEnvironment !== null;
    const hasGameExperience = entry.gameExperience !== null;
    if (
      entry.interest !== null &&
      (hasNonNonePriority || hasPreferredEnvironment || hasGameExperience)
    ) {
      complete += 1;
    }
  }
  return { complete, total: rows.length };
}

export async function loadTodayDataHealth(
  client: Pick<Prisma.TransactionClient, "game"> = prisma,
): Promise<TodayDataHealth> {
  const rows = await client.game.findMany({
    where: {
      type: "BASE_GAME",
      libraryEntry: { is: { hidden: false } },
    },
    select: todayDataHealthGameSelect,
  });
  return {
    activeBacklog: computeActiveBacklogProgress(rows),
    rawgMetadata: computeRawgCoverage(rows),
    recommendationProfile: computeProfileCoverage(rows),
  };
}