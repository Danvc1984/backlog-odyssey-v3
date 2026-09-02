"use server";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { initialRawgJobState, isActiveRawgJobStatus } from "@/lib/rawg-job";
import { rawgBatchSummary, type RawgBatchJobStatus } from "@/lib/rawg-batch";

const startRawgCatalogEnrichmentSchema = z.object({}).strict();

const activeRawgBatchSelect = {
  id: true,
  status: true,
} as const;

interface EligibleRawgGame {
  id: string;
  metadataSnapshots: Array<{ id: string }>;
  enrichmentJobs: RawgBatchJobStatus[];
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

function activeJob(game: EligibleRawgGame): boolean {
  return game.enrichmentJobs.some((job) => isActiveRawgJobStatus(job.status));
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function startRawgCatalogEnrichment(input: unknown) {
  try {
    await requireUser();
    const parsed = startRawgCatalogEnrichmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const activeBatch = await tx.syncRun.findFirst({
        where: { provider: "RAWG", status: "RUNNING" },
        select: activeRawgBatchSelect,
      });
      if (activeBatch) {
        return {
          kind: "ACTIVE_BATCH" as const,
          batchId: activeBatch.id,
          status: activeBatch.status,
        };
      }

      const games = await tx.game.findMany({
        where: {
          type: "BASE_GAME",
          libraryEntry: { is: { hidden: false } },
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

      const withExistingMetadata = games.filter(
        (game) => game.metadataSnapshots.length > 0,
      );
      const withoutMetadata = games.filter(
        (game) => game.metadataSnapshots.length === 0,
      );
      const withActiveWork = withoutMetadata.filter(activeJob);
      const eligible = withoutMetadata.filter((game) => !activeJob(game));
      const summary = rawgBatchSummary(
        eligible.map(() => ({ status: "QUEUED" as const })),
      );
      const batch = await tx.syncRun.create({
        data: {
          provider: "RAWG",
          status: summary.status,
          counts: summary.counts as Prisma.InputJsonValue,
          finishedAt: summary.isTerminal ? new Date() : null,
        },
        select: activeRawgBatchSelect,
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

      return {
        kind: "BATCH" as const,
        batchId: batch.id,
        status: batch.status,
        counts: {
          eligible: eligible.length,
          queued: eligible.length,
          skippedExistingMetadata: withExistingMetadata.length,
          skippedActiveWork: withActiveWork.length,
        },
      };
    });

    return { success: true as const, data: result, error: null };
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const activeBatch = await prisma.syncRun.findFirst({
        where: { provider: "RAWG", status: "RUNNING" },
        select: activeRawgBatchSelect,
      });
      if (activeBatch) {
        return {
          success: true as const,
          data: {
            kind: "ACTIVE_BATCH" as const,
            batchId: activeBatch.id,
            status: activeBatch.status,
          },
          error: null,
        };
      }
    }

    return {
      success: false as const,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to queue RAWG catalog enrichment",
    };
  }
}
