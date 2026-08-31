import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface TodayOperationsView {
  providers: { name: string; lastSuccessAt: string | null }[];
  jobs: { queued: number; running: number; retryWait: number; failed: number };
  runningRuns: { kind: string; startedAt: string }[];
}

interface TodayOperationsRows {
  steamLastSyncAt: Date | null;
  rawgLastFetchedAt: Date | null;
  itadLastFinishedAt: Date | null;
  compatibilityLastFetchedAt: Date | null;
  jobStatuses: readonly string[];
  runningRuns: readonly { kind: string; startedAt: Date }[];
}

export function aggregateTodayOperations(rows: TodayOperationsRows): TodayOperationsView {
  return {
    providers: [
      { name: "Steam", lastSuccessAt: rows.steamLastSyncAt?.toISOString() ?? null },
      { name: "RAWG", lastSuccessAt: rows.rawgLastFetchedAt?.toISOString() ?? null },
      { name: "ITAD", lastSuccessAt: rows.itadLastFinishedAt?.toISOString() ?? null },
      { name: "Compatibility", lastSuccessAt: rows.compatibilityLastFetchedAt?.toISOString() ?? null },
    ],
    jobs: {
      queued: rows.jobStatuses.filter((status) => status === "QUEUED").length,
      running: rows.jobStatuses.filter((status) => status === "RUNNING").length,
      retryWait: rows.jobStatuses.filter((status) => status === "RETRY_WAIT").length,
      failed: rows.jobStatuses.filter((status) => status === "FAILED").length,
    },
    runningRuns: rows.runningRuns.map((run) => ({ kind: run.kind, startedAt: run.startedAt.toISOString() })),
  };
}

export async function loadTodayOperations(
  client: Pick<Prisma.TransactionClient, "steamConnection" | "metadataSnapshot" | "priceRefresh" | "compatibilitySnapshot" | "enrichmentJob" | "syncRun" | "wishlistCompatSweep"> = prisma,
): Promise<TodayOperationsView> {
  const [steam, rawg, itad, compatibility, jobs, syncRuns, priceRuns, compatibilityRuns] = await Promise.all([
    client.steamConnection.findUnique({ where: { id: 1 }, select: { lastSyncAt: true } }),
    client.metadataSnapshot.findFirst({ where: { provider: "RAWG" }, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    client.priceRefresh.findFirst({ where: { status: { in: ["SUCCESS", "PARTIAL"] } }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } }),
    client.compatibilitySnapshot.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    client.enrichmentJob.findMany({ select: { status: true } }),
    client.syncRun.findMany({ where: { status: "RUNNING" }, select: { provider: true, startedAt: true } }),
    client.priceRefresh.findMany({ where: { status: "RUNNING" }, select: { requestedAt: true } }),
    client.wishlistCompatSweep.findMany({ where: { status: "RUNNING" }, select: { requestedAt: true } }),
  ]);
  return aggregateTodayOperations({
    steamLastSyncAt: steam?.lastSyncAt ?? null,
    rawgLastFetchedAt: rawg?.fetchedAt ?? null,
    itadLastFinishedAt: itad?.finishedAt ?? null,
    compatibilityLastFetchedAt: compatibility?.fetchedAt ?? null,
    jobStatuses: jobs.map((job) => job.status),
    runningRuns: [
      ...syncRuns.map((run) => ({ kind: `Sync ${run.provider}`, startedAt: run.startedAt })),
      ...priceRuns.map((run) => ({ kind: "Price refresh", startedAt: run.requestedAt })),
      ...compatibilityRuns.map((run) => ({ kind: "Wishlist compatibility sweep", startedAt: run.requestedAt })),
    ],
  });
}
