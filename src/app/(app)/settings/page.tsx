import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { signOut } from "@/lib/auth";
import { SteamConnectionCard } from "@/components/steam/SteamConnectionCard";
import { UnresolvedDlcReviewCard } from "@/components/steam/UnresolvedDlcReviewCard";
import { CompatibilitySweepPanel } from "@/components/games/CompatibilitySweepPanel";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { SessionCard } from "@/components/settings/SessionCard";
import { EnvironmentCard } from "@/components/settings/EnvironmentCard";
import { WishlistImportStatusCard } from "@/components/settings/WishlistImportStatusCard";
import { PriceStatusCard } from "@/components/settings/PriceStatusCard";
import { EnrichmentQueueCard } from "@/components/settings/EnrichmentQueueCard";
import { DataExportCard } from "@/components/settings/DataExportCard";
import { getLatestCompatBatchStatus } from "@/lib/compat-batch-runner";
import { RecommendationProfileSection } from "@/components/recommendations/RecommendationProfileSection";
import { AlternativeSourcesCard } from "@/components/sources/AlternativeSourcesCard";
import { type RawgBatchView } from "@/lib/rawg-batch-runner";
import { getLatestRawgBatchStatus } from "@/lib/rawg-batch-runner";
import { getLatestWishlistCompatSweep } from "@/actions/wishlist-compatibility";

export default async function SettingsPage() {
  const session = await requireUser();
  const [
    steamConnection,
    appSettings,
    unresolvedDlcs,
    baseGames,
    latestCompatBatch,
    latestRawgBatch,
    latestWishlistSweep,
    profile,
    preferences,
    sources,
    openWishlistImportReviews,
    ignoredWishlistImports,
    wallpaperState,
    latestPriceRefresh,
    enrichmentJobs,
    exportGameCount,
    exportWishlistCount,
    exportRecommendationRunCount,
  ] = await Promise.all([
    prisma.steamConnection.findUnique({ where: { id: 1 } }),
    prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        wallpaperEnabled: true,
        desktopOs: true,
        portableDevice: true,
        fallbackOs: true,
        priceCountry: true,
        timeZone: true,
      },
    }),
    prisma.unresolvedSteamDlc.findMany({
      select: {
        id: true,
        steamAppId: true,
        name: true,
        steamBaseAppId: true,
        source: true,
        status: true,
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    prisma.game.findMany({
      where: { type: "BASE_GAME" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getLatestCompatBatchStatus(),
    getLatestRawgBatchStatus(),
    getLatestWishlistCompatSweep(),
    prisma.recommendationProfile.findUnique({
      where: { id: 1 },
      select: { payload: true, rebuiltAt: true },
    }),
    prisma.recommendationPreference.findMany({
      orderBy: [{ dimension: "asc" }, { value: "asc" }],
    }),
    prisma.alternativeSource.findMany({
      include: { _count: { select: { availability: true } } },
      orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    }),
    prisma.wishlistImportReview.count({ where: { status: "OPEN" } }),
    prisma.wishlistImportIgnore.count(),
    prisma.wallpaperState.findUnique({
      where: { id: 1 },
      select: { cachedAt: true, lastError: true },
    }),
    prisma.priceRefresh.findFirst({
      orderBy: { requestedAt: "desc" },
      select: { id: true, status: true, counts: true, requestedAt: true, finishedAt: true },
    }),
    prisma.enrichmentJob.findMany({
      select: {
        id: true,
        provider: true,
        status: true,
        stage: true,
        lastErrorMessage: true,
        finishedAt: true,
        game: { select: { id: true, name: true } },
      },
    }),
    prisma.game.count(),
    prisma.wishlistEntry.count(),
    prisma.recommendationRun.count(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="technical-label text-muted-foreground">Platform settings</p>
        <h1 className="mt-2">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Control account connections, visual preferences, provider maintenance, and recommendation behavior.
        </p>
      </div>
      <SessionCard
        email={session.user?.email ?? null}
        signOutAction={async () => {
          "use server";
          await signOut();
        }}
      />
      <EnvironmentCard settings={appSettings} />
      <WishlistImportStatusCard
        openReviews={openWishlistImportReviews}
        ignored={ignoredWishlistImports}
      />
      <PriceStatusCard lastRun={latestPriceRefresh} />
      <EnrichmentQueueCard
        jobs={enrichmentJobs.map((job) => ({
          id: job.id,
          provider: job.provider,
          status: job.status,
          stage: job.stage,
          error: job.lastErrorMessage,
          finishedAt: job.finishedAt,
          gameId: job.game.id,
          gameName: job.game.name,
        }))}
      />
      <SteamConnectionCard
        connected={Boolean(steamConnection)}
        steamId64={steamConnection?.steamId64 ?? null}
      />
      <AppearanceSection
        initialWallpaperEnabled={appSettings?.wallpaperEnabled ?? true}
        poolCachedAt={wallpaperState?.cachedAt ?? null}
        lastError={wallpaperState?.lastError ?? null}
      />

      <CompatibilitySweepPanel
        initialBatch={latestCompatBatch?.data ?? null}
        initialRawgBatch={
          (latestRawgBatch?.data ?? null) as RawgBatchView | null
        }
        initialWishlistRun={
          latestWishlistSweep.data
            ? {
                id: latestWishlistSweep.data.id,
                status: latestWishlistSweep.data.status,
                counts: latestWishlistSweep.data.counts,
                requestedAt: latestWishlistSweep.data.requestedAt,
                finishedAt: latestWishlistSweep.data.finishedAt,
              }
            : null
        }
      />
      <RecommendationProfileSection
        profile={profile}
        preferences={preferences}
      />
      <AlternativeSourcesCard sources={sources} />
      <UnresolvedDlcReviewCard items={unresolvedDlcs} baseGames={baseGames} />
      <DataExportCard
        gameCount={exportGameCount}
        wishlistCount={exportWishlistCount}
        recommendationRunCount={exportRecommendationRunCount}
      />
    </div>
  );
}
