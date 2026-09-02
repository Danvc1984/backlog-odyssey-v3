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

function isRetryableProviderError(error: RawgProviderError): boolean {
  return (
    error.category === "NETWORK" ||
    (error.category === "HTTP" &&
      (error.status === 429 || (error.status !== undefined && error.status >= 500)))
  );
}

function retryDelay(attempt: number): number {
  return 1000 * 2 ** Math.max(0, attempt - 1);
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
    data: {
      status: "FAILED",
      stage: "FAILED",
      progress,
      nextAttemptAt: null,
      lastErrorCode: code,
      lastErrorMessage: message,
      finishedAt: new Date(),
    },
    select: rawgJobSelect,
  });
  return { success: true, data: toRawgEnrichmentJobView(updated), error: null };
}

async function handleUnavailable(
  job: RunnerJob,
  error: RawgProviderError,
): Promise<RawgJobRunResult> {
  const message = safeProviderError(error);
  if (isRetryableProviderError(error) && job.attempt < job.maxAttempts) {
    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "RETRY_WAIT",
        stage: "RETRYING",
        progress: rawgJobProgress("RETRYING"),
        nextAttemptAt: new Date(Date.now() + retryDelay(job.attempt)),
        lastErrorCode: error.category,
        lastErrorMessage: message,
        finishedAt: null,
      },
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
    where: {
      id: jobId,
      provider: "RAWG",
      game: {
        OR: [
          { libraryEntry: { is: null } },
          { libraryEntry: { is: { hidden: false } } },
        ],
      },
      attempt: { lt: RAWG_JOB_MAX_ATTEMPTS },
      OR: [
        { status: "QUEUED" },
        { status: "RETRY_WAIT", nextAttemptAt: { lte: now } },
      ],
    },
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
      status: "SUCCEEDED",
      stage: "COMPLETE",
      progress: rawgJobProgress("COMPLETE"),
      candidatePayload: Prisma.DbNull,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      finishedAt: new Date(),
    },
    select: rawgJobSelect,
  });
  return { success: true, data: toRawgEnrichmentJobView(updated), error: null };
}
