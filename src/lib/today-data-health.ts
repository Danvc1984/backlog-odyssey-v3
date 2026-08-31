import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface TodayDataHealth {
  activeBacklog: {
    playedBefore: number;
    inProgress: number;
    notStarted: number;
    total: number;
  };
  abandoned: number;
  rawgMetadata: { covered: number; total: number; missing: CoverageTitle[] };
  recommendationProfile: {
    complete: number;
    total: number;
    incomplete: CoverageTitle[];
  };
}

export interface CoverageTitle {
  id: string;
  name: string;
}

export const todayDataHealthGameSelect = {
  id: true,
  name: true,
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
const COVERAGE_TITLE_ORDER = (left: CoverageTitle, right: CoverageTitle) =>
  left.name.toLowerCase().localeCompare(right.name.toLowerCase());

export function computeActiveBacklogProgress(
  rows: readonly TodayDataHealthGameRow[],
): { playedBefore: number; inProgress: number; notStarted: number; total: number } {
  const counts = { playedBefore: 0, inProgress: 0, notStarted: 0, total: 0 };
  for (const row of rows) {
    const playState = row.libraryEntry?.playState;
    if (!playState || !(ACTIVE_BACKLOG_STATES as readonly string[]).includes(playState)) {
      continue;
    }
    counts.total += 1;
    if (playState === "PLAYED_BEFORE") counts.playedBefore += 1;
    if (playState === "IN_PROGRESS") counts.inProgress += 1;
    if (playState === "NOT_STARTED") counts.notStarted += 1;
  }
  return counts;
}

export function computeAbandonedCount(rows: readonly TodayDataHealthGameRow[]): number {
  return rows.filter((row) => row.libraryEntry?.playState === "ABANDONED").length;
}

export function computeRawgCoverage(
  rows: readonly TodayDataHealthGameRow[],
): { covered: number; total: number; missing: CoverageTitle[] } {
  const missing = rows
    .filter((row) => row.metadataSnapshots.length === 0)
    .map(({ id, name }) => ({ id, name }))
    .sort(COVERAGE_TITLE_ORDER);
  return {
    covered: rows.filter((row) => row.metadataSnapshots.length > 0).length,
    total: rows.length,
    missing,
  };
}

export function computeProfileCoverage(
  rows: readonly TodayDataHealthGameRow[],
): { complete: number; total: number; incomplete: CoverageTitle[] } {
  let complete = 0;
  const incomplete: CoverageTitle[] = [];
  for (const row of rows) {
    const entry = row.libraryEntry;
    if (!entry) {
      incomplete.push({ id: row.id, name: row.name });
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
    } else {
      incomplete.push({ id: row.id, name: row.name });
    }
  }
  return { complete, total: rows.length, incomplete: incomplete.sort(COVERAGE_TITLE_ORDER) };
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
    abandoned: computeAbandonedCount(rows),
    rawgMetadata: computeRawgCoverage(rows),
    recommendationProfile: computeProfileCoverage(rows),
  };
}
