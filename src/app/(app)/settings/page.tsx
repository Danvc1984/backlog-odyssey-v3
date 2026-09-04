import { prisma } from "@/lib/prisma";
import { SteamConnectionCard } from "@/components/steam/SteamConnectionCard";
import { UnresolvedDlcReviewCard } from "@/components/steam/UnresolvedDlcReviewCard";
import { CompatibilitySweepPanel } from "@/components/games/CompatibilitySweepPanel";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { getLatestCompatBatchStatus } from "@/lib/compat-batch-runner";
import { RecommendationProfileSection } from "@/components/recommendations/RecommendationProfileSection";
import { AlternativeSourcesCard } from "@/components/sources/AlternativeSourcesCard";
import { type RawgBatchView } from "@/lib/rawg-batch-runner";
import { getLatestRawgBatchStatus } from "@/lib/rawg-batch-runner";
import { getLatestWishlistCompatSweep } from "@/actions/wishlist-compatibility";

export default async function SettingsPage() {
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
  ] = await Promise.all([
    prisma.steamConnection.findUnique({ where: { id: 1 } }),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { wallpaperEnabled: true } }),
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
      <SteamConnectionCard
        connected={Boolean(steamConnection)}
        steamId64={steamConnection?.steamId64 ?? null}
      />
      <AppearanceSection initialWallpaperEnabled={appSettings?.wallpaperEnabled ?? true} />

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
    </div>
  );
}
