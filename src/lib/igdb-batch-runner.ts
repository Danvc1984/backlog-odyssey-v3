import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { batchSummary, persistedBatchSummary, type BatchCounts, type BatchJobStatus } from "@/lib/enrichment-batch-summary";
import { claimReadyEnrichmentJobs, readSyncRunBatch, refreshSyncRunBatch } from "@/lib/enrichment-batch-runner";
import { runIgdbEnrichmentJob } from "@/lib/igdb-job-runner";

export const igdbBatchSummary = batchSummary;
export type IgdbBatchJobStatus = BatchJobStatus & { status: "QUEUED" | "RUNNING" | "RETRY_WAIT" | "AWAITING_MATCH" | "SUCCEEDED" | "FAILED" };
export interface IgdbBatchView { id: string; status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED"; counts: BatchCounts; progress: number; isTerminal: boolean; finishedAt: string | null; awaitingMatchGames: { id: string; name: string }[]; failedGames: { id: string; name: string }[]; pendingAwaitingMatchGames: { id: string; name: string }[]; pendingFailedGames: { id: string; name: string }[]; }
export type IgdbBatchRunResult = { success: true; data: IgdbBatchView; error: null };

const select = {
  id: true, provider: true, status: true, counts: true, finishedAt: true,
  enrichmentJobs: { where: { provider: "IGDB" as const }, select: { id: true, status: true, nextAttemptAt: true, game: { select: { id: true, name: true, libraryEntry: { select: { hidden: true } } } } } },
} as const;
type Record = Prisma.SyncRunGetPayload<{ select: typeof select }>;

function view(batch: Record): IgdbBatchView {
  const jobs = batch.enrichmentJobs.filter((job) => job.game.libraryEntry?.hidden !== true);
  const summary = jobs.length === batch.enrichmentJobs.length ? persistedBatchSummary(batch.status, batch.counts) : null;
  const calculated = summary ?? batchSummary(jobs);
  const awaitingMatchGames = jobs.filter((job) => job.status === "AWAITING_MATCH").map((job) => job.game);
  const failedGames = jobs.filter((job) => job.status === "FAILED").map((job) => job.game);
  return { id: batch.id, status: jobs.length === batch.enrichmentJobs.length ? batch.status : calculated.status, counts: calculated.counts, progress: calculated.progress, isTerminal: jobs.length === batch.enrichmentJobs.length ? batch.status !== "RUNNING" : calculated.isTerminal, finishedAt: batch.finishedAt?.toISOString() ?? null, awaitingMatchGames, failedGames, pendingAwaitingMatchGames: [], pendingFailedGames: [] };
}

async function pendingFollowUps() {
  const jobs = await prisma.enrichmentJob.findMany({ where: { provider: "IGDB", status: { in: ["AWAITING_MATCH", "FAILED"] }, game: { libraryEntry: { is: { hidden: false } } } }, select: { status: true, game: { select: { id: true, name: true } } } });
  return { pendingAwaitingMatchGames: jobs.filter((job) => job.status === "AWAITING_MATCH").map((job) => job.game), pendingFailedGames: jobs.filter((job) => job.status === "FAILED").map((job) => job.game) };
}

async function withFollowUps(batch: Record): Promise<IgdbBatchRunResult> {
  const result = view(batch);
  return { success: true, data: result.isTerminal ? { ...result, ...(await pendingFollowUps()) } : result, error: null };
}

export async function getIgdbBatchStatus(batchId: string) {
  const batch = await readSyncRunBatch<Record>("IGDB", batchId, select);
  return batch ? withFollowUps(batch) : null;
}

export async function getLatestIgdbBatchStatus() {
  const batch = await prisma.syncRun.findFirst({ where: { provider: "IGDB", enrichmentJobs: { some: { provider: "IGDB", game: { libraryEntry: { is: { hidden: false } } } } } }, orderBy: { startedAt: "desc" }, select });
  return batch ? withFollowUps(batch) : null;
}

export async function runIgdbCatalogBatch(batchId: string) {
  const batch = await readSyncRunBatch<Record>("IGDB", batchId, select);
  if (!batch) return null;
  if (batch.status !== "RUNNING") return { success: true as const, data: view(batch), error: null };
  const jobs = await claimReadyEnrichmentJobs("IGDB", batch.id, new Date(), 4);
  if (jobs.length > 0) await Promise.all(jobs.map((job) => runIgdbEnrichmentJob(job.id)));
  const updated = await refreshSyncRunBatch<Record, ReturnType<typeof batchSummary>>("IGDB", batch, select, (current) => batchSummary(current.enrichmentJobs), (summary) => ({ status: summary.status, counts: summary.counts as Prisma.InputJsonValue, finishedAt: summary.isTerminal ? new Date() : null }));
  return withFollowUps(updated);
}
