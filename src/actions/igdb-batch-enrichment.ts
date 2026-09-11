"use server";

import { Prisma } from "@/generated/prisma/client";
import { friendlyActionError } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guard";
import { startProviderEnrichmentBatch } from "@/lib/enrichment-batch-start";
import { initialIgdbJobState, isActiveIgdbJobStatus } from "@/lib/igdb-job";
import { igdbBatchSummary, type IgdbBatchJobStatus } from "@/lib/igdb-batch-runner";
import { z } from "zod";

const schema = z.object({}).strict();
type EligibleGame = { id: string; metadataSnapshots: { id: string }[]; enrichmentJobs: IgdbBatchJobStatus[] };

function queuedJobData(syncRunId: string) {
  return { ...initialIgdbJobState(), syncRunId, candidatePayload: Prisma.DbNull, selectedIgdbId: null, lastErrorCode: null, lastErrorMessage: null, startedAt: null, finishedAt: null };
}

export async function startIgdbCatalogEnrichment(input: unknown) {
  try {
    await requireUser();
    if (!schema.safeParse(input).success) return { success: false as const, data: null, error: "Invalid input" };
    const result = await startProviderEnrichmentBatch({
      provider: "IGDB",
      getGames: (tx) => tx.game.findMany({
        where: { type: "BASE_GAME", libraryEntry: { is: { hidden: false } } },
        select: { id: true, metadataSnapshots: { where: { provider: "IGDB" }, select: { id: true } }, enrichmentJobs: { where: { provider: "IGDB" }, select: { status: true } } },
      }),
      getEligibility: (games: EligibleGame[]) => {
        const withoutMetadata = games.filter((game) => game.metadataSnapshots.length === 0);
        const eligibleGames = withoutMetadata.filter((game) => !game.enrichmentJobs.some((job) => isActiveIgdbJobStatus(job.status)));
        return { eligibleGames, counts: { eligible: eligibleGames.length, queued: eligibleGames.length, skippedExistingMetadata: games.length - withoutMetadata.length, skippedActiveWork: withoutMetadata.length - eligibleGames.length } };
      },
      summarize: (games) => igdbBatchSummary(games.map(() => ({ status: "QUEUED" as const }))),
      queuedJobData,
      buildResult: (batch, eligibility) => ({ kind: "BATCH" as const, batchId: batch.id, status: batch.status, counts: eligibility.counts }),
    });
    return { success: true as const, data: result, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to queue IGDB catalog enrichment") };
  }
}
