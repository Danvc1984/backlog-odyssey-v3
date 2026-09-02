import { prisma } from "@/lib/prisma";
import { SteamConnectionCard } from "@/components/steam/SteamConnectionCard";
import { UnresolvedDlcReviewCard } from "@/components/steam/UnresolvedDlcReviewCard";
import { CompatibilitySweepPanel } from "@/components/games/CompatibilitySweepPanel";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { getLatestCompatBatchStatus } from "@/lib/compat-batch-runner";
import { RestartRecommendationsSection } from "@/components/recommendations/RestartRecommendationsSection";
import { RecommendationProfileSection } from "@/components/recommendations/RecommendationProfileSection";
import { AlternativeSourcesCard } from "@/components/sources/AlternativeSourcesCard";
import { ImportSteamWishlistButton } from "@/components/wishlist/ImportSteamWishlistButton";
import { WishlistSyncChip } from "@/components/wishlist/WishlistSyncChip";
import { WishlistCompatSweepPanel } from "@/components/wishlist/WishlistCompatSweepPanel";
import {
  RawgBatchEnrichmentButton,
  RawgBatchEnrichmentPanel,
} from "@/components/games/RawgBatchEnrichmentPanel";
import { getLatestRawgBatchStatus } from "@/lib/rawg-batch-runner";
import { getLatestWishlistCompatSweep } from "@/actions/wishlist-compatibility";

export default async function SettingsPage() {
  const [steamConnection, unresolvedDlcs, baseGames, latestCompatBatch, latestRawgBatch, latestWishlistSweep, profile, preferences, sources] = await Promise.all([
    prisma.steamConnection.findUnique({ where: { id: 1 } }),
    prisma.unresolvedSteamDlc.findMany({
      select: { id: true, steamAppId: true, name: true, steamBaseAppId: true, source: true, status: true },
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
    prisma.recommendationProfile.findUnique({ where: { id: 1 }, select: { payload: true, rebuiltAt: true } }),
    prisma.recommendationPreference.findMany({ orderBy: [{ dimension: "asc" }, { value: "asc" }] }),
    prisma.alternativeSource.findMany({
      include: { _count: { select: { availability: true } } },
      orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>

      <AppearanceSection />

      <section className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Library and wishlist operations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Run imports, enrichment, and compatibility updates when you need them.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <WishlistSyncChip />
            <ImportSteamWishlistButton />
            <RawgBatchEnrichmentButton />
          </div>
        </div>
        <WishlistCompatSweepPanel
          initialRun={
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
        <RawgBatchEnrichmentPanel initialBatch={latestRawgBatch?.data ?? null} />
      </section>

      <CompatibilitySweepPanel initialBatch={latestCompatBatch?.data ?? null} />

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Connected services
        </h2>
        <SteamConnectionCard
          connected={Boolean(steamConnection)}
          steamId64={steamConnection?.steamId64 ?? null}
        />
      </section>

      <UnresolvedDlcReviewCard items={unresolvedDlcs} baseGames={baseGames} />
      <AlternativeSourcesCard sources={sources} />
      <RecommendationProfileSection profile={profile} preferences={preferences} />
      <RestartRecommendationsSection />
    </div>
  );
}
