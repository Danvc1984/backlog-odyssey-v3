import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  persistedRawgBatchSummary,
  rawgBatchSummary,
  type RawgBatchCounts,
} from "@/lib/rawg-batch";
import { runRawgEnrichmentJob } from "@/lib/rawg-job-runner";

const rawgBatchSelect = {
  id: true,
  provider: true,
  status: true,
  counts: true,
  finishedAt: true,
  enrichmentJobs: {
    where: { provider: "RAWG" as const },
    select: {
      id: true,
      status: true,
      nextAttemptAt: true,
      game: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

const RAWG_BATCH_CONCURRENCY = 5;

export interface RawgBatchView {
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  counts: RawgBatchCounts;
  progress: number;
  isTerminal: boolean;
  finishedAt: string | null;
  awaitingMatchGames: Array<{ id: string; name: string }>;
  failedGames: Array<{ id: string; name: string }>;
  pendingAwaitingMatchGames: Array<{ id: string; name: string }>;
  pendingFailedGames: Array<{ id: string; name: string }>;
}

export type RawgBatchRunResult = {
  success: true;
  data: RawgBatchView;
  error: null;
};

type RawgBatchRecord = {
  id: string;
  provider: string;
  status: RawgBatchView["status"];
  counts: unknown;
  finishedAt: Date | null;
  enrichmentJobs: Array<{
    id: string;
    status: "QUEUED" | "RUNNING" | "RETRY_WAIT" | "AWAITING_MATCH" | "SUCCEEDED" | "FAILED";
    nextAttemptAt: Date | null;
    game: { id: string; name: string };
  }>;
};

type RawgPendingBatchRecord = {
  enrichmentJobs: Array<{
    status: "AWAITING_MATCH" | "FAILED";
    game: { id: string; name: string };
  }>;
};

type RawgPendingFollowUps = Pick<
  RawgBatchView,
  "pendingAwaitingMatchGames" | "pendingFailedGames"
>;

const emptyPendingFollowUps: RawgPendingFollowUps = {
  pendingAwaitingMatchGames: [],
  pendingFailedGames: [],
};

async function readPendingRawgFollowUps(): Promise<RawgPendingFollowUps> {
  const batches = (await prisma.syncRun.findMany({
    where: {
      provider: "RAWG",
      enrichmentJobs: {
        some: {
          provider: "RAWG",
          status: { in: ["AWAITING_MATCH", "FAILED"] },
        },
      },
    },
    select: {
      enrichmentJobs: {
        where: {
          provider: "RAWG",
          status: { in: ["AWAITING_MATCH", "FAILED"] },
        },
        select: {
          status: true,
          game: { select: { id: true, name: true } },
        },
      },
    },
  })) as RawgPendingBatchRecord[];
  const awaitingMatchGames = new Map<string, { id: string; name: string }>();
  const failedGames = new Map<string, { id: string; name: string }>();
  for (const batch of batches) {
    for (const job of batch.enrichmentJobs) {
      const games = job.status === "AWAITING_MATCH" ? awaitingMatchGames : failedGames;
      games.set(job.game.id, job.game);
    }
  }
  return {
    pendingAwaitingMatchGames: [...awaitingMatchGames.values()],
    pendingFailedGames: [...failedGames.values()],
  };
}

async function addPendingRawgFollowUps(
  view: RawgBatchView,
): Promise<RawgBatchRunResult> {
  return { success: true, data: { ...view, ...(await readPendingRawgFollowUps()) }, error: null };
}

function batchView(batch: RawgBatchRecord): RawgBatchView {
  const awaitingMatchGames = batch.enrichmentJobs
    .filter((job) => job.status === "AWAITING_MATCH")
    .map((job) => job.game);
  const failedGames = batch.enrichmentJobs
    .filter((job) => job.status === "FAILED")
    .map((job) => job.game);
  const persistedSummary = persistedRawgBatchSummary(batch.status, batch.counts);
  if (persistedSummary) {
    return {
      id: batch.id,
      status: batch.status,
      counts: persistedSummary.counts,
      progress: persistedSummary.progress,
      isTerminal: true,
      finishedAt: batch.finishedAt?.toISOString() ?? null,
      awaitingMatchGames,
      failedGames,
      ...emptyPendingFollowUps,
    };
  }

  const summary = rawgBatchSummary(batch.enrichmentJobs);
  return {
    id: batch.id,
    status: batch.status,
    counts: summary.counts,
    progress: summary.progress,
    isTerminal: batch.status !== "RUNNING",
    finishedAt: batch.finishedAt?.toISOString() ?? null,
    awaitingMatchGames,
    failedGames,
    ...emptyPendingFollowUps,
  };
}

async function readRawgBatch(batchId: string): Promise<RawgBatchRecord | null> {
  return prisma.syncRun.findFirst({
    where: { id: batchId, provider: "RAWG" },
    select: rawgBatchSelect,
  });
}

async function refreshRawgBatch(batchId: string): Promise<RawgBatchRunResult | null> {
  const batch = await readRawgBatch(batchId);
  if (!batch) {
    return null;
  }

  const summary = rawgBatchSummary(batch.enrichmentJobs);
  const finishedAt = summary.isTerminal ? batch.finishedAt ?? new Date() : null;
  const updated = await prisma.syncRun.update({
    where: { id: batch.id },
    data: {
      status: summary.status,
      counts: summary.counts as Prisma.InputJsonValue,
      finishedAt,
    },
    select: rawgBatchSelect,
  });
  return addPendingRawgFollowUps(batchView(updated));
}

export async function getRawgBatchStatus(
  batchId: string,
): Promise<RawgBatchRunResult | null> {
  const batch = await readRawgBatch(batchId);
  return batch ? addPendingRawgFollowUps(batchView(batch)) : null;
}

export async function getLatestRawgBatchStatus(): Promise<RawgBatchRunResult | null> {
  const pendingReviewBatch = await prisma.syncRun.findFirst({
    where: {
      provider: "RAWG",
      status: "PARTIAL",
      enrichmentJobs: {
        some: { provider: "RAWG", status: "AWAITING_MATCH" },
      },
    },
    orderBy: { startedAt: "desc" },
    select: rawgBatchSelect,
  });
  if (pendingReviewBatch) {
    return addPendingRawgFollowUps(batchView(pendingReviewBatch));
  }

  const failedBatch = await prisma.syncRun.findFirst({
    where: {
      provider: "RAWG",
      status: { in: ["PARTIAL", "FAILED"] },
      enrichmentJobs: {
        some: { provider: "RAWG", status: "FAILED" },
      },
    },
    orderBy: { startedAt: "desc" },
    select: rawgBatchSelect,
  });
  if (failedBatch) {
    return addPendingRawgFollowUps(batchView(failedBatch));
  }

  const latestBatch = await prisma.syncRun.findFirst({
    where: { provider: "RAWG" },
    orderBy: { startedAt: "desc" },
    select: rawgBatchSelect,
  });
  return latestBatch
    ? addPendingRawgFollowUps(batchView(latestBatch))
    : null;
}

export async function runRawgCatalogBatch(
  batchId: string,
): Promise<RawgBatchRunResult | null> {
  const batch = await readRawgBatch(batchId);
  if (!batch) {
    return null;
  }
  if (batch.status !== "RUNNING") {
    return { success: true, data: batchView(batch), error: null };
  }

  const now = new Date();
  const readyJobs = await prisma.enrichmentJob.findMany({
    where: {
      syncRunId: batch.id,
      provider: "RAWG",
      OR: [
        { status: "QUEUED" },
        { status: "RETRY_WAIT", nextAttemptAt: { lte: now } },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
    take: RAWG_BATCH_CONCURRENCY,
  });

  if (readyJobs.length > 0) {
    await Promise.all(readyJobs.map((job) => runRawgEnrichmentJob(job.id)));
  }

  return refreshRawgBatch(batch.id);
}
