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

export interface RawgBatchView {
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  counts: RawgBatchCounts;
  progress: number;
  isTerminal: boolean;
  finishedAt: string | null;
  awaitingMatchGames: Array<{ id: string; name: string }>;
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

function batchView(batch: RawgBatchRecord): RawgBatchView {
  const awaitingMatchGames = batch.enrichmentJobs
    .filter((job) => job.status === "AWAITING_MATCH")
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
  return { success: true, data: batchView(updated), error: null };
}

export async function getRawgBatchStatus(
  batchId: string,
): Promise<RawgBatchRunResult | null> {
  const batch = await readRawgBatch(batchId);
  return batch ? { success: true, data: batchView(batch), error: null } : null;
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
    return { success: true, data: batchView(pendingReviewBatch), error: null };
  }

  const latestBatch = await prisma.syncRun.findFirst({
    where: { provider: "RAWG" },
    orderBy: { startedAt: "desc" },
    select: rawgBatchSelect,
  });
  return latestBatch
    ? { success: true, data: batchView(latestBatch), error: null }
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
  const nextJob = await prisma.enrichmentJob.findFirst({
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
  });

  if (nextJob) {
    await runRawgEnrichmentJob(nextJob.id);
  }

  return refreshRawgBatch(batch.id);
}
