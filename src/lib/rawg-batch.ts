import type { EnrichmentJobStatus } from "@/generated/prisma/client";
import {
  batchProgress,
  batchStatus,
  batchSummary,
  emptyBatchCounts,
  persistedBatchSummary,
  summarizeBatchJobs,
  type BatchCounts,
  type BatchJobStatus,
  type BatchSummary,
} from "./enrichment-batch-summary";

export type RawgBatchCounts = BatchCounts;

export interface RawgBatchJobStatus extends BatchJobStatus {
  status: EnrichmentJobStatus;
}

export type RawgBatchSummary = BatchSummary;

export const emptyRawgBatchCounts = emptyBatchCounts;
export const summarizeRawgBatchJobs = summarizeBatchJobs;
export const rawgBatchStatus = batchStatus;
export const rawgBatchProgress = batchProgress;
export const rawgBatchSummary = batchSummary;
export const persistedRawgBatchSummary = persistedBatchSummary;
