import { RecommendationItemCard } from "@/components/recommendations/RecommendationItemCard";
import { ShowAnotherButton } from "@/components/recommendations/ShowAnotherButton";
import { UpdateRecommendationsButton } from "@/components/recommendations/UpdateRecommendationsButton";
import { ColdStartNote } from "@/components/recommendations/ColdStartNote";
import { prisma } from "@/lib/prisma";
import { RunExposureTracker } from "@/components/recommendations/RunExposureTracker";
import { TuneThisRunPanel } from "@/components/recommendations/TuneThisRunPanel";
import { TasteSetupPanel } from "@/components/recommendations/TasteSetupPanel";
import {
  loadKnownGenreTagValues,
  loadRecommendationPresets,
} from "@/lib/recommendations/queries";
import {
  loadPickableTasteSetupGames,
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
import { TodayOperations } from "@/components/today/TodayOperations";
import { formatMexicoTimestamp } from "@/lib/format-times";
import { igdbLibraryCardMetadataView } from "@/lib/card-metadata-view";
import { parseIgdbMetadataPayload } from "@/lib/igdb-metadata-payload";
import { SectionCard } from "@/components/ui/detail-card";
import { buildEntryOfferView } from "@/lib/offer-selection";
import { formatPlayExclusionReasons } from "@/lib/recommendations/environment-fit";

const PLAY_ROLE_GROUPS_WITH_HANDHELD = [
  { label: "Best fit", roles: ["BEST_FIT_1"] },
  { label: "Handheld pick", roles: ["HANDHELD_PICK"] },
  { label: "Out of the box", roles: ["OUT_OF_THE_BOX"] },
  { label: "Change of pace", roles: ["CHANGE_OF_PACE"] },
] as const;
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

export default async function TodayPage() {
  const [
    latestPlayNextRun,
    latestBuyRun,
    knownValues,
    presets,
    alternativeSources,
    tasteGames,
    tasteEventCount,
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
    prisma.alternativeSource.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    loadPickableTasteSetupGames(prisma),
    prisma.recommendationEvent.count({
      where: { kind: "TASTE_SETUP_ANSWER" },
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
        libraryEntry: { select: { isMainGame: true, playState: true } },
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
  const showTasteSetup = shouldShowTasteSetup(
    tasteEventCount,
    tasteGames.length,
  );
  const heroGames = todayGames.map((game) => ({
    id: game.id,
    name: game.name,
    libraryEntry: game.libraryEntry,
    imageUrl:
      igdbLibraryCardMetadataView(game.metadataSnapshots[0]?.payload)?.wideImageUrl ?? null,
  }));
  const todayOffers = rankTodayOffers(
    wishlistEntries.map(({ id, name, targetPriceMxn, offers }) => ({
      wishlistEntryId: id,
      gameName: name,
      targetPriceMxn,
      offers,
    })),
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
  const playRoleOmissions = playContext?.roles?.omissions ?? [];
  const showPlayExclusions = todaySettings?.primaryOs === "LINUX";
  const excludedPlayCount = showPlayExclusions ? playExclusions.length : 0;
  const exclusionReasons = showPlayExclusions
    ? formatPlayExclusionReasons(playExclusions)
    : null;
  const hasPlayRoles = items.some((item) => item.role !== null);
  const playRoleGroups = todaySettings?.handheldOs !== "NONE" ? PLAY_ROLE_GROUPS_WITH_HANDHELD : PLAY_ROLE_GROUPS;
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
        <div>
          <p className="technical-label text-muted-foreground">Today</p>
          <h1 className="mt-2">
            Odyssey
            <span className="text-signal-strong"> dashboard</span>
          </h1>
        </div>
      </header>

      <TodayHeroGrid games={heroGames} offers={todayOffers} />

      {showTasteSetup && (
        <TasteSetupPanel
          games={tasteGames.map((game) => ({ id: game.id, name: game.name }))}
          initialPicks={initialTastePicks.map((pick) => ({
            id: pick.id,
            name: pick.name,
          }))}
        />
      )}

      {!latestPlayNextRun && (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Your next chapter is still unwritten. Update recommendations to
            build your play next list.
          </p>
          <div className="mt-4 flex justify-center">
            <UpdateRecommendationsButton />
          </div>
        </div>
      )}

      <section>
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
        {playRoleOmissions.map((omission) => (
          <p key={omission.role ?? omission.label} className="mt-2 text-sm text-muted-foreground">
            {omission.label}
          </p>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible games.
          </p>
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
                  imageUrl={playItemCover(item)}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:items-start">
            {(() => {
              const roleItems = playRoleGroups.flatMap((group) =>
                group.roles
                  .map((role) =>
                    items.find((item) => item.role === role && item.gameId),
                  )
                  .filter(
                    (item): item is (typeof items)[number] =>
                      item !== undefined,
                  ),
              );
              return roleItems.map((item) => (
                <ShowAnotherButton
                  key={item.id}
                  runId={latestPlayNextRun?.id ?? ""}
                  role={item.role!}
                  itemId={item.id}
                  target={{ kind: "PLAY_NEXT", gameId: item.gameId! }}
                  name={item.game?.name ?? "Unknown game"}
                  rank={item.rank}
                  score={item.score}
                  positive={item.positive}
                  negative={item.negative}
                  caveats={item.caveats}
                  imageUrl={playItemCover(item)}
                />
              ));
            })()}
          </div>
        )}
      </section>

      {latestPlayNextRun && (
        <RunExposureTracker
          runId={latestPlayNextRun.id}
          items={items.flatMap((item) =>
            item.gameId
              ? [{ gameId: item.gameId, role: item.role ?? undefined }]
              : [],
          )}
        />
      )}
      {latestBuyRun && (
        <RunExposureTracker
          runId={latestBuyRun.id}
          items={buyItems.flatMap((item) =>
            item.wishlistEntryId
              ? [
                  {
                    wishlistEntryId: item.wishlistEntryId,
                    role: item.role ?? undefined,
                  },
                ]
              : [],
          )}
        />
      )}

      <section>
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
          presets={presetOptions}
        />
        {!latestBuyRun ? (
          <p className="text-sm text-muted-foreground">Update recommendations to see eligible games from
            your wishlist.
          </p>
        ) : buyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible wishlist purchasese.
          </p>
        ) : !hasBuyRoles ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {buyItems.map((item) => {
              if (!item.wishlistEntryId) return null;
              return (
                <RecommendationItemCard
                  key={item.id}
                  target={{
                    kind: "BUY",
                    wishlistEntryId: item.wishlistEntryId,
                  }}
                  runId={latestBuyRun?.id}
                  name={item.wishlistEntry?.name ?? "Unknown game"}
                  rank={item.rank}
                  score={item.score}
                  positive={item.positive}
                  negative={item.negative}
                  caveats={item.caveats}
                  imageUrl={buyItemCover(item)}
                  offerDiscount={selectedOfferDiscountByWishlistId.get(item.wishlistEntryId) ?? null}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {BUY_ROLE_GROUPS.flatMap((group) =>
              buyItems.filter((item) => hasRole(group.roles, item.role)),
            ).map((item) =>
              item.wishlistEntryId && item.role ? (
                <ShowAnotherButton
                  key={item.id}
                  runId={latestBuyRun?.id ?? ""}
                  role={item.role}
                  itemId={item.id}
                  target={{
                    kind: "BUY",
                    wishlistEntryId: item.wishlistEntryId,
                  }}
                  name={item.wishlistEntry?.name ?? "Unknown game"}
                  rank={item.rank}
                  score={item.score}
                  positive={item.positive}
                  negative={item.negative}
                  caveats={item.caveats}
                  imageUrl={buyItemCover(item)}
                  offerDiscount={selectedOfferDiscountByWishlistId.get(item.wishlistEntryId) ?? null}
                />
              ) : null,
            )}
          </div>
        )}
      </section>

      <h2 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.05em]">
            App
            <span className="text-signal-strong"> metrics</span>
          </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          eyebrow="Steam / last 24 hours"
          title="Recent activity on Steam"
          description="Games that have been played or purchased on Steam in the last 24 hours with your Steam account."
          aside={<SteamActivityRefreshButton />}
        >
          <RecentSteamActivity
            view={steamActivityView}
            catalog={activityCatalog}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Coverage / attention"
          title="Data health"
        >
          <TodayDataHealth
            activeBacklog={dataHealth.activeBacklog}
          />
          <div className="mt-4 grid gap-2">
            <CoverageDialog
              label="games missing IGDB metadata"
              basis="Based on provider metadata coverage for visible base games."
              titles={dataHealth.igdbMetadata.missing}
            />
            <CoverageDialog
              label="games with incomplete recommendation profiles"
              basis="Based on local personal fields: interest plus priority, preferred environment, or game experience."
              titles={dataHealth.recommendationProfile.incomplete}
            />
          </div>
        </SectionCard>
      </div>

      <TodayOperations view={todayOperations} />
    </div>
  );
}
