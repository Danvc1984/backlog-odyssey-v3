import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface TodayOperationsView {
  providers: { name: string; lastSuccessAt: string | null }[];
  jobs: { queued: number; running: number; retryWait: number; failed: number };
  runningRuns: { kind: string; startedAt: string }[];
}

interface TodayOperationsRows {
  steamLastSyncAt: Date | null;
  steamActivityRefreshedAt: Date | null;
  steamActivityLastError: string | null;
  rawgLastFetchedAt: Date | null;
  itadLastFinishedAt: Date | null;
  compatibilityLastFetchedAt: Date | null;
  hasLinuxTargets: boolean;
  jobStatuses: readonly string[];
  runningRuns: readonly { kind: string; startedAt: Date }[];
}

export function aggregateTodayOperations(rows: TodayOperationsRows): TodayOperationsView {
  const steamLastSuccessAt =
    rows.steamActivityLastError === null
      ? rows.steamActivityRefreshedAt ?? rows.steamLastSyncAt
      : rows.steamLastSyncAt;
  const providers = [
    { name: "Steam", lastSuccessAt: steamLastSuccessAt?.toISOString() ?? null },
    { name: "RAWG", lastSuccessAt: rows.rawgLastFetchedAt?.toISOString() ?? null },
    { name: "ITAD", lastSuccessAt: rows.itadLastFinishedAt?.toISOString() ?? null },
  ];
  if (rows.hasLinuxTargets) {
    providers.push({
      name: "Compatibility",
      lastSuccessAt: rows.compatibilityLastFetchedAt?.toISOString() ?? null,
    });
  }
  return {
    providers,
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
  client: Pick<Prisma.TransactionClient, "appSettings" | "steamConnection" | "steamRecentActivityCache" | "metadataSnapshot" | "priceRefresh" | "compatibilitySnapshot" | "enrichmentJob" | "syncRun" | "wishlistCompatSweep"> = prisma,
): Promise<TodayOperationsView> {
  const [settings, steam, activity, rawg, itad, compatibility, jobs, syncRuns, priceRuns, compatibilityRuns] = await Promise.all([
    client.appSettings.findUnique({ where: { id: 1 }, select: { primaryOs: true, handheldOs: true } }),
    client.steamConnection.findUnique({ where: { id: 1 }, select: { lastSyncAt: true } }),
    client.steamRecentActivityCache.findUnique({ where: { id: 1 }, select: { refreshedAt: true, lastError: true } }),
    client.metadataSnapshot.findFirst({ where: { provider: "RAWG" }, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    client.priceRefresh.findFirst({ where: { status: { in: ["SUCCESS", "PARTIAL"] } }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } }),
    client.compatibilitySnapshot.findFirst({ orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    client.enrichmentJob.findMany({
      where: {
        game: {
          OR: [
            { libraryEntry: { is: null } },
            { libraryEntry: { is: { hidden: false } } },
          ],
        },
      },
      select: { status: true },
    }),
    client.syncRun.findMany({ where: { status: "RUNNING" }, select: { provider: true, startedAt: true } }),
    client.priceRefresh.findMany({ where: { status: "RUNNING" }, select: { requestedAt: true } }),
    client.wishlistCompatSweep.findMany({ where: { status: "RUNNING" }, select: { requestedAt: true } }),
  ]);
  return aggregateTodayOperations({
    steamLastSyncAt: steam?.lastSyncAt ?? null,
    steamActivityRefreshedAt: activity?.refreshedAt ?? null,
    steamActivityLastError: activity?.lastError ?? null,
    rawgLastFetchedAt: rawg?.fetchedAt ?? null,
    itadLastFinishedAt: itad?.finishedAt ?? null,
    compatibilityLastFetchedAt: compatibility?.fetchedAt ?? null,
    hasLinuxTargets: settings?.primaryOs === "LINUX" || settings?.handheldOs === "LINUX",
    jobStatuses: jobs.map((job) => job.status),
    runningRuns: [
      ...syncRuns.map((run) => ({ kind: `Sync ${run.provider}`, startedAt: run.startedAt })),
      ...priceRuns.map((run) => ({ kind: "Price refresh", startedAt: run.requestedAt })),
      ...compatibilityRuns.map((run) => ({ kind: "Wishlist compatibility sweep", startedAt: run.requestedAt })),
    ],
  });
}
