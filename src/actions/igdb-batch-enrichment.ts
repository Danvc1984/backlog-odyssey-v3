"use server";

import { Prisma } from "@/generated/prisma/client";
import { friendlyActionError } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guard";
import { startProviderEnrichmentBatch } from "@/lib/enrichment-batch-start";
import { initialIgdbJobState } from "@/lib/igdb-job";
import { igdbBatchSummary } from "@/lib/igdb-batch-runner";
import { getIgdbBatchEligibility, type EligibleGame } from "@/lib/igdb-batch-eligibility";
import { z } from "zod";

const schema = z.object({}).strict();

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
        select: { id: true, metadataSnapshots: { where: { provider: "IGDB" }, select: { id: true } }, playtimeEvidence: { select: { id: true } }, enrichmentJobs: { where: { provider: "IGDB" }, select: { status: true } } },
      }),
      getEligibility: (games: EligibleGame[]) => getIgdbBatchEligibility(games),
      summarize: (games) => igdbBatchSummary(games.map(() => ({ status: "QUEUED" as const }))),
      queuedJobData,
      buildResult: (batch, eligibility) => ({ kind: "BATCH" as const, batchId: batch.id, status: batch.status, counts: eligibility.counts }),
    });
    return { success: true as const, data: result, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to queue IGDB catalog enrichment") };
  }
}
