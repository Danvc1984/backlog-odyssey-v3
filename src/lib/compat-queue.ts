import "server-only";

import { prisma } from "@/lib/prisma";
import {
  COMPAT_JOB_MAX_ATTEMPTS,
  compatJobSelect,
  isActiveCompatJobStatus,
} from "@/lib/compat-job";
import { runCompatJob, type CompatJobRunResult } from "@/lib/compat-job-runner";

export interface CompatEligibilityGame {
  libraryEntry: object | null;
  externalIds: ReadonlyArray<{ namespace: string }>;
  availability: ReadonlyArray<{ source: string }>;
}

export function isCompatEligible(game: CompatEligibilityGame): boolean {
  const hasSteamIdentity = game.externalIds.some((id) => id.namespace === "STEAM_APP");
  const isRomOnly = game.availability.some(({ source }) => source === "ROM") &&
    !game.availability.some(({ source }) => source === "STEAM");

  return game.libraryEntry !== null && hasSteamIdentity && !isRomOnly;
}

const eligibilitySelect = {
  libraryEntry: { select: { id: true } },
  externalIds: {
    where: { namespace: "STEAM_APP" as const },
    select: { namespace: true },
  },
  availability: { select: { source: true } },
} as const;

const jobData = {
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

export async function queueCompatibilityForGame(
  gameId: string,
): Promise<CompatJobRunResult | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: eligibilitySelect,
  });
  if (!game || !isCompatEligible(game)) return null;

  const existing = await prisma.enrichmentJob.findUnique({
    where: { gameId_provider: { gameId, provider: "PROTONDB" } },
    select: { id: true, status: true },
  });
  if (existing && isActiveCompatJobStatus(existing.status)) return null;

  const job = await prisma.enrichmentJob.upsert({
    where: { gameId_provider: { gameId, provider: "PROTONDB" } },
    create: { gameId, provider: "PROTONDB", ...jobData },
    update: jobData,
    select: compatJobSelect,
  });

  return runCompatJob(job.id);
}
