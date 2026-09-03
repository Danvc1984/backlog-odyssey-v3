import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Provider = "RAWG" | "PROTONDB";

export async function readSyncRunBatch<TRecord>(
  provider: Provider,
  batchId: string,
  select: NonNullable<Prisma.SyncRunFindFirstArgs["select"]>,
): Promise<TRecord | null> {
  return prisma.syncRun.findFirst({
    where: { id: batchId, provider },
    select,
  }) as unknown as Promise<TRecord | null>;
}

export async function refreshSyncRunBatch<TRecord, TSummary>(
  provider: Provider,
  batch: { id: string },
  select: NonNullable<Prisma.SyncRunFindFirstArgs["select"]>,
  summarize: (batch: TRecord) => TSummary,
  updateData: (summary: TSummary, batch: TRecord) => object,
): Promise<TRecord> {
  const summary = summarize(batch as TRecord);
  return prisma.syncRun.update({
    where: { id: batch.id },
    data: updateData(summary, batch as TRecord),
    select,
  }) as unknown as Promise<TRecord>;
}

export async function claimReadyEnrichmentJobs(
  provider: Provider,
  batchId: string,
  now: Date,
  concurrency: number,
): Promise<Array<{ id: string }>> {
  return prisma.enrichmentJob.findMany({
    where: {
      syncRunId: batchId,
      provider,
      game: { libraryEntry: { is: { hidden: false } } },
      OR: [
        { status: "QUEUED" },
        { status: "RETRY_WAIT", nextAttemptAt: { lte: now } },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    select: { id: true },
    take: concurrency,
  });
}
