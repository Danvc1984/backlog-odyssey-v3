import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { matchRawgGame } from "@/lib/rawg-api";
import { persistRawgMatch } from "@/lib/rawg-enrichment";
import { queueCompatibilityForGame } from "@/lib/compat-queue";
import {
  RAWG_JOB_MAX_ATTEMPTS,
  rawgJobProgress,
} from "@/lib/rawg-job";
import {
  rawgJobSelect,
  toRawgEnrichmentJobView,
  type RawgEnrichmentJobView,
  type RawgJobRecord,
} from "@/lib/rawg-job-view";
import type { RawgProviderError } from "@/lib/rawg-types";
import {
  isRetryableJobProviderError,
  jobClaimWhere,
  jobRetryUpdateData,
  jobSuccessUpdateData,
  jobTerminalUpdateData,
} from "@/lib/enrichment-job-shared";

const runnerJobSelect = {
  ...rawgJobSelect,
  game: {
    select: {
      id: true,
      name: true,
      availability: {
        where: { source: "STEAM" as const },
        orderBy: { addedAt: "asc" as const },
        select: { steamAppId: true },
      },
    },
  },
} as const;

type RunnerJob = RawgJobRecord & {
  game: {
    id: string;
    name: string;
    availability: Array<{ steamAppId: string | null }>;
  };
};

export type RawgJobRunResult = {
  success: true;
  data: RawgEnrichmentJobView;
  error: null;
};

function safeProviderError(error: RawgProviderError): string {
  switch (error.category) {
    case "CONFIGURATION":
      return "RAWG is not configured";
    case "MALFORMED_RESPONSE":
      return "RAWG returned invalid data";
    case "HTTP":
      return "RAWG request failed";
    case "NETWORK":
      return "RAWG could not be reached";
  }
}

async function readJob(jobId: string): Promise<RunnerJob | null> {
  return prisma.enrichmentJob.findFirst({
    where: { id: jobId, provider: "RAWG" },
    select: runnerJobSelect,
  });
}

export async function getRawgJobStatus(
  jobId: string,
): Promise<RawgJobRunResult | null> {
  const job = await prisma.enrichmentJob.findFirst({
    where: { id: jobId, provider: "RAWG" },
    select: rawgJobSelect,
  });
  return job ? { success: true, data: toRawgEnrichmentJobView(job), error: null } : null;
}

async function updateFailedJob(
  job: RunnerJob,
  code: string,
  message: string,
  progress: number,
): Promise<RawgJobRunResult> {
  const updated = await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: jobTerminalUpdateData({ progress, code, message }),
    select: rawgJobSelect,
  });
  return { success: true, data: toRawgEnrichmentJobView(updated), error: null };
}

async function handleUnavailable(
  job: RunnerJob,
  error: RawgProviderError,
): Promise<RawgJobRunResult> {
  const message = safeProviderError(error);
  if (isRetryableJobProviderError(error) && job.attempt < job.maxAttempts) {
    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: jobRetryUpdateData({
        progress: rawgJobProgress("RETRYING"),
        attempt: job.attempt,
        code: error.category,
        message,
      }),
      select: rawgJobSelect,
    });
    return { success: true, data: toRawgEnrichmentJobView(updated), error: null };
  }

  return updateFailedJob(job, error.category, message, job.progress);
}

export async function runRawgEnrichmentJob(
  jobId: string,
): Promise<RawgJobRunResult | null> {
  const now = new Date();
  const claimed = await prisma.enrichmentJob.updateMany({
    where: jobClaimWhere({ jobId, provider: "RAWG", maxAttempts: RAWG_JOB_MAX_ATTEMPTS, now }),
    data: {
      status: "RUNNING",
      stage: "MATCHING",
      progress: rawgJobProgress("MATCHING"),
      attempt: { increment: 1 },
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
    },
  });

  if (claimed.count === 0) {
    return getRawgJobStatus(jobId);
  }

  const job = await readJob(jobId);
  if (!job) {
    return null;
  }

  let result;
  try {
    result = await matchRawgGame({
      title: job.game.name,
      selectedRawgId: job.selectedRawgId,
    });
  } catch {
    return handleUnavailable(job, {
      category: "NETWORK",
      message: "RAWG could not be reached",
    });
  }

  if (result.outcome === "UNAVAILABLE") {
    return handleUnavailable(job, result.error);
  }

  if (result.outcome === "AMBIGUOUS") {
    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "AWAITING_MATCH",
        stage: "MATCHING",
        progress: rawgJobProgress("MATCHING"),
        candidatePayload: {
          candidates: result.candidates,
          nextPage: 2,
        } as unknown as Prisma.InputJsonValue,
        selectedRawgId: null,
        nextAttemptAt: null,
        lastErrorCode: "AMBIGUOUS",
        lastErrorMessage: "Select a RAWG match to continue",
        finishedAt: null,
      },
      select: rawgJobSelect,
    });
    return { success: true, data: toRawgEnrichmentJobView(updated), error: null };
  }

  if (result.outcome === "NOT_FOUND") {
    return updateFailedJob(job, "NOT_FOUND", "No RAWG match was found", job.progress);
  }

  await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: { stage: "PERSISTING", progress: rawgJobProgress("PERSISTING") },
  });

  let persisted;
  try {
    persisted = await persistRawgMatch(job.game.id, result, new Date());
  } catch {
    return updateFailedJob(
      job,
      "PERSISTENCE_FAILED",
      "RAWG metadata could not be saved",
      rawgJobProgress("PERSISTING"),
    );
  }

  if (!persisted.success) {
    return updateFailedJob(
      job,
      persisted.error.code,
      persisted.error.message,
      rawgJobProgress("PERSISTING"),
    );
  }

  try {
    await queueCompatibilityForGame(job.game.id);
  } catch {
    // Compatibility refresh is best-effort and must not invalidate RAWG persistence.
  }

  const updated = await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: {
      ...jobSuccessUpdateData({ progress: rawgJobProgress("COMPLETE") }),
      candidatePayload: Prisma.DbNull,
    },
    select: rawgJobSelect,
  });
  return { success: true, data: toRawgEnrichmentJobView(updated), error: null };
}
