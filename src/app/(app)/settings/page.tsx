import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { signOut } from "@/lib/auth";
import { SteamConnectionCard } from "@/components/steam/SteamConnectionCard";
import { UnresolvedDlcReviewCard } from "@/components/steam/UnresolvedDlcReviewCard";
import { CompatibilitySweepPanel } from "@/components/games/CompatibilitySweepPanel";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { AccountCard } from "@/components/settings/AccountCard";
import { WishlistImportStatusCard } from "@/components/settings/WishlistImportStatusCard";
import { PriceStatusCard } from "@/components/settings/PriceStatusCard";
import { PersonalDataCard } from "@/components/settings/PersonalDataCard";
import { getLatestCompatBatchStatus } from "@/lib/compat-batch-runner";
import { RecommendationProfileSection } from "@/components/recommendations/RecommendationProfileSection";
import { AlternativeSourcesCard } from "@/components/sources/AlternativeSourcesCard";
import { type RawgBatchView } from "@/lib/rawg-batch-runner";
import { getLatestRawgBatchStatus } from "@/lib/rawg-batch-runner";
import { getLatestWishlistCompatSweep } from "@/actions/wishlist-compatibility";
import { isCompatibilityActive } from "@/lib/os-setup";

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
        primaryOs: true,
        hasWindowsFallback: true,
        handheldOs: true,
        onboardingCompleted: true,
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
          Keep the ship&apos;s connections, appearance, provider upkeep, and recommendation course in your hands.
        </p>
      </div>
      <section className="space-y-6">
        <h2>Account</h2>
        <AccountCard
          email={session.user?.email ?? null}
          signOutAction={async () => {
            "use server";
            await signOut();
          }}
          settings={appSettings}
        />
      </section>
      <section className="space-y-6">
        <h2>Steam and catalog sources</h2>
        <SteamConnectionCard
          connected={Boolean(steamConnection)}
          steamId64={steamConnection?.steamId64 ?? null}
        />
        <WishlistImportStatusCard
          openReviews={openWishlistImportReviews}
          ignored={ignoredWishlistImports}
        />
        <UnresolvedDlcReviewCard items={unresolvedDlcs} baseGames={baseGames} />
        <AlternativeSourcesCard sources={sources} />
      </section>
      <section className="space-y-6">
        <h2>Provider queues</h2>
        <PriceStatusCard lastRun={latestPriceRefresh} />
        <CompatibilitySweepPanel
          compatibilityActive={appSettings ? isCompatibilityActive(appSettings) : false}
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
          failedJobs={enrichmentJobs
            .filter((job) => job.status === "FAILED")
            .sort(
              (a, b) =>
                (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0),
            )
            .slice(0, 10)
            .map((job) => ({
              id: job.id,
              provider: job.provider,
              error: job.lastErrorMessage,
              finishedAt: job.finishedAt,
              gameId: job.game.id,
              gameName: job.game.name,
            }))}
        />
      </section>
      <section className="space-y-6">
        <h2>Appearance</h2>
        <AppearanceSection
          initialWallpaperEnabled={appSettings?.wallpaperEnabled ?? true}
          poolCachedAt={wallpaperState?.cachedAt ?? null}
          lastError={wallpaperState?.lastError ?? null}
        />
      </section>
      <section className="space-y-6">
        <h2>Recommendations</h2>
        <RecommendationProfileSection
          profile={profile}
          preferences={preferences}
        />
      </section>
      <section className="space-y-6">
        <h2>Personal data</h2>
        <PersonalDataCard
          gameCount={exportGameCount}
          wishlistCount={exportWishlistCount}
          recommendationRunCount={exportRecommendationRunCount}
        />
      </section>
    </div>
  );
}
