import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { lookupAway, type AwayProviderError } from "@/lib/away-api";
import { lookupProtonDb, PROTONDB_URL, type ProtonDbProviderError } from "@/lib/protondb-api";
import { synthesizeCompatibility } from "@/lib/compat-synthesis";
import {
  COMPAT_JOB_MAX_ATTEMPTS,
  compatJobSelect,
  toCompatJobView,
  type CompatJobRecord,
  type CompatJobView,
} from "@/lib/compat-job";

const runnerJobSelect = {
  ...compatJobSelect,
  game: {
    select: {
      id: true,
      name: true,
      externalIds: {
        where: { namespace: "STEAM_APP" as const },
        select: { externalId: true },
        take: 1,
      },
    },
  },
} as const;

type RunnerJob = CompatJobRecord & {
  game: {
    id: string;
    name: string;
    externalIds: Array<{ externalId: string }>;
  };
};

export type CompatJobRunResult = {
  success: true;
  data: CompatJobView;
  error: null;
};

type ProviderError = ProtonDbProviderError | AwayProviderError;

function isProviderError(value: unknown): value is ProviderError {
  return typeof value === "object" && value !== null && "category" in value;
}

function retryable(error: ProviderError): boolean {
  return error.category === "NETWORK" ||
    (error.category === "HTTP" && (error.status === 429 || (error.status !== undefined && error.status >= 500)));
}

function retryDelay(attempt: number): number {
  return 1000 * 2 ** Math.max(0, attempt - 1);
}

function errorMessage(error: ProviderError): string {
  switch (error.category) {
    case "NETWORK":
      return "Compatibility provider could not be reached";
    case "HTTP":
      return "Compatibility provider request failed";
    case "MALFORMED_RESPONSE":
      return "Compatibility provider returned invalid data";
  }
}

async function readJob(jobId: string): Promise<RunnerJob | null> {
  return prisma.enrichmentJob.findFirst({
    where: { id: jobId, provider: "PROTONDB" },
    select: runnerJobSelect,
  });
}

async function updateTerminal(
  job: RunnerJob,
  code: string,
  message: string,
  progress: number,
): Promise<CompatJobRunResult> {
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
    select: compatJobSelect,
  });
  return { success: true, data: toCompatJobView(updated), error: null };
}

async function handleProviderError(
  job: RunnerJob,
  error: ProviderError,
): Promise<CompatJobRunResult> {
  const message = errorMessage(error);
  if (retryable(error) && job.attempt < job.maxAttempts) {
    const updated = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: {
        status: "RETRY_WAIT",
        stage: "RETRYING",
        progress: 50,
        nextAttemptAt: new Date(Date.now() + retryDelay(job.attempt)),
        lastErrorCode: error.category,
        lastErrorMessage: message,
        finishedAt: null,
      },
      select: compatJobSelect,
    });
    return { success: true, data: toCompatJobView(updated), error: null };
  }
  return updateTerminal(job, error.category, message, 50);
}

async function persistCompatibility(
  job: RunnerJob,
  appId: string,
  protonDb: Awaited<ReturnType<typeof lookupProtonDb>>,
  away: Awaited<ReturnType<typeof lookupAway>>,
): Promise<void> {
  const rows = synthesizeCompatibility({
    protonDb: protonDb && !isProviderError(protonDb) ? protonDb : null,
    away: away && !isProviderError(away) ? away : null,
    game: { name: job.game.name, hasSteamAppId: true },
  });
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.compatibilitySnapshot.upsert({
      where: { gameId_provider: { gameId: job.game.id, provider: "PROTONDB" } },
      create: {
        gameId: job.game.id,
        provider: "PROTONDB",
        result: protonDb && !isProviderError(protonDb) ? protonDb.raw as Prisma.InputJsonValue : Prisma.JsonNull,
        sourceUrl: `${PROTONDB_URL}/${appId}.json`,
        expiresAt,
      },
      update: {
        result: protonDb && !isProviderError(protonDb) ? protonDb.raw as Prisma.InputJsonValue : Prisma.JsonNull,
        sourceUrl: `${PROTONDB_URL}/${appId}.json`,
        fetchedAt: new Date(),
        expiresAt,
      },
    });
    await tx.compatibilitySnapshot.upsert({
      where: { gameId_provider: { gameId: job.game.id, provider: "ARE_WE_ANTICHEAT_YET" } },
      create: {
        gameId: job.game.id,
        provider: "ARE_WE_ANTICHEAT_YET",
        result: away && !isProviderError(away) ? away as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
        sourceUrl: "https://github.com/AreWeAntiCheatYet/AreWeAntiCheatYet/blob/master/games.json",
        expiresAt,
      },
      update: {
        result: away && !isProviderError(away) ? away as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
        sourceUrl: "https://github.com/AreWeAntiCheatYet/AreWeAntiCheatYet/blob/master/games.json",
        fetchedAt: new Date(),
        expiresAt,
      },
    });
    for (const row of rows) {
      await tx.environmentCompatibility.upsert({
        where: { gameId_environment: { gameId: job.game.id, environment: row.environment } },
        create: { gameId: job.game.id, environment: row.environment, status: row.status, source: row.source },
        update: { status: row.status, source: row.source },
      });
    }
  });
}

export async function getCompatJobStatus(jobId: string): Promise<CompatJobRunResult | null> {
  const job = await prisma.enrichmentJob.findFirst({
    where: { id: jobId, provider: "PROTONDB" },
    select: compatJobSelect,
  });
  return job ? { success: true, data: toCompatJobView(job), error: null } : null;
}

export async function runCompatJob(jobId: string): Promise<CompatJobRunResult | null> {
  const now = new Date();
  const claimed = await prisma.enrichmentJob.updateMany({
    where: {
      id: jobId,
      provider: "PROTONDB",
      game: {
        OR: [
          { libraryEntry: { is: null } },
          { libraryEntry: { is: { hidden: false } } },
        ],
      },
      attempt: { lt: COMPAT_JOB_MAX_ATTEMPTS },
      OR: [{ status: "QUEUED" }, { status: "RETRY_WAIT", nextAttemptAt: { lte: now } }],
    },
    data: {
      status: "RUNNING",
      stage: "MATCHING",
      progress: 25,
      attempt: { increment: 1 },
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
    },
  });
  if (claimed.count === 0) return getCompatJobStatus(jobId);

  const job = await readJob(jobId);
  if (!job) return null;
  const appId = job.game.externalIds[0]?.externalId;
  if (!appId) return updateTerminal(job, "STEAM_ID_REQUIRED", "A Steam App ID is required", 25);

  const results = await Promise.all([
    lookupProtonDb(appId),
    lookupAway(appId),
  ]);
  const providerErrorResult = results.find(isProviderError);
  if (providerErrorResult) return handleProviderError(job, providerErrorResult);

  await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: { stage: "PERSISTING", progress: 75 },
  });
  try {
    await persistCompatibility(job, appId, results[0], results[1]);
  } catch {
    return updateTerminal(job, "PERSISTENCE_FAILED", "Compatibility evidence could not be saved", 75);
  }

  const updated = await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: {
      status: "SUCCEEDED",
      stage: "COMPLETE",
      progress: 100,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      finishedAt: new Date(),
    },
    select: compatJobSelect,
  });
  return { success: true, data: toCompatJobView(updated), error: null };
}
