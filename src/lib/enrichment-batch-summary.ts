import { z } from "zod";
import type { EnrichmentJobStatus, SyncStatus } from "@/generated/prisma/client";

const batchCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  retryWaiting: z.number().int().nonnegative(),
  awaitingMatch: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export type BatchCounts = z.infer<typeof batchCountsSchema>;

export interface BatchJobStatus {
  status: EnrichmentJobStatus;
}

export interface BatchSummary {
  counts: BatchCounts;
  status: SyncStatus;
  progress: number;
  isTerminal: boolean;
}

export function emptyBatchCounts(): BatchCounts {
  return {
    total: 0,
    queued: 0,
    running: 0,
    retryWaiting: 0,
    awaitingMatch: 0,
    succeeded: 0,
    failed: 0,
  };
}

export function summarizeBatchJobs(
  jobs: readonly BatchJobStatus[],
): BatchCounts {
  const counts = emptyBatchCounts();
  counts.total = jobs.length;

  for (const job of jobs) {
    switch (job.status) {
      case "QUEUED":
        counts.queued += 1;
        break;
      case "RUNNING":
        counts.running += 1;
        break;
      case "RETRY_WAIT":
        counts.retryWaiting += 1;
        break;
      case "AWAITING_MATCH":
        counts.awaitingMatch += 1;
        break;
      case "SUCCEEDED":
        counts.succeeded += 1;
        break;
      case "FAILED":
        counts.failed += 1;
        break;
    }
  }

  return counts;
}

export function batchStatus(counts: BatchCounts): SyncStatus {
  if (counts.queued + counts.running + counts.retryWaiting > 0) {
    return "RUNNING";
  }
  if (counts.total === 0) {
    return "FAILED";
  }
  if (counts.awaitingMatch + counts.failed > 0) {
    return "PARTIAL";
  }
  return "SUCCESS";
}

export function batchProgress(counts: BatchCounts): number {
  if (counts.total === 0) {
    return 0;
  }

  const settled = counts.awaitingMatch + counts.succeeded + counts.failed;
  return Math.round((settled / counts.total) * 100);
}

export function batchSummary(
  jobs: readonly BatchJobStatus[],
): BatchSummary {
  const counts = summarizeBatchJobs(jobs);
  const status = batchStatus(counts);
  return {
    counts,
    status,
    progress: batchProgress(counts),
    isTerminal: status !== "RUNNING",
  };
}

export function persistedBatchSummary(
  status: SyncStatus,
  counts: unknown,
): BatchSummary | null {
  const parsed = batchCountsSchema.safeParse(counts);
  if (!parsed.success || status === "RUNNING") {
    return null;
  }

  return {
    counts: parsed.data,
    status,
    progress: batchProgress(parsed.data),
    isTerminal: true,
  };
}
