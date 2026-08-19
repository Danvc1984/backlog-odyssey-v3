import { z } from "zod";
import type { EnrichmentJobStatus, SyncStatus } from "@/generated/prisma/client";

const rawgBatchCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  retryWaiting: z.number().int().nonnegative(),
  awaitingMatch: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export type RawgBatchCounts = z.infer<typeof rawgBatchCountsSchema>;

export interface RawgBatchJobStatus {
  status: EnrichmentJobStatus;
}

export interface RawgBatchSummary {
  counts: RawgBatchCounts;
  status: SyncStatus;
  progress: number;
  isTerminal: boolean;
}

export function emptyRawgBatchCounts(): RawgBatchCounts {
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

export function summarizeRawgBatchJobs(
  jobs: readonly RawgBatchJobStatus[],
): RawgBatchCounts {
  const counts = emptyRawgBatchCounts();
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

export function rawgBatchStatus(counts: RawgBatchCounts): SyncStatus {
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

export function rawgBatchProgress(counts: RawgBatchCounts): number {
  if (counts.total === 0) {
    return 0;
  }

  const settled = counts.awaitingMatch + counts.succeeded + counts.failed;
  return Math.round((settled / counts.total) * 100);
}

export function rawgBatchSummary(
  jobs: readonly RawgBatchJobStatus[],
): RawgBatchSummary {
  const counts = summarizeRawgBatchJobs(jobs);
  const status = rawgBatchStatus(counts);
  return {
    counts,
    status,
    progress: rawgBatchProgress(counts),
    isTerminal: status !== "RUNNING",
  };
}

export function persistedRawgBatchSummary(
  status: SyncStatus,
  counts: unknown,
): RawgBatchSummary | null {
  const parsed = rawgBatchCountsSchema.safeParse(counts);
  if (!parsed.success || status === "RUNNING") {
    return null;
  }

  return {
    counts: parsed.data,
    status,
    progress: rawgBatchProgress(parsed.data),
    isTerminal: true,
  };
}
