import Link from "next/link";
import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { Star, Clock, RotateCcw, EyeOff } from "lucide-react";
import { CreateGameDialog } from "@/components/games/CreateGameDialog";
import { UpdateRecommendationsButton } from "@/components/recommendations/UpdateRecommendationsButton";
import { LibraryFilters } from "@/components/games/LibraryFilters";
import { DuplicatesList } from "@/components/games/DuplicatesList";
import { RawgBatchEnrichmentPanel } from "@/components/games/RawgBatchEnrichmentPanel";
import { getLatestRawgBatchStatus } from "@/lib/rawg-batch-runner";
import {
  getSystemCollectionDefinition,
  getSystemCollections,
} from "@/lib/system-collections";
import { availabilitySourcePresentation } from "@/lib/sources/known-sources";
import { SourceIcon } from "@/components/sources/SourceIcon";

const PLAY_STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PLAYED_BEFORE: "Played before",
  ABANDONED: "Abandoned",
};

const FLAG_INDICATORS = [
  { key: "playSoon" as const, Icon: Clock, label: "Play soon" },
  { key: "replayCandidate" as const, Icon: RotateCcw, label: "Replay candidate" },
  { key: "hidden" as const, Icon: EyeOff, label: "Hidden" },
];

interface LibrarySearchParams {
  q?: string;
  source?: string;
  alt?: string;
  state?: string;
  sort?: string;
  collection?: string;
  duplicates?: string;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const { q = "", source, alt, state, sort = "newest", collection, duplicates } =
    await searchParams;

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

  const [manualCollections, systemCollections, latestRawgBatch, pendingUnresolvedDlc, alternativeSources] = await Promise.all([
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

  const entries = await prisma.libraryEntry.findMany({
    where: {
      game: {
        type: "BASE_GAME",
        name: q
          ? { contains: q, mode: "insensitive" }
          : undefined,
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Library</h1>
        <div className="flex items-center gap-3">
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

      <div className="mt-4">
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
      </div>

      <RawgBatchEnrichmentPanel
        initialBatch={latestRawgBatch?.data ?? null}
      />

      {entries.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <p className="text-lg font-medium">No games found</p>
          <p className="text-sm text-muted-foreground">
            {q || source || alt || state
              ? "Try adjusting your search or filters."
              : "Add your first game to get started."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Availability</th>
                <th className="px-4 py-3 font-medium">Play state</th>
                <th className="px-4 py-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-medium">
                    {entry.game.type === "DLC" ? (
                      <>
                        <span>{entry.game.name}</span>
                        {entry.game.baseGame && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            DLC for{" "}
                            <Link href={`/games/${entry.game.baseGame.id}`} className="hover:underline">
                              {entry.game.baseGame.name}
                            </Link>
                          </span>
                        )}
                      </>
                    ) : (
                      <Link href={`/games/${entry.game.id}`} className="hover:underline">
                        {entry.game.name}
                      </Link>
                    )}
                    {entry.isMainGame && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                        <Star className="size-3" />
                        Main
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{entry.game.type}</td>
                  <td className="px-4 py-3">
                    {entry.game.availability.length === 0
                      ? "-"
                      : entry.game.availability.map((a, index) => {
                          const presentation = availabilitySourcePresentation(
                            a.source,
                            a.alternativeSource?.name ?? null,
                          );
                          return (
                            <Fragment key={a.id}>
                              {index > 0 && ", "}
                              <span className="inline-flex items-center gap-1">
                                <SourceIcon iconName={presentation.iconName} />
                                {presentation.label}
                              </span>
                            </Fragment>
                          );
                        })}
                  </td>
                  <td className="px-4 py-3">
                    {PLAY_STATE_LABELS[entry.playState] ?? entry.playState}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {FLAG_INDICATORS.filter((f) => entry[f.key]).map((f) => (
                        <span key={f.key} title={f.label}>
                          <f.Icon
                            aria-label={f.label}
                            className="size-4 text-muted-foreground"
                          />
                        </span>
                      ))}
                      {!FLAG_INDICATORS.some((f) => entry[f.key]) && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
