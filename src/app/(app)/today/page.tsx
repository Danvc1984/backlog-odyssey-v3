import { RecommendationItemCard } from "@/components/recommendations/RecommendationItemCard";
import { ShowAnotherButton } from "@/components/recommendations/ShowAnotherButton";
import { UpdateRecommendationsButton } from "@/components/recommendations/UpdateRecommendationsButton";
import { ColdStartNote } from "@/components/recommendations/ColdStartNote";
import { prisma } from "@/lib/prisma";
import { RunExposureTracker } from "@/components/recommendations/RunExposureTracker";
import { TuneThisRunPanel } from "@/components/recommendations/TuneThisRunPanel";
import { TasteSetupPanel } from "@/components/recommendations/TasteSetupPanel";
import {
  listKnownGenreTagValues,
  listRecommendationPresets,
} from "@/actions/recommendations";
import {
  tuneContextSchema,
  type TuneContext,
} from "@/lib/recommendations/types";
import {
  loadPickableTasteSetupGames,
  selectInitialTasteSetupPicks,
  shouldShowTasteSetup,
} from "@/lib/recommendations/taste-setup";
import { resolveSourcePresentation } from "@/lib/sources/known-sources";
import { refreshSteamActivityCacheIfStale } from "@/lib/steam-activity";
import { RecentSteamActivity } from "@/components/today/RecentSteamActivity";
import { TodayDataHealth } from "@/components/today/TodaySummary";
import { loadTodayDataHealth } from "@/lib/today-data-health";
import { CoverageDialog } from "@/components/today/CoverageDialog";
import { TodayHeroGrid } from "@/components/today/TodayHeroGrid";
import { rankTodayOffers } from "@/lib/today-offers";
import { loadTodayOperations } from "@/lib/today-operations";
import { TodayOperations } from "@/components/today/TodayOperations";
import { formatMexicoTimestamp } from "@/lib/format-times";
import { parseRawgMetadataPayload } from "@/lib/rawg-metadata-payload";
import { SectionCard } from "@/components/ui/detail-card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

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
        include: {
          game: {
            select: {
              name: true,
              metadataSnapshots: {
                where: { provider: "RAWG" },
                orderBy: { fetchedAt: "desc" },
                take: 1,
                select: { payload: true },
              },
            },
          },
        },
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
        include: {
          wishlistEntry: {
            select: {
              name: true,
              metadataSnapshot: { select: { payload: true } },
              baseGame: {
                select: {
                  name: true,
                  metadataSnapshots: {
                    where: { provider: "RAWG" },
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
  });
  const tuneState = await prisma.recommendationTuneState.findUnique({
    where: { id: 1 },
    select: { playTune: true, buyTune: true },
  });
  const knownValuesResult = await listKnownGenreTagValues();
  const knownValues = knownValuesResult.success
    ? knownValuesResult.data
    : { genres: [], tags: [] };
  const presetsResult = await listRecommendationPresets();
  const presets = presetsResult.success
    ? presetsResult.data.map((preset) => ({ id: preset.id, name: preset.name }))
    : [];
  const alternativeSources = await prisma.alternativeSource.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const tasteGames = await loadPickableTasteSetupGames(prisma);
  const tasteEventCount = await prisma.recommendationEvent.count({
    where: { kind: "TASTE_SETUP_ANSWER" },
  });
  const initialTastePicks = selectInitialTasteSetupPicks(tasteGames);
  const showTasteSetup = shouldShowTasteSetup(
    tasteEventCount,
    tasteGames.length,
  );
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
      metadataSnapshots: {
        where: { provider: "RAWG" },
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: { payload: true },
      },
    },
  });
  const heroGames = todayGames.map((game) => ({
    id: game.id,
    name: game.name,
    libraryEntry: game.libraryEntry,
    imageUrl:
      parseRawgMetadataPayload(game.metadataSnapshots[0]?.payload)
        ?.backgroundImageUrls[0] ?? null,
  }));
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
  const playContext = latestPlayNextRun?.context as
    | { rerank?: { mode?: string }; tune?: { thinPool?: boolean } }
    | null
    | undefined;
  const buyContext = latestBuyRun?.context as
    | { tune?: { thinPool?: boolean } }
    | null
    | undefined;

  const items = latestPlayNextRun?.items ?? [];
  const buyItems = latestBuyRun?.items ?? [];
  const playItemCover = (item: (typeof items)[number]) =>
    parseRawgMetadataPayload(item.game?.metadataSnapshots[0]?.payload)
      ?.backgroundImageUrls[0] ?? null;
  const buyItemCover = (item: (typeof buyItems)[number]) =>
    parseRawgMetadataPayload(item.wishlistEntry?.metadataSnapshot?.payload)
      ?.backgroundImageUrls[0] ??
    parseRawgMetadataPayload(
      item.wishlistEntry?.baseGame?.metadataSnapshots[0]?.payload,
    )?.backgroundImageUrls[0] ??
    null;
  const coldStart = playContext?.rerank?.mode === "COLD_START";
  const hasPlayRoles = items.some((item) => item.role !== null);
  const hasBuyRoles = buyItems.some((item) => item.role !== null);
  const steamActivityView = await refreshSteamActivityCacheIfStale();
  const activityAppIds = [
    ...steamActivityView.imported,
    ...steamActivityView.unimported,
  ]
    .map((entry) => entry.steamAppId)
    .filter((appId): appId is string => Boolean(appId));
  const activityCatalogRows =
    activityAppIds.length > 0
      ? await prisma.externalGameId.findMany({
          where: { namespace: "STEAM_APP", externalId: { in: activityAppIds } },
          select: {
            externalId: true,
            game: {
              select: {
                id: true,
                metadataSnapshots: {
                  where: { provider: "RAWG" },
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
          parseRawgMetadataPayload(row.game.metadataSnapshots[0]?.payload)
            ?.backgroundImageUrls[0] ?? null,
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
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Placeholder text for the Today page. This section can be used to
            provide an overview or introduction to the recommendations and data
            presented below.
          </p>
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
            No recommendations yet. Update recommendations to build your play
            next list.
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
            initialTune={storedTune(tuneState?.playTune)}
            knownValues={knownValues}
            thinPool={playContext?.tune?.thinPool === true}
            presets={presets}
            alternativeSources={alternativeSources.map((source) => ({
              ...source,
              iconName: resolveSourcePresentation(source.name).iconName,
            }))}
          />
        </div>
        {latestPlayNextRun && <ColdStartNote visible={coldStart} />}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible games right now.
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
              const roleItems = PLAY_ROLE_GROUPS.flatMap((group) =>
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
          initialTune={storedTune(tuneState?.buyTune)}
          knownValues={knownValues}
          thinPool={buyContext?.tune?.thinPool === true}
          presets={presets}
        />
        {!latestBuyRun ? (
          <p className="text-sm text-muted-foreground">
            No buy recommendations yet. Update recommendations to score your
            wishlist.
          </p>
        ) : buyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No eligible wishlist purchases right now.
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
          title="Recent activity"
          description="Small signals from what you actually touched."
        >
          <RecentSteamActivity
            view={steamActivityView}
            catalog={activityCatalog}
          />
        </SectionCard>

        <SectionCard
          eyebrow="Coverage / attention"
          title="Data health"
          description="Counts are actionable, not decoration."
        >
          <TodayDataHealth
            activeBacklog={dataHealth.activeBacklog}
            abandoned={dataHealth.abandoned}
          />
          <div className="mt-4 grid gap-2">
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
          </div>
        </SectionCard>
      </div>

      <TodayOperations view={todayOperations} />
    </div>
  );
}
