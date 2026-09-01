import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CreateGameDialog } from "@/components/games/CreateGameDialog";
import { UpdateRecommendationsButton } from "@/components/recommendations/UpdateRecommendationsButton";
import { LibraryFilters } from "@/components/games/LibraryFilters";
import { ViewSwitch } from "@/components/games/ViewSwitch";
import { LibraryGameCard } from "@/components/games/LibraryGameCard";
import { LibraryHealthStrip } from "@/components/games/LibraryHealthStrip";
import { DuplicatesList } from "@/components/games/DuplicatesList";
import { RawgBatchEnrichmentPanel } from "@/components/games/RawgBatchEnrichmentPanel";
import { getLatestRawgBatchStatus } from "@/lib/rawg-batch-runner";
import { loadTodayDataHealth } from "@/lib/today-data-health";
import { fuzzyMatch } from "@/lib/fuzzy-match";
import {
  getSystemCollectionDefinition,
  getSystemCollections,
} from "@/lib/system-collections";
import { availabilitySourcePresentation } from "@/lib/sources/known-sources";

interface LibrarySearchParams {
  q?: string;
  source?: string;
  alt?: string;
  state?: string;
  sort?: string;
  collection?: string;
  duplicates?: string;
  view?: string;
}

type LibraryView = "grid" | "list";

function normalizeLibraryView(value: string | undefined): LibraryView {
  return value === "list" ? "list" : "grid";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const { q = "", source, alt, state, sort = "newest", collection, duplicates, view: viewParam } =
    await searchParams;
  const view = normalizeLibraryView(viewParam);

  if (duplicates === "true") {
    const openDuplicates = await prisma.possibleDuplicate.findMany({
      where: { status: "OPEN" },
      select: {
        id: true,
        gameAId: true,
        gameBId: true,
        confidence: true,
        evidence: true,
        gameA: { select: { id: true, name: true } },
        gameB: { select: { id: true, name: true } },
      },
      orderBy: { id: "asc" },
    });

    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Duplicate review</h1>
            <Link href="/library" className="text-sm text-muted-foreground hover:underline">
              Back to library
            </Link>
          </div>
          <CreateGameDialog />
        </div>
        <DuplicatesList duplicates={openDuplicates} />
      </div>
    );
  }

  const sourceFilter = !alt && source && source !== "ALL"
      ? ["STEAM", "OTHER_PLATFORM", "ROM"].includes(source)
        ? (source as "STEAM" | "OTHER_PLATFORM" | "ROM")
        : undefined
      : undefined;
  const availabilityFilter = alt
    ? { some: { source: "OTHER_PLATFORM" as const, alternativeSourceId: alt } }
    : sourceFilter
      ? { some: { source: sourceFilter } }
      : undefined;
  const stateFilter =
    state && state !== "ALL"
      ? ["NOT_STARTED", "IN_PROGRESS", "PLAYED_BEFORE", "ABANDONED"].includes(
          state,
        )
        ? (state as "NOT_STARTED" | "IN_PROGRESS" | "PLAYED_BEFORE" | "ABANDONED")
        : undefined
      : undefined;

  const [manualCollections, systemCollections, latestRawgBatch, pendingUnresolvedDlc, alternativeSources, dataHealth, mainGameGames] = await Promise.all([
    prisma.collection.findMany({
      where: { isSystem: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getSystemCollections(),
    getLatestRawgBatchStatus(),
    prisma.unresolvedSteamDlc.count({ where: { status: "PENDING" } }),
    prisma.alternativeSource.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    loadTodayDataHealth(prisma),
    prisma.game.findMany({
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
    }),
  ]);

  const systemDef =
    collection && collection !== "ALL"
      ? getSystemCollectionDefinition(collection)
      : undefined;
  const isManualCollection =
    collection && collection !== "ALL"
      ? manualCollections.some((c) => c.id === collection)
      : false;

  const collectionWhere = systemDef
    ? systemDef.where
    : isManualCollection
      ? {
          game: {
            collections: {
              some: { collectionId: collection as string },
            },
          },
        }
      : undefined;

  const trimmedQuery = q.trim();
  const fuzzyIds = trimmedQuery
    ? await prisma.libraryEntry
        .findMany({
          where: { game: { type: "BASE_GAME" } },
          select: { id: true, game: { select: { id: true, name: true } } },
        })
        .then((pool) => {
          const seen = new Set<string>();
          return pool
          .map((entry) => {
            if (seen.has(entry.game.id)) return null;
            seen.add(entry.game.id);
            return {
              id: entry.game.id,
              result: fuzzyMatch(trimmedQuery, entry.game.name),
            };
          })
          .filter((entry): entry is { id: string; result: { matched: boolean; score: number } } =>
            entry !== null && entry.result.matched,
          )
          .sort(
            (left, right) =>
              right.result.score - left.result.score ||
              left.id.localeCompare(right.id),
          )
          .map((entry) => entry.id);
        })
    : null;

  const entries = await prisma.libraryEntry.findMany({
    where: {
      game: {
        type: "BASE_GAME",
        id: fuzzyIds ? { in: fuzzyIds } : undefined,
        availability: availabilityFilter,
      },
      playState: stateFilter ?? undefined,
      ...collectionWhere,
    },
    include: {
        game: {
          include: {
            availability: { include: { alternativeSource: true } },
            baseGame: {
              select: { id: true, name: true },
            },
            metadataSnapshots: {
              where: { provider: "RAWG" },
              select: { id: true, payload: true },
            },
            _count: {
              select: { dlcs: true, collections: true },
            },
          },
      },
    },
    orderBy: (() => {
      switch (sort) {
        case "oldest":
          return { createdAt: "asc" as const };
        case "name-asc":
          return { game: { name: "asc" as const } };
        case "name-desc":
          return { game: { name: "desc" as const } };
        default:
          return { createdAt: "desc" as const };
      }
    })(),
  });

  const mainGame = mainGameGames.find((game) => game.libraryEntry?.isMainGame === true) ?? null;
  const inProgressGames = mainGameGames.filter(
    (game) => game.libraryEntry?.playState === "IN_PROGRESS",
  );
  const mainGamePicks = [
    ...(mainGame ? [mainGame] : []),
    ...inProgressGames.filter((game) => game.id !== mainGame?.id),
  ].map((game) => ({ id: game.id, name: game.name }));

  return (
    <div data-view={view}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="technical-label text-muted-foreground">Catalog / owned games</p>
          <h1 className="mt-2">
            Your library, <span className="text-signal-strong">in orbit.</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            A focused view of what you own, what needs attention, and what could move next.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {pendingUnresolvedDlc > 0 && (
            <Link
              href="/settings"
              className="rounded-md bg-amber-500/15 px-2 py-1 text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
            >
              Review DLC ({pendingUnresolvedDlc})
            </Link>
          )}
          <Link
            href="/library?duplicates=true"
            className="text-sm text-muted-foreground hover:underline"
          >
            Review duplicates
          </Link>
          <UpdateRecommendationsButton />
          <CreateGameDialog alternativeSources={alternativeSources.map((alternative) => ({
            ...alternative,
            iconName: availabilitySourcePresentation("OTHER_PLATFORM", alternative.name).iconName,
          }))} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <LibraryFilters
          collections={[
            ...systemCollections.map((c) => ({
              id: c.id,
              name: c.name,
              isSystem: true,
            })),
            ...manualCollections.map((c) => ({
              id: c.id,
              name: c.name,
              isSystem: false,
            })),
          ]}
          alternativeSources={alternativeSources.map((alternative) => ({
            ...alternative,
            iconName: availabilitySourcePresentation("OTHER_PLATFORM", alternative.name).iconName,
          }))}
        />
        <ViewSwitch view={view} label="Library view" />
      </div>

      <div className="mt-6">
        <LibraryHealthStrip
          key={mainGame?.id ?? "none"}
          health={dataHealth}
          games={mainGamePicks}
          mainGame={mainGame ? { id: mainGame.id, name: mainGame.name } : null}
        />
      </div>

      <RawgBatchEnrichmentPanel
        initialBatch={latestRawgBatch?.data ?? null}
      />

      {entries.length === 0 ? (
        q || source || alt || state || (collection && collection !== "ALL") ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="technical-label text-muted-foreground">Nothing hidden here</p>
            <p className="text-lg font-medium">No games match those filters.</p>
            <p className="text-sm text-muted-foreground">
              Use filters to narrow the orbit, or add a new game to your catalog.
            </p>
            <Link
              href="/library"
              className="mt-4 w-fit text-sm font-medium text-signal-strong underline underline-offset-4 hover:text-foreground"
            >
              Reset filters
            </Link>
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-lg font-medium">No games found</p>
            <p className="text-sm text-muted-foreground">
              Add your first game to get started.
            </p>
            <CreateGameDialog alternativeSources={alternativeSources.map((alternative) => ({
              ...alternative,
              iconName: availabilitySourcePresentation("OTHER_PLATFORM", alternative.name).iconName,
            }))} />
          </div>
        )
      ) : (
        <div className="mt-6">
          <div
            className={view === "list"
              ? "space-y-3"
              : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}
          >
            {entries.map((entry) => (
              <LibraryGameCard
                key={entry.id}
                entry={entry}
                variant={view}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}