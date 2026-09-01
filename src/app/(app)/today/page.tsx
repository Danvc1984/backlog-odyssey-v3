import {
  RecommendationItemCard,
} from "@/components/recommendations/RecommendationItemCard";
import { ShowAnotherButton } from "@/components/recommendations/ShowAnotherButton";
import { PlayNextRailCard } from "@/components/recommendations/PlayNextRailCard";
import {
  UpdateRecommendationsButton,
} from "@/components/recommendations/UpdateRecommendationsButton";
import { ColdStartNote } from "@/components/recommendations/ColdStartNote";
import { prisma } from "@/lib/prisma";
import { RunExposureTracker } from "@/components/recommendations/RunExposureTracker";
import { TuneThisRunPanel } from "@/components/recommendations/TuneThisRunPanel";
import { TasteSetupPanel } from "@/components/recommendations/TasteSetupPanel";
import { listKnownGenreTagValues, listRecommendationPresets } from "@/actions/recommendations";
import { tuneContextSchema, type TuneContext } from "@/lib/recommendations/types";
import { loadPickableTasteSetupGames, selectInitialTasteSetupPicks, shouldShowTasteSetup } from "@/lib/recommendations/taste-setup";
import { resolveSourcePresentation } from "@/lib/sources/known-sources";
import { refreshSteamActivityCacheIfStale } from "@/lib/steam-activity";
import { RecentSteamActivity } from "@/components/today/RecentSteamActivity";
import { TodayDataHealth, TodaySummary } from "@/components/today/TodaySummary";
import { loadTodayDataHealth } from "@/lib/today-data-health";
import { CoverageDialog } from "@/components/today/CoverageDialog";
import { FeaturedOffersCarousel } from "@/components/today/FeaturedOffersCarousel";
import { rankTodayOffers } from "@/lib/today-offers";
import { loadTodayOperations } from "@/lib/today-operations";
import { TodayOperations } from "@/components/today/TodayOperations";

const PLAY_ROLE_GROUPS = [
  { label: "Best fit", roles: ["BEST_FIT_1", "BEST_FIT_2"] },
  { label: "Out of the box", roles: ["OUT_OF_THE_BOX"] },
  { label: "Change of pace", roles: ["CHANGE_OF_PACE"] },
] as const;

const BUY_ROLE_GROUPS = [
  { label: "Best fit", roles: ["BEST_FIT_1", "BEST_FIT_2"] },
  { label: "Deal", roles: ["DEAL"] },
] as const;

function hasRole(roles: readonly string[], role: string | null): boolean {
  return role !== null && roles.includes(role);
}

function storedTune(value: unknown): TuneContext | null {
  const parsed = tuneContextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export default async function TodayPage() {
  const latestPlayNextRun = await prisma.recommendationRun.findFirst({
    where: { kind: "PLAY_NEXT" },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { rank: "asc" },
        include: { game: { select: { name: true } } },
      },
    },
  });
  const latestBuyRun = await prisma.recommendationRun.findFirst({
    where: { kind: "BUY" },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        where: { wishlistEntryId: { not: null } },
        orderBy: { rank: "asc" },
        include: { wishlistEntry: { select: { name: true } } },
      },
    },
  });
  const tuneState = await prisma.recommendationTuneState.findUnique({ where: { id: 1 }, select: { playTune: true, buyTune: true } });
  const knownValuesResult = await listKnownGenreTagValues();
  const knownValues = knownValuesResult.success ? knownValuesResult.data : { genres: [], tags: [] };
  const presetsResult = await listRecommendationPresets();
  const presets = presetsResult.success ? presetsResult.data.map((preset) => ({ id: preset.id, name: preset.name })) : [];
  const alternativeSources = await prisma.alternativeSource.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const tasteGames = await loadPickableTasteSetupGames(prisma);
  const tasteEventCount = await prisma.recommendationEvent.count({ where: { kind: "TASTE_SETUP_ANSWER" } });
  const initialTastePicks = selectInitialTasteSetupPicks(tasteGames);
  const showTasteSetup = shouldShowTasteSetup(tasteEventCount, tasteGames.length);
  const todayGames = await prisma.game.findMany({
    where: {
      type: "BASE_GAME",
      libraryEntry: { is: { hidden: false } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      libraryEntry: { select: { isMainGame: true, playState: true } },
    },
  });
  const dataHealth = await loadTodayDataHealth(prisma);
  const wishlistEntries = await prisma.wishlistEntry.findMany({
    select: {
      id: true,
      name: true,
      targetPriceMxn: true,
      offers: { orderBy: [{ price: { sort: "asc", nulls: "last" } }] },
    },
  });
  const todayOffers = rankTodayOffers(
    wishlistEntries.map(({ id, name, targetPriceMxn, offers }) => ({
      wishlistEntryId: id,
      gameName: name,
      targetPriceMxn,
      offers,
    })),
    new Date(),
  );
  const todayOperations = await loadTodayOperations(prisma);
  const playContext = latestPlayNextRun?.context as { rerank?: { mode?: string }; tune?: { thinPool?: boolean } } | null | undefined;
  const buyContext = latestBuyRun?.context as { tune?: { thinPool?: boolean } } | null | undefined;

  const items = latestPlayNextRun?.items ?? [];
  const buyItems = latestBuyRun?.items ?? [];
  const coldStart = playContext?.rerank?.mode === "COLD_START";
  const hasPlayRoles = items.some((item) => item.role !== null);
  const hasBuyRoles = buyItems.some((item) => item.role !== null);
  const steamActivityView = await refreshSteamActivityCacheIfStale();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-semibold tracking-tight">Today</h1>
          <p className="mt-2 max-w-xl text-base text-muted-foreground">
            What to play next from your backlog.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <UpdateRecommendationsButton />
          {latestPlayNextRun && (
            <p className="technical-label text-muted-foreground">
              Latest run {latestPlayNextRun.createdAt.toLocaleString()}
            </p>
          )}
        </div>
      </header>

      {showTasteSetup && (
        <TasteSetupPanel
          games={tasteGames.map((game) => ({ id: game.id, name: game.name }))}
          initialPicks={initialTastePicks.map((pick) => ({ id: pick.id, name: pick.name }))}
        />
      )}

      <TodaySummary
        games={todayGames}
      />

      <FeaturedOffersCarousel offers={todayOffers} />

      {!latestPlayNextRun && (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No recommendations yet. Update recommendations to build your play next list.
          </p>
          <div className="mt-4 flex justify-center">
            <UpdateRecommendationsButton />
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Play next
        </h2>
        <TuneThisRunPanel engine="PLAY_NEXT" initialTune={storedTune(tuneState?.playTune)} knownValues={knownValues} thinPool={playContext?.tune?.thinPool === true} presets={presets} alternativeSources={alternativeSources.map((source) => ({ ...source, iconName: resolveSourcePresentation(source.name).iconName }))} />
        {latestPlayNextRun && <ColdStartNote visible={coldStart} />}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible games right now.</p>
        ) : !hasPlayRoles ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              if (!item.gameId) return null;
              return (
                <RecommendationItemCard
                  key={item.id}
                  target={{ kind: "PLAY_NEXT", gameId: item.gameId }}
                  runId={latestPlayNextRun?.id}
                  name={item.game?.name ?? "Unknown game"}
                  rank={item.rank}
                  score={item.score}
                  positive={item.positive}
                  negative={item.negative}
                  caveats={item.caveats}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            {(() => {
              const roleItems = PLAY_ROLE_GROUPS.flatMap((group) => group.roles.map((role) => items.find((item) => item.role === role && item.gameId)) .filter((item): item is (typeof items)[number] => item !== undefined));
              const dominant = roleItems.find((item) => item.role === "BEST_FIT_1") ?? roleItems[0];
              if (!dominant?.gameId || !dominant.role) return null;
              const railItems = roleItems.filter((item) => item.id !== dominant.id);
              return (
                <>
                  <div className="xl:w-2/3">
                    <ShowAnotherButton
                      runId={latestPlayNextRun?.id ?? ""}
                      role={dominant.role}
                      itemId={dominant.id}
                      target={{ kind: "PLAY_NEXT", gameId: dominant.gameId }}
                      name={dominant.game?.name ?? "Unknown game"}
                      rank={dominant.rank}
                      score={dominant.score}
                      positive={dominant.positive}
                      negative={dominant.negative}
                      caveats={dominant.caveats}
                    />
                  </div>
                  {railItems.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:w-1/3 xl:grid-cols-1">
                      {railItems.map((item) => (
                        <PlayNextRailCard
                          key={item.id}
                          runId={latestPlayNextRun?.id ?? ""}
                          role={item.role!}
                          itemId={item.id}
                          gameId={item.gameId!}
                          name={item.game?.name ?? "Unknown game"}
                          rank={item.rank}
                          score={item.score}
                          positive={item.positive}
                          negative={item.negative}
                          caveats={item.caveats}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </section>

      {latestPlayNextRun && (
        <RunExposureTracker
          runId={latestPlayNextRun.id}
          items={items.flatMap((item) => item.gameId ? [{ gameId: item.gameId, role: item.role ?? undefined }] : [])}
        />
      )}
      {latestBuyRun && (
        <RunExposureTracker
          runId={latestBuyRun.id}
          items={buyItems.flatMap((item) => item.wishlistEntryId ? [{ wishlistEntryId: item.wishlistEntryId, role: item.role ?? undefined }] : [])}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Buy
        </h2>
        <TuneThisRunPanel engine="BUY" initialTune={storedTune(tuneState?.buyTune)} knownValues={knownValues} thinPool={buyContext?.tune?.thinPool === true} presets={presets} />
        {!latestBuyRun ? (
          <p className="text-sm text-muted-foreground">
            No buy recommendations yet. Update recommendations to score your wishlist.
          </p>
        ) : buyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible wishlist purchases right now.</p>
        ) : !hasBuyRoles ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {buyItems.map((item) => {
              if (!item.wishlistEntryId) return null;
              return (
                <RecommendationItemCard
                  key={item.id}
                  target={{ kind: "BUY", wishlistEntryId: item.wishlistEntryId }}
                  runId={latestBuyRun?.id}
                  name={item.wishlistEntry?.name ?? "Unknown game"}
                  rank={item.rank}
                  score={item.score}
                  positive={item.positive}
                  negative={item.negative}
                  caveats={item.caveats}
                />
              );
            })}
          </div>
        ) : (
          <div className="space-y-5">
            {BUY_ROLE_GROUPS.map((group) => {
              const groupItems = buyItems.filter((item) => hasRole(group.roles, item.role));
              if (groupItems.length === 0) return null;
              return (
                <div key={group.label}>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">{group.label}</h3>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {groupItems.map((item) => item.wishlistEntryId && item.role ? (
                      <ShowAnotherButton
                        key={item.id}
                        runId={latestBuyRun?.id ?? ""}
                        role={item.role}
                        itemId={item.id}
                        target={{ kind: "BUY", wishlistEntryId: item.wishlistEntryId }}
                        name={item.wishlistEntry?.name ?? "Unknown game"}
                        rank={item.rank}
                        score={item.score}
                        positive={item.positive}
                        negative={item.negative}
                        caveats={item.caveats}
                      />
                    ) : null)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Recent Steam activity
        </h2>
        <RecentSteamActivity view={steamActivityView} />
      </section>

      <div className="space-y-4">
        <TodayDataHealth activeBacklog={dataHealth.activeBacklog} abandoned={dataHealth.abandoned} />
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Catalog coverage
          </h2>
          <CoverageDialog
            label="games missing RAWG metadata"
            basis="Based on provider metadata coverage for visible base games."
            titles={dataHealth.rawgMetadata.missing}
          />
          <CoverageDialog
            label="games with incomplete recommendation profiles"
            basis="Based on local personal fields: interest plus priority, preferred environment, or game experience."
            titles={dataHealth.recommendationProfile.incomplete}
          />
        </section>
      </div>

      <TodayOperations view={todayOperations} />
    </div>
  );
}
