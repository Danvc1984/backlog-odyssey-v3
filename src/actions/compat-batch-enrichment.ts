"use server";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { compatBatchSummary } from "@/lib/compat-batch";
import { COMPAT_JOB_MAX_ATTEMPTS, isActiveCompatJobStatus } from "@/lib/compat-job";
import { isCompatEligible } from "@/lib/compat-queue";
import { prisma } from "@/lib/prisma";

const startCompatibilitySweepSchema = z.object({}).strict();

const activeBatchSelect = {
  id: true,
  status: true,
} as const;

interface SweepGame {
  id: string;
  libraryEntry: { id: string; hidden: boolean } | null;
  externalIds: Array<{ namespace: string }>;
  availability: Array<{ source: string }>;
  enrichmentJobs: Array<{ status: "QUEUED" | "RUNNING" | "RETRY_WAIT" | "SUCCEEDED" | "FAILED" | "AWAITING_MATCH" }>;
}

function queuedCompatJobData(syncRunId: string) {
  return {
    syncRunId,
    status: "QUEUED" as const,
    stage: "MATCHING" as const,
    attempt: 0,
    maxAttempts: COMPAT_JOB_MAX_ATTEMPTS,
    progress: 0,
    nextAttemptAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
  };
}

function isActiveJob(game: SweepGame): boolean {
  return game.enrichmentJobs.some((job) => isActiveCompatJobStatus(job.status));
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function startCompatibilitySweep(input: unknown) {
  try {
    await requireUser();
    const parsed = startCompatibilitySweepSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const activeBatch = await tx.syncRun.findFirst({
        where: { provider: "PROTONDB", status: "RUNNING" },
        select: activeBatchSelect,
      });
      if (activeBatch) {
        return {
          kind: "ACTIVE_BATCH" as const,
          batchId: activeBatch.id,
          status: activeBatch.status,
        };
      }

      const games = await tx.game.findMany({
        where: { type: "BASE_GAME", libraryEntry: { is: { hidden: false } } },
        select: {
          id: true,
          libraryEntry: { select: { id: true, hidden: true } },
          externalIds: {
            where: { namespace: "STEAM_APP" as const },
            select: { namespace: true },
          },
          availability: { select: { source: true } },
          enrichmentJobs: {
            where: { provider: "PROTONDB" as const },
            select: { status: true },
          },
        },
      });

      const visibleGames = games.filter((game) => game.libraryEntry?.hidden !== true);
      const skippedActiveWork = visibleGames.filter(isActiveJob).length;
      const eligibleGames = visibleGames.filter((game) => !isActiveJob(game) && isCompatEligible(game));
      const skippedIneligible = visibleGames.length - skippedActiveWork - eligibleGames.length;
      if (eligibleGames.length === 0) {
        return {
          kind: "NO_ELIGIBLE" as const,
          counts: { eligible: 0, queued: 0, skippedActiveWork, skippedIneligible },
        };
      }

      const summary = compatBatchSummary(eligibleGames.map(() => ({ status: "QUEUED" as const })));

      const batch = await tx.syncRun.create({
        data: {
          provider: "PROTONDB",
          status: summary.status,
          counts: { ...summary.counts } as Prisma.InputJsonObject,
          finishedAt: summary.isTerminal ? new Date() : null,
        },
        select: activeBatchSelect,
      });

      for (const game of eligibleGames) {
        await tx.enrichmentJob.upsert({
          where: { gameId_provider: { gameId: game.id, provider: "PROTONDB" } },
          create: {
            gameId: game.id,
            provider: "PROTONDB",
            ...queuedCompatJobData(batch.id),
          },
          update: queuedCompatJobData(batch.id),
        });
      }

      return {
        kind: "BATCH" as const,
        batchId: batch.id,
        status: batch.status,
        counts: {
          eligible: eligibleGames.length,
          queued: eligibleGames.length,
          skippedActiveWork,
          skippedIneligible,
        },
      };
    });

    return { success: true as const, data: result, error: null };
  } catch (error) {
    if (isUniqueConstraint(error)) {
      const activeBatch = await prisma.syncRun.findFirst({
        where: { provider: "PROTONDB", status: "RUNNING" },
        select: activeBatchSelect,
      });
      if (activeBatch) {
        return {
          success: true as const,
          data: { kind: "ACTIVE_BATCH" as const, batchId: activeBatch.id, status: activeBatch.status },
          error: null,
        };
      }
    }

    return {
      success: false as const,
      data: null,
      error: error instanceof Error ? error.message : "Failed to queue compatibility sweep",
    };
  }
}
