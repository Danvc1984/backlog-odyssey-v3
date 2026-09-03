"use server";

import { friendlyActionError } from "@/lib/action-error";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { compatBatchSummary } from "@/lib/compat-batch";
import { COMPAT_JOB_MAX_ATTEMPTS, isActiveCompatJobStatus } from "@/lib/compat-job";
import { isCompatEligible } from "@/lib/compat-queue";
import { startProviderEnrichmentBatch } from "@/lib/enrichment-batch-start";

const startCompatibilitySweepSchema = z.object({}).strict();

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

export async function startCompatibilitySweep(input: unknown) {
  try {
    await requireUser();
    const parsed = startCompatibilitySweepSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await startProviderEnrichmentBatch({
      provider: "PROTONDB",
      getGames: (tx) => tx.game.findMany({
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
      }),
      getEligibility: (games) => {
        const visibleGames = games.filter((game) => game.libraryEntry?.hidden !== true);
        const skippedActiveWork = visibleGames.filter(isActiveJob).length;
        const eligibleGames = visibleGames.filter((game) => !isActiveJob(game) && isCompatEligible(game));
        const skippedIneligible = visibleGames.length - skippedActiveWork - eligibleGames.length;
        return {
          eligibleGames,
          counts: {
            eligible: eligibleGames.length,
            queued: eligibleGames.length,
            skippedActiveWork,
            skippedIneligible,
          },
          noEligibleResult: eligibleGames.length === 0
            ? { kind: "NO_ELIGIBLE" as const, counts: { eligible: 0, queued: 0, skippedActiveWork, skippedIneligible } }
            : undefined,
        };
      },
      summarize: (games) => compatBatchSummary(games.map(() => ({ status: "QUEUED" as const }))),
      queuedJobData: queuedCompatJobData,
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
      error: friendlyActionError(error, "Failed to queue compatibility sweep"),
    };
  }
}
