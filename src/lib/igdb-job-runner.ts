import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { queueCompatibilityForGame } from "@/lib/compat-queue";
import { fetchIgdbGameTimeToBeats, fetchIgdbSteamAppId, matchIgdbGame } from "@/lib/igdb-api";
import { fetchSteamSpyMedian } from "@/lib/steamspy-api";
import { persistDerivedSteamAppId, persistIgdbIdentity, persistIgdbSnapshot, persistPlaytimeEvidence } from "@/lib/igdb-enrichment";
import {
  IGDB_JOB_MAX_ATTEMPTS,
  igdbJobProgress,
} from "@/lib/igdb-job";
import {
  igdbJobSelect,
  toIgdbEnrichmentJobView,
  type IgdbEnrichmentJobView,
  type IgdbJobRecord,
} from "@/lib/igdb-job-view";
import type { IgdbProviderError } from "@/lib/igdb-types";
import {
  isRetryableJobProviderError,
  jobClaimWhere,
  jobRetryUpdateData,
  jobSuccessUpdateData,
  jobTerminalUpdateData,
} from "@/lib/enrichment-job-shared";

const runnerJobSelect = {
  ...igdbJobSelect,
  game: {
    select: {
      id: true,
      name: true,
      type: true,
      availability: {
        where: { source: "STEAM" as const },
        orderBy: { addedAt: "asc" as const },
        select: { steamAppId: true },
      },
      externalIds: {
        where: { namespace: "STEAM_APP" },
        select: { externalId: true },
      },
    },
  },
} as const;

type RunnerJob = IgdbJobRecord & {
  game: {
    id: string;
    name: string;
    type: "BASE_GAME" | "DLC";
    availability: Array<{ steamAppId: string | null }>;
    externalIds: Array<{ externalId: string }>;
  };
};

export type IgdbJobRunResult = {
  success: true;
  data: IgdbEnrichmentJobView;
  error: null;
};

function safeProviderError(error: IgdbProviderError): string {
  switch (error.category) {
    case "CONFIGURATION":
      return "IGDB is not configured";
    case "MALFORMED_RESPONSE":
      return "IGDB returned invalid data";
    case "HTTP":
      return "IGDB request failed";
    case "NETWORK":
      return "IGDB could not be reached";
  }
}

async function readJob(jobId: string): Promise<RunnerJob | null> {
  return prisma.enrichmentJob.findFirst({
    where: { id: jobId, provider: "IGDB" },
    select: runnerJobSelect,
  });
}

export async function getIgdbJobStatus(
  jobId: string,
): Promise<IgdbJobRunResult | null> {
  const job = await prisma.enrichmentJob.findFirst({
    where: { id: jobId, provider: "IGDB" },
    select: igdbJobSelect,
  });
  return job ? { success: true, data: toIgdbEnrichmentJobView(job), error: null } : null;
}

async function updateFailedJob(
  job: RunnerJob,
  code: string,
  message: string,
  progress: number,
): Promise<IgdbJobRunResult> {
  const updated = await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: jobTerminalUpdateData({ progress, code, message }),
    select: igdbJobSelect,
  });
  return { success: true, data: toIgdbEnrichmentJobView(updated), error: null };
}

async function handleUnavailable(
  job: RunnerJob,
  error: IgdbProviderError,
): Promise<IgdbJobRunResult> {
  const message = safeProviderError(error);
  if (isRetryableJobProviderError(error) && job.attempt < job.maxAttempts) {
    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: jobRetryUpdateData({
        progress: igdbJobProgress("RETRYING"),
        attempt: job.attempt,
        code: error.category,
        message,
      }),
      select: igdbJobSelect,
    });
    return { success: true, data: toIgdbEnrichmentJobView(updated), error: null };
  }

  return updateFailedJob(job, error.category, message, job.progress);
}

async function persistDurationEvidence(job: RunnerJob, igdbId: number, slug: string | null, steamAppId: string | null): Promise<void> {
  const igdbResult = await fetchIgdbGameTimeToBeats(igdbId);
  if (igdbResult.ok && igdbResult.data !== null && [igdbResult.data.hastilySeconds, igdbResult.data.normallySeconds, igdbResult.data.completelySeconds].some((value) => value !== null)) {
    await persistPlaytimeEvidence(job.game.id, "IGDB", igdbResult.data as unknown as Prisma.InputJsonValue, slug ? `https://www.igdb.com/games/${slug}` : null, new Date());
    return;
  }
  if (!steamAppId) return;
  const steamSpyResult = await fetchSteamSpyMedian(steamAppId);
  if (steamSpyResult.ok && steamSpyResult.data) {
    await persistPlaytimeEvidence(job.game.id, "STEAMSPY", { appId: steamAppId, ...steamSpyResult.data }, `https://steamspy.com/app/${steamAppId}`, new Date());
  }
}

export async function runIgdbEnrichmentJob(
  jobId: string,
): Promise<IgdbJobRunResult | null> {
  const now = new Date();
  const claimed = await prisma.enrichmentJob.updateMany({
    where: jobClaimWhere({ jobId, provider: "IGDB", maxAttempts: IGDB_JOB_MAX_ATTEMPTS, now }),
    data: {
      status: "RUNNING",
      stage: "MATCHING",
      progress: igdbJobProgress("MATCHING"),
      attempt: { increment: 1 },
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
    },
  });

  if (claimed.count === 0) return getIgdbJobStatus(jobId);

  const job = await readJob(jobId);
  if (!job) return null;

  let steamAppId = job.game.externalIds[0]?.externalId ?? job.game.availability.find((entry) => entry.steamAppId)?.steamAppId ?? null;
  const category = job.game.type === "DLC" ? "DLC" : "MAIN_GAME";
  let result;
  try {
    result = await matchIgdbGame({
      title: job.game.name,
      category,
      steamAppId,
      selectedIgdbId: job.selectedIgdbId,
    });
  } catch {
    return handleUnavailable(job, { category: "NETWORK", message: "IGDB could not be reached" });
  }

  if (result.outcome === "UNAVAILABLE") return handleUnavailable(job, result.error);

  if (result.outcome === "AMBIGUOUS") {
    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "AWAITING_MATCH",
        stage: "MATCHING",
        progress: igdbJobProgress("MATCHING"),
        candidatePayload: {
          candidates: result.candidates,
          nextPage: result.candidates.length >= 10 ? 10 : null,
        } as unknown as Prisma.InputJsonValue,
        selectedIgdbId: null,
        nextAttemptAt: null,
        lastErrorCode: "AMBIGUOUS",
        lastErrorMessage: "Select an IGDB match to continue",
        finishedAt: null,
      },
      select: igdbJobSelect,
    });
    return { success: true, data: toIgdbEnrichmentJobView(updated), error: null };
  }

  if (result.outcome === "NOT_FOUND") {
    return updateFailedJob(job, "NOT_FOUND", "No IGDB match was found", job.progress);
  }

  await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: { stage: "PERSISTING", progress: igdbJobProgress("PERSISTING") },
  });

  let persistedIdentity;
  try {
    persistedIdentity = await persistIgdbIdentity(job.game.id, result);
  } catch {
    return updateFailedJob(job, "PERSISTENCE_FAILED", "IGDB identity could not be saved", igdbJobProgress("PERSISTING"));
  }
  if (!persistedIdentity.success) {
    return updateFailedJob(job, persistedIdentity.error.code, persistedIdentity.error.message, igdbJobProgress("PERSISTING"));
  }

  if (!steamAppId && job.game.availability.length > 0) {
    try {
      const derived = await fetchIgdbSteamAppId(result.game.id);
      if (derived.ok && derived.data) {
        const persistedSteam = await persistDerivedSteamAppId(job.game.id, derived.data);
        if (persistedSteam.applied) steamAppId = derived.data;
      }
    } catch {
      // Derived Steam identity is best effort; the IGDB match remains valid.
    }
  }

  let persistedSnapshot;
  try {
    persistedSnapshot = await persistIgdbSnapshot(job.game.id, result.game, new Date());
  } catch {
    return updateFailedJob(job, "PERSISTENCE_FAILED", "IGDB metadata could not be saved", igdbJobProgress("PERSISTING"));
  }
  if (!persistedSnapshot.success) {
    return updateFailedJob(job, persistedSnapshot.error.code, persistedSnapshot.error.message, igdbJobProgress("PERSISTING"));
  }

  try {
    await persistDurationEvidence(job, result.game.id, result.game.slug ?? null, steamAppId);
  } catch {
    // Duration evidence is supplementary and must not fail metadata enrichment.
  }

  try {
    await queueCompatibilityForGame(job.game.id);
  } catch {
    // Compatibility refresh is best-effort and must not invalidate IGDB persistence.
  }

  const updated = await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: {
      ...jobSuccessUpdateData({ progress: igdbJobProgress("COMPLETE") }),
      candidatePayload: Prisma.DbNull,
    },
    select: igdbJobSelect,
  });
  return { success: true, data: toIgdbEnrichmentJobView(updated), error: null };
}
