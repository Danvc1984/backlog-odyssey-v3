import { prisma } from "@/lib/prisma";
import { SteamConnectionCard } from "@/components/steam/SteamConnectionCard";
import { UnresolvedDlcReviewCard } from "@/components/steam/UnresolvedDlcReviewCard";
import { CompatibilitySweepPanel } from "@/components/games/CompatibilitySweepPanel";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { getLatestCompatBatchStatus } from "@/lib/compat-batch-runner";
import { RestartRecommendationsSection } from "@/components/recommendations/RestartRecommendationsSection";
import { RecommendationProfileSection } from "@/components/recommendations/RecommendationProfileSection";
import { AlternativeSourcesCard } from "@/components/sources/AlternativeSourcesCard";

export default async function SettingsPage() {
  const [steamConnection, unresolvedDlcs, baseGames, latestCompatBatch, profile, preferences, sources] = await Promise.all([
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
