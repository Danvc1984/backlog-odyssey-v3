import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { batchSummary } from "@/lib/enrichment-batch-summary";
import { initialIgdbJobState, isActiveIgdbJobStatus } from "@/lib/igdb-job";

export interface IgdbImportQueueOutcome { batchId: string | null; queued: number; skipped: number; }
type Game = { id: string; metadataSnapshots: { id: string }[]; enrichmentJobs: { status: "QUEUED" | "RUNNING" | "RETRY_WAIT" | "AWAITING_MATCH" | "SUCCEEDED" | "FAILED" }[] };

export async function queueIgdbForImportedGames(gameIds: readonly string[]): Promise<IgdbImportQueueOutcome> {
  const ids = [...new Set(gameIds.filter(Boolean))];
  if (ids.length === 0) return { batchId: null, queued: 0, skipped: 0 };
  return prisma.$transaction(async (tx) => {
    const games = await tx.game.findMany({ where: { id: { in: ids }, type: "BASE_GAME", libraryEntry: { is: { hidden: false } } }, select: { id: true, metadataSnapshots: { where: { provider: "IGDB" }, select: { id: true } }, enrichmentJobs: { where: { provider: "IGDB" }, select: { status: true } } } }) as Game[];
    const eligible = games.filter((game) => game.metadataSnapshots.length === 0 && !game.enrichmentJobs.some((job) => isActiveIgdbJobStatus(job.status)));
    if (eligible.length === 0) return { batchId: null, queued: 0, skipped: ids.length };
    const active = await tx.syncRun.findFirst({ where: { provider: "IGDB", status: "RUNNING" }, select: { id: true } });
    const batch = active ?? await tx.syncRun.create({ data: { provider: "IGDB", status: "RUNNING", counts: batchSummary([]).counts as Prisma.InputJsonValue }, select: { id: true } });
    for (const game of eligible) await tx.enrichmentJob.upsert({ where: { gameId_provider: { gameId: game.id, provider: "IGDB" } }, create: { gameId: game.id, provider: "IGDB", ...initialIgdbJobState(), syncRunId: batch.id, candidatePayload: Prisma.DbNull, selectedIgdbId: null, lastErrorCode: null, lastErrorMessage: null, startedAt: null, finishedAt: null }, update: { ...initialIgdbJobState(), syncRunId: batch.id, candidatePayload: Prisma.DbNull, selectedIgdbId: null, lastErrorCode: null, lastErrorMessage: null, startedAt: null, finishedAt: null } });
    const jobs = await tx.enrichmentJob.findMany({ where: { syncRunId: batch.id, provider: "IGDB" }, select: { status: true } });
    const summary = batchSummary(jobs);
    await tx.syncRun.update({ where: { id: batch.id }, data: { status: summary.status, counts: summary.counts as Prisma.InputJsonValue, finishedAt: null } });
    return { batchId: batch.id, queued: eligible.length, skipped: ids.length - eligible.length };
  });
}
