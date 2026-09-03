import "server-only";

import { Prisma, type EnrichmentJobStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  compatBatchSummary,
  type CompatBatchCounts,
} from "@/lib/compat-batch";
import { runCompatJob } from "@/lib/compat-job-runner";
import {
  claimReadyEnrichmentJobs,
  readSyncRunBatch,
  refreshSyncRunBatch,
} from "@/lib/enrichment-batch-runner";

const compatBatchSelect = {
  id: true,
  provider: true,
  status: true,
  counts: true,
  finishedAt: true,
  enrichmentJobs: {
    where: { provider: "PROTONDB" as const },
    select: {
      id: true,
      status: true,
      nextAttemptAt: true,
      game: {
        select: {
          id: true,
          name: true,
          libraryEntry: { select: { compatOverrideStatus: true, hidden: true } },
        },
      },
    },
  },
} as const;

const COMPAT_BATCH_CONCURRENCY = 5;

export interface CompatBatchView {
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  counts: CompatBatchCounts;
  progress: number;
  isTerminal: boolean;
  finishedAt: string | null;
  failedGames: Array<{ id: string; name: string }>;
}

export type CompatBatchRunResult = {
  success: true;
  data: CompatBatchView;
  error: null;
};

type CompatBatchRecord = {
  id: string;
  provider: string;
  status: CompatBatchView["status"];
  counts: unknown;
  finishedAt: Date | null;
  enrichmentJobs: Array<{
    id: string;
    status: EnrichmentJobStatus;
    nextAttemptAt: Date | null;
    game: {
      id: string;
      name: string;
      libraryEntry: { compatOverrideStatus: string | null; hidden?: boolean } | null;
    };
  }>;
};

function batchView(batch: CompatBatchRecord): CompatBatchView {
  const visibleJobs = batch.enrichmentJobs.filter((job) => job.game.libraryEntry?.hidden !== true);
  const summary = compatBatchSummary(visibleJobs);
  return {
    id: batch.id,
    status: summary.status,
    counts: summary.counts,
    progress: summary.progress,
    isTerminal: summary.isTerminal,
    finishedAt: batch.finishedAt?.toISOString() ?? null,
    failedGames: visibleJobs
      .filter((job) => job.status === "FAILED" && !job.game.libraryEntry?.compatOverrideStatus)
      .map((job) => ({ id: job.game.id, name: job.game.name })),
  };
}

function populatedBatchView(batch: CompatBatchRecord | null): CompatBatchView | null {
  if (!batch) return null;
  const view = batchView(batch);
  return view.counts.total > 0 ? view : null;
}

async function refreshCompatBatch(batchId: string): Promise<CompatBatchRunResult | null> {
  const batch = await readSyncRunBatch<CompatBatchRecord>("PROTONDB", batchId, compatBatchSelect);
  if (!batch) return null;

  const updated = await refreshSyncRunBatch<CompatBatchRecord, ReturnType<typeof compatBatchSummary>>(
    "PROTONDB",
    batch,
    compatBatchSelect,
    (currentBatch) => compatBatchSummary(
      currentBatch.enrichmentJobs.filter((job) => job.game.libraryEntry?.hidden !== true),
    ),
    (summary) => ({
      status: summary.status,
      counts: { ...summary.counts } as Prisma.InputJsonObject,
      finishedAt: summary.isTerminal ? batch.finishedAt ?? new Date() : null,
    }),
  );
  return { success: true, data: batchView(updated), error: null };
}

export async function getCompatBatchStatus(
  batchId: string,
): Promise<CompatBatchRunResult | null> {
  const batch = await readSyncRunBatch<CompatBatchRecord>("PROTONDB", batchId, compatBatchSelect);
  const view = populatedBatchView(batch);
  return view ? { success: true, data: view, error: null } : null;
}

export async function getLatestCompatBatchStatus(): Promise<CompatBatchRunResult | null> {
  const activeBatch = await prisma.syncRun.findFirst({
    where: { provider: "PROTONDB", status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    select: compatBatchSelect,
  });
  const activeView = populatedBatchView(activeBatch);
  if (activeView) return { success: true, data: activeView, error: null };

  const failedBatch = await prisma.syncRun.findFirst({
    where: {
      provider: "PROTONDB",
      status: { in: ["PARTIAL", "FAILED"] },
      enrichmentJobs: {
        some: {
          provider: "PROTONDB",
          status: "FAILED",
          game: { libraryEntry: { is: { hidden: false } } },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    select: compatBatchSelect,
  });
  const failedView = populatedBatchView(failedBatch);
  if (failedView) return { success: true, data: failedView, error: null };

  const latestBatch = await prisma.syncRun.findFirst({
    where: {
      provider: "PROTONDB",
      enrichmentJobs: {
        some: { provider: "PROTONDB", game: { libraryEntry: { is: { hidden: false } } } },
      },
    },
    orderBy: { startedAt: "desc" },
    select: compatBatchSelect,
  });
  const latestView = populatedBatchView(latestBatch);
  return latestView ? { success: true, data: latestView, error: null } : null;
}

export async function runCompatBatch(
  batchId: string,
): Promise<CompatBatchRunResult | null> {
  const batch = await readSyncRunBatch<CompatBatchRecord>("PROTONDB", batchId, compatBatchSelect);
  if (!batch) return null;
  if (batch.status !== "RUNNING") {
    const view = populatedBatchView(batch);
    return view ? { success: true, data: view, error: null } : null;
  }

  const now = new Date();
  const readyJobs = await claimReadyEnrichmentJobs("PROTONDB", batch.id, now, COMPAT_BATCH_CONCURRENCY);

  await Promise.all(readyJobs.map((job) => runCompatJob(job.id)));
  return refreshCompatBatch(batch.id);
}
