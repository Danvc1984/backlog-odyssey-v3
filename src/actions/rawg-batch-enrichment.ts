"use server";

import { Prisma } from "@/generated/prisma/client";
import { friendlyActionError } from "@/lib/action-error";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { startProviderEnrichmentBatch } from "@/lib/enrichment-batch-start";
import { initialRawgJobState, isActiveRawgJobStatus } from "@/lib/rawg-job";
import { rawgBatchSummary, type RawgBatchJobStatus } from "@/lib/rawg-batch";

const startRawgCatalogEnrichmentSchema = z.object({}).strict();

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

export async function startRawgCatalogEnrichment(input: unknown) {
  try {
    await requireUser();
    const parsed = startRawgCatalogEnrichmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await startProviderEnrichmentBatch({
      provider: "RAWG",
      getGames: (tx) => tx.game.findMany({
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
      }),
      getEligibility: (games) => {
        const withExistingMetadata = games.filter((game) => game.metadataSnapshots.length > 0);
        const withoutMetadata = games.filter((game) => game.metadataSnapshots.length === 0);
        const withActiveWork = withoutMetadata.filter(activeJob);
        const eligibleGames = withoutMetadata.filter((game) => !activeJob(game));
        return {
          eligibleGames,
          counts: {
            eligible: eligibleGames.length,
            queued: eligibleGames.length,
            skippedExistingMetadata: withExistingMetadata.length,
            skippedActiveWork: withActiveWork.length,
          },
        };
      },
      summarize: (games) => rawgBatchSummary(games.map(() => ({ status: "QUEUED" as const }))),
      queuedJobData: queuedRawgJobData,
      buildResult: (batch, eligibility) => ({
        kind: "BATCH" as const,
        batchId: batch.id,
        status: batch.status,
        counts: eligibility.counts,
      }),
    });

    return { success: true as const, data: result, error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error:
        friendlyActionError(error, "Failed to queue RAWG catalog enrichment"),
    };
  }
}
