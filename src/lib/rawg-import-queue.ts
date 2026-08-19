import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { rawgBatchSummary, type RawgBatchJobStatus } from "@/lib/rawg-batch";
import { initialRawgJobState, isActiveRawgJobStatus } from "@/lib/rawg-job";

export interface RawgImportQueueOutcome {
  batchId: string | null;
  queued: number;
  skipped: number;
}

interface EligibleRawgGame {
  id: string;
  metadataSnapshots: Array<{ id: string }>;
  enrichmentJobs: RawgBatchJobStatus[];
}

function normalizedGameIds(gameIds: readonly string[]): string[] {
  return [...new Set(gameIds.filter((gameId) => gameId.length > 0))];
}

function hasActiveRawgJob(game: EligibleRawgGame): boolean {
  return game.enrichmentJobs.some((job) => isActiveRawgJobStatus(job.status));
}

function queuedRawgJobData(syncRunId: string) {
  return {
    ...initialRawgJobState(),
    syncRunId,
    candidatePayload: Prisma.DbNull,
    selectedRawgId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
  };
}

export async function queueRawgForImportedGames(
  gameIds: readonly string[],
): Promise<RawgImportQueueOutcome> {
  const uniqueIds = normalizedGameIds(gameIds);
  if (uniqueIds.length === 0) {
    return { batchId: null, queued: 0, skipped: 0 };
  }

  return prisma.$transaction(async (tx) => {
    const games = await tx.game.findMany({
      where: {
        id: { in: uniqueIds },
        type: "BASE_GAME",
        libraryEntry: { isNot: null },
      },
      select: {
        id: true,
        metadataSnapshots: {
          where: { provider: "RAWG" },
          select: { id: true },
        },
        enrichmentJobs: {
          where: { provider: "RAWG" },
          select: { status: true },
        },
      },
    });
    const eligible = games.filter(
      (game) => game.metadataSnapshots.length === 0 && !hasActiveRawgJob(game),
    );

    if (eligible.length === 0) {
      return { batchId: null, queued: 0, skipped: uniqueIds.length };
    }

    const activeBatch = await tx.syncRun.findFirst({
      where: { provider: "RAWG", status: "RUNNING" },
      select: { id: true },
    });
    const batch = activeBatch ?? await tx.syncRun.create({
      data: {
        provider: "RAWG",
        status: "RUNNING",
        counts: rawgBatchSummary([]).counts as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    for (const game of eligible) {
      await tx.enrichmentJob.upsert({
        where: { gameId_provider: { gameId: game.id, provider: "RAWG" } },
        create: {
          gameId: game.id,
          provider: "RAWG",
          ...queuedRawgJobData(batch.id),
        },
        update: queuedRawgJobData(batch.id),
      });
    }

    const batchJobs = await tx.enrichmentJob.findMany({
      where: { syncRunId: batch.id, provider: "RAWG" },
      select: { status: true },
    });
    const summary = rawgBatchSummary(batchJobs);
    await tx.syncRun.update({
      where: { id: batch.id },
      data: {
        status: summary.status,
        counts: summary.counts as Prisma.InputJsonValue,
        finishedAt: null,
      },
    });

    return {
      batchId: batch.id,
      queued: eligible.length,
      skipped: uniqueIds.length - eligible.length,
    };
  });
}
