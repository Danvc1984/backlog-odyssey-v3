import { RecommendationSpotlightCarousel } from "@/components/recommendations/RecommendationSpotlightCarousel";
import { UpdateRecommendationsButton } from "@/components/recommendations/UpdateRecommendationsButton";
import { ColdStartNote } from "@/components/recommendations/ColdStartNote";
import { prisma } from "@/lib/prisma";
import { TuneThisRunPanel } from "@/components/recommendations/TuneThisRunPanel";
import { TasteSetupPanel } from "@/components/recommendations/TasteSetupPanel";
import {
  loadKnownGenreTagValues,
  loadRecommendationPresets,
} from "@/lib/recommendations/queries";
import {
  loadPickableTasteSetupGames,
  hasCompletedTasteSetup,
  selectInitialTasteSetupPicks,
  shouldShowTasteSetup,
} from "@/lib/recommendations/taste-setup";
import { resolveSourcePresentation } from "@/lib/sources/known-sources";
import { refreshSteamActivityCacheIfStale } from "@/lib/steam-activity";
import { RecentSteamActivity } from "@/components/today/RecentSteamActivity";
import { SteamActivityRefreshButton } from "@/components/today/SteamActivityRefreshButton";
import { TodayDataHealth } from "@/components/today/TodaySummary";
import { loadTodayDataHealth } from "@/lib/today-data-health";
import { CoverageDialog } from "@/components/today/CoverageDialog";
import { TodayHeroGrid } from "@/components/today/TodayHeroGrid";
import { rankTodayOffers } from "@/lib/today-offers";
import { loadTodayOperations } from "@/lib/today-operations";
import { formatMexicoTimestamp } from "@/lib/format-times";
import { igdbLibraryCardMetadataView } from "@/lib/card-metadata-view";
import { parseIgdbMetadataPayload } from "@/lib/igdb-metadata-payload";
import { SectionCard } from "@/components/ui/detail-card";
import { buildEntryOfferView } from "@/lib/offer-selection";
import { formatPlayExclusionReasons } from "@/lib/recommendations/environment-fit";
import type { TuneContext } from "@/lib/recommendations/types";

const PLAY_ROLE_ORDER = ["BEST_FIT_1", "BEST_FIT_2", "OUT_OF_THE_BOX", "CHANGE_OF_PACE", "HANDHELD_PICK"] as const;
const BUY_ROLE_ORDER = ["BEST_FIT_1", "BEST_FIT_2", "DEAL"] as const;

export default async function TodayPage() {
  const [
    latestPlayNextRun,
    latestBuyRun,
    knownValues,
    presets,
    tuneState,
    alternativeSources,
    tasteGames,
    tasteSetupEvents,
    libraryBaseGameCount,
    todayGames,
    dataHealth,
    wishlistEntries,
    todayOperations,
    steamActivityView,
    todaySettings,
  ] = await Promise.all([
    prisma.recommendationRun.findFirst({
      where: { kind: "PLAY_NEXT" },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { rank: "asc" },
          include: {
            game: {
              select: {
                name: true,
                metadataSnapshots: {
                  where: { provider: "IGDB" },
                  orderBy: { fetchedAt: "desc" },
                  take: 1,
                  select: { payload: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.recommendationRun.findFirst({
      where: { kind: "BUY" },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          where: { wishlistEntryId: { not: null } },
          orderBy: { rank: "asc" },
          include: {
            wishlistEntry: {
              select: {
                name: true,
                metadataSnapshot: { select: { payload: true } },
                baseGame: {
                  select: {
                    name: true,
                    metadataSnapshots: {
                      where: { provider: "IGDB" },
                      orderBy: { fetchedAt: "desc" },
                      take: 1,
                      select: { payload: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    loadKnownGenreTagValues(),
    loadRecommendationPresets(),
    prisma.recommendationTuneState.findUnique({ where: { id: 1 }, select: { playTune: true, buyTune: true } }),
    prisma.alternativeSource.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    loadPickableTasteSetupGames(prisma),
    prisma.recommendationEvent.findMany({
      where: { kind: "TASTE_SETUP_ANSWER" },
      select: { payload: true },
    }),
    prisma.game.count({
      where: { type: "BASE_GAME", libraryEntry: { isNot: null } },
    }),
    prisma.game.findMany({
      where: {
        type: "BASE_GAME",
        libraryEntry: {
          is: {
            hidden: false,
            OR: [{ isMainGame: true }, { playState: "IN_PROGRESS" }],
          },
        },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        libraryEntry: { select: { isMainGame: true, playState: true, interest: true } },
        metadataSnapshots: {
          where: { provider: "IGDB" },
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { payload: true },
        },
      },
    }),
    loadTodayDataHealth(prisma),
    prisma.wishlistEntry.findMany({
      select: {
        id: true,
        name: true,
        targetPriceMxn: true,
        offers: { orderBy: [{ price: { sort: "asc", nulls: "last" } }] },
        metadataSnapshot: { select: { payload: true } },
        baseGame: {
          select: {
            metadataSnapshots: {
              where: { provider: "IGDB" },
              orderBy: { fetchedAt: "desc" },
              take: 1,
              select: { payload: true },
            },
          },
        },
      },
    }),
    loadTodayOperations(prisma),
    refreshSteamActivityCacheIfStale(),
    prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { primaryOs: true, handheldOs: true },
    }),
  ]);
  const presetOptions = presets.map((preset) => ({ id: preset.id, name: preset.name }));
  const initialTastePicks = selectInitialTasteSetupPicks(tasteGames);
  const tasteSetupComplete = hasCompletedTasteSetup(tasteSetupEvents);
  const recommendationReady = tasteSetupComplete && libraryBaseGameCount >= 10;
  const showBuyRecommendations = recommendationReady && wishlistEntries.length > 0;
  const showTasteSetup = shouldShowTasteSetup(
    tasteSetupComplete,
    libraryBaseGameCount,
  );
  const heroGames = todayGames.map((game) => ({
    id: game.id,
    name: game.name,
    libraryEntry: game.libraryEntry,
    interest: game.libraryEntry?.interest ?? null,
    metadata: igdbLibraryCardMetadataView(game.metadataSnapshots[0]?.payload),
  }));
  const todayOffers = rankTodayOffers(
    wishlistEntries.map(({ id, name, targetPriceMxn, offers, metadataSnapshot, baseGame }) => {
      const ownMetadata = parseIgdbMetadataPayload(metadataSnapshot?.payload);
      const inheritedMetadata = parseIgdbMetadataPayload(baseGame?.metadataSnapshots[0]?.payload);
      return {
        wishlistEntryId: id,
        gameName: name,
        imageUrl:
          ownMetadata?.artworkUrls[0] ?? ownMetadata?.coverUrl ??
          inheritedMetadata?.artworkUrls[0] ?? inheritedMetadata?.coverUrl ?? null,
        targetPriceMxn,
        offers,
      };
    }),
    new Date(),
  );
  const selectedOfferDiscountByWishlistId = new Map(
    wishlistEntries.map((entry) => [
      entry.id,
      buildEntryOfferView(entry.offers, entry.targetPriceMxn, new Date()).selected?.discount ?? null,
    ]),
  );
  const playContext = latestPlayNextRun?.context as
    | {
        rerank?: { mode?: string };
        tune?: { thinPool?: boolean };
        play?: { exclusions?: Array<{ id: string; reason?: { label?: string } | null }> };
        roles?: { omissions?: Array<{ role?: string; label?: string }> };
      }
    | null
    | undefined;
  const buyContext = latestBuyRun?.context as
    | { tune?: { thinPool?: boolean } }
    | null
    | undefined;

  const items = latestPlayNextRun?.items ?? [];
  const buyItems = latestBuyRun?.items ?? [];
  const playItemCover = (item: (typeof items)[number]) =>
    igdbLibraryCardMetadataView(item.game?.metadataSnapshots[0]?.payload)?.wideImageUrl ?? null;
  const buyItemCover = (item: (typeof buyItems)[number]) =>
    (() => {
      const wish = parseIgdbMetadataPayload(item.wishlistEntry?.metadataSnapshot?.payload);
      const base = parseIgdbMetadataPayload(item.wishlistEntry?.baseGame?.metadataSnapshots[0]?.payload);
      return wish?.artworkUrls[0] ?? wish?.coverUrl ?? base?.artworkUrls[0] ?? base?.coverUrl ?? null;
    })();
  const coldStart = playContext?.rerank?.mode === "COLD_START";
  const playExclusions = playContext?.play?.exclusions ?? [];
  const showPlayExclusions = todaySettings?.primaryOs === "LINUX";
  const excludedPlayCount = showPlayExclusions ? playExclusions.length : 0;
  const exclusionReasons = showPlayExclusions
    ? formatPlayExclusionReasons(playExclusions)
    : null;
  const hasPlayRoles = items.some((item) => item.role !== null);
  const hasBuyRoles = buyItems.some((item) => item.role !== null);
  const activityAppIds = [
    ...steamActivityView.imported,
    ...steamActivityView.unimported,
  ]
    .map((entry) => entry.steamAppId)
    .filter((appId): appId is string => Boolean(appId));
  const activityCatalogRows = activityAppIds.length > 0
    ? await prisma.externalGameId.findMany({
        where: { namespace: "STEAM_APP", externalId: { in: activityAppIds } },
        select: {
          externalId: true,
          game: {
            select: {
              id: true,
              metadataSnapshots: {
                where: { provider: "IGDB" },
                orderBy: { fetchedAt: "desc" },
                take: 1,
                select: { payload: true },
              },
            },
          },
        },
      })
    : [];
  const activityCatalog = new Map(
    activityCatalogRows.map((row) => [
      row.externalId,
      {
        gameId: row.game.id,
        imageUrl:
          igdbLibraryCardMetadataView(row.game.metadataSnapshots[0]?.payload)?.wideImageUrl ?? null,
      },
    ]),
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1>
          Odyssey
          <span className="text-signal-strong"> dashboard</span>
        </h1>
      </header>

      <TodayHeroGrid
        games={heroGames}
        offers={todayOffers}
        showBuySignal={showBuyRecommendations}
      />

      {!recommendationReady && (
        showTasteSetup ? (
          <TasteSetupPanel
            games={tasteGames.map((game) => ({
              id: game.id,
              name: game.name,
              completedBefore: game.libraryEntry?.completedBefore ?? false,
            }))}
            initialPicks={initialTastePicks.map((pick) => ({
              id: pick.id,
              name: pick.name,
              completedBefore: pick.completedBefore,
            }))}
          />
        ) : (
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium">Taste Setup is unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add at least ten base games to your Library before recommendations can learn your preferences. You have {libraryBaseGameCount}.
            </p>
          </section>
        )
      )}

      {recommendationReady && (!latestPlayNextRun || (showBuyRecommendations && !latestBuyRun)) && (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Update recommendations to build fresh play and purchase lists.
          </p>
          <div className="mt-4 flex justify-center">
            <UpdateRecommendationsButton />
          </div>
        </div>
      )}

      {recommendationReady && latestPlayNextRun && <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.05em]">
            Play these
            <span className="text-signal-strong"> Next</span>
          </h2>
          <div className="flex flex-wrap flex-col gap-3">
            <UpdateRecommendationsButton />
            {latestPlayNextRun && (
              <p className="technical-label text-muted-foreground">
                Latest run {formatMexicoTimestamp(latestPlayNextRun.createdAt)}{" "}
                · {items.length} results
              </p>
            )}
          </div>
        </div>
        <div id="tune-play-next" className="scroll-mt-6">
          <TuneThisRunPanel
            engine="PLAY_NEXT"
            knownValues={knownValues}
            thinPool={playContext?.tune?.thinPool === true}
            initialTune={tuneState?.playTune as TuneContext | null | undefined}
            presets={presetOptions}
            alternativeSources={alternativeSources.map((source) => ({
              ...source,
              ...resolveSourcePresentation(source.name),
            }))}
          />
        </div>
        {latestPlayNextRun && <ColdStartNote visible={coldStart} />}
        {excludedPlayCount > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {excludedPlayCount} {excludedPlayCount === 1 ? "game" : "games"} not shown
            {exclusionReasons ? `: ${exclusionReasons}` : "."}
          </p>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No games match your current setup.
          </p>
        ) : (
          <RecommendationSpotlightCarousel
            key={latestPlayNextRun.id}
            label="Play Next recommendations"
            slides={(hasPlayRoles
              ? PLAY_ROLE_ORDER.flatMap((role) => items.filter((item) => item.role === role))
              : items
            ).flatMap((item) => item.gameId ? [{
              itemId: item.id,
              target: { kind: "PLAY_NEXT" as const, gameId: item.gameId },
              runId: latestPlayNextRun.id,
              role: item.role,
              name: item.game?.name ?? "Unknown game",
              rank: item.rank,
              score: item.score,
              positive: item.positive,
              negative: item.negative,
              caveats: item.caveats,
              imageUrl: playItemCover(item),
            }] : [])}
          />
        )}
      </section>}

      {showBuyRecommendations && latestBuyRun && <section>
        <div className="mb-4">
          <h2 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.05em]">
            Recommended
            <span className="text-signal-strong"> purchases</span>
          </h2>
        </div>
        <TuneThisRunPanel
          engine="BUY"
          knownValues={knownValues}
          thinPool={buyContext?.tune?.thinPool === true}
          initialTune={tuneState?.buyTune as TuneContext | null | undefined}
          presets={presetOptions}
        />
        {buyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No wishlist items match your current setup.
          </p>
        ) : (
          <RecommendationSpotlightCarousel
            key={latestBuyRun.id}
            label="Purchase recommendations"
            slides={(hasBuyRoles
              ? BUY_ROLE_ORDER.flatMap((role) => buyItems.filter((item) => item.role === role))
              : buyItems
            ).flatMap((item) => item.wishlistEntryId ? [{
              itemId: item.id,
              target: { kind: "BUY" as const, wishlistEntryId: item.wishlistEntryId },
              runId: latestBuyRun.id,
              role: item.role,
              name: item.wishlistEntry?.name ?? "Unknown game",
              rank: item.rank,
              score: item.score,
              positive: item.positive,
              negative: item.negative,
              caveats: item.caveats,
              imageUrl: buyItemCover(item),
              offerDiscount: selectedOfferDiscountByWishlistId.get(item.wishlistEntryId) ?? null,
            }] : [])}
          />
        )}
      </section>}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Recent activity on Steam"
          description="Games played on Steam in the last two weeks."
          aside={<SteamActivityRefreshButton />}
        >
          <RecentSteamActivity
            view={steamActivityView}
            catalog={activityCatalog}
          />
        </SectionCard>

        <SectionCard title="Data health">
          <TodayDataHealth
            activeBacklog={dataHealth.activeBacklog}
            operations={todayOperations}
          />
          <div className="mt-4 grid gap-2">
            <CoverageDialog
              label="games missing IGDB metadata"
              basis="Based on provider metadata coverage for visible base games."
              titles={dataHealth.igdbMetadata.missing}
            />
            <CoverageDialog
              label="games with incomplete recommendation profiles"
              basis="A visible game is complete when its Play priority is set."
              titles={dataHealth.recommendationProfile.incomplete}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
