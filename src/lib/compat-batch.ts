import type { EnrichmentJobStatus, SyncStatus } from "@/generated/prisma/client";

export interface CompatBatchCounts {
  total: number;
  queued: number;
  running: number;
  retryWaiting: number;
  succeeded: number;
  failed: number;
}

export interface CompatBatchJobStatus {
  status: EnrichmentJobStatus;
}

export interface CompatBatchSummary {
  counts: CompatBatchCounts;
  status: SyncStatus;
  progress: number;
  isTerminal: boolean;
}

export function emptyCompatBatchCounts(): CompatBatchCounts {
  return {
    total: 0,
    queued: 0,
    running: 0,
    retryWaiting: 0,
    succeeded: 0,
    failed: 0,
  };
}

export function summarizeCompatBatchJobs(
  jobs: readonly CompatBatchJobStatus[],
): CompatBatchCounts {
  const counts = emptyCompatBatchCounts();
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

export function compatBatchStatus(counts: CompatBatchCounts): SyncStatus {
  if (counts.queued + counts.running + counts.retryWaiting > 0) {
    return "RUNNING";
  }
  if (counts.total === 0) {
    return "FAILED";
  }
  if (counts.failed > 0) {
    return "PARTIAL";
  }
  return "SUCCESS";
}

export function compatBatchProgress(counts: CompatBatchCounts): number {
  if (counts.total === 0) {
    return 0;
  }

  return Math.round(((counts.succeeded + counts.failed) / counts.total) * 100);
}

export function compatBatchSummary(
  jobs: readonly CompatBatchJobStatus[],
): CompatBatchSummary {
  const counts = summarizeCompatBatchJobs(jobs);
  const status = compatBatchStatus(counts);

  return {
    counts,
    status,
    progress: compatBatchProgress(counts),
    isTerminal: status !== "RUNNING",
  };
}
