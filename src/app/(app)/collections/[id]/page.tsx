import Link from "next/link";
import { redirect } from "next/navigation";
import { Calculator, Folder } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getSystemCollectionDefinition,
  isSystemCollectionId,
} from "@/lib/system-collections";
import { CollectionDetailActions } from "@/components/games/CollectionDetailActions";
import { CollectionListControls } from "@/components/games/CollectionListControls";
import { LibraryGameCard, type LibraryGameCardEntry } from "@/components/games/LibraryGameCard";
import { StatusPill } from "@/components/ui/detail-card";
import { deriveCardTier } from "@/lib/protondb-tags";

interface CollectionSearchParams {
  q?: string;
  sort?: string;
}

function sortRows(rows: LibraryGameCardEntry[], sort: string): LibraryGameCardEntry[] {
  return [...rows].sort((left, right) => {
    if (sort === "oldest") return left.createdAt.getTime() - right.createdAt.getTime();
    if (sort === "name-asc") return left.game.name.localeCompare(right.game.name);
    if (sort === "name-desc") return right.game.name.localeCompare(left.game.name);
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

function toLibraryEntry(entry: {
  id: string;
  interest: number | null;
  playState: string;
  isMainGame: boolean;
  playSoon: boolean;
  replayCandidate: boolean;
  hidden: boolean;
  createdAt: Date;
  game: {
    id: string;
    name: string;
    type: string;
    baseGame: { id: string; name: string } | null;
    metadataSnapshots: { id: string; payload?: unknown }[];
    _count: { dlcs: number; collections: number };
    externalIds: { externalId: string }[];
    compatSnapshots: { result: unknown }[];
    availability: LibraryGameCardEntry["game"]["availability"];
  };
}): LibraryGameCardEntry {
  const isRomOnly =
    entry.game.availability.some((availability) => availability.source === "ROM") &&
    !entry.game.availability.some((availability) => availability.source === "STEAM");

  return {
    id: entry.id,
    interest: entry.interest,
    playState: entry.playState,
    isMainGame: entry.isMainGame,
    playSoon: entry.playSoon,
    replayCandidate: entry.replayCandidate,
    hidden: entry.hidden,
    createdAt: entry.createdAt,
    protonDbTier: deriveCardTier({
      steamAppId: entry.game.externalIds[0]?.externalId ?? null,
      isRomOnly,
      snapshotResult: entry.game.compatSnapshots[0]?.result ?? null,
    }),
    game: {
      id: entry.game.id,
      name: entry.game.name,
      type: entry.game.type,
      baseGame: entry.game.baseGame,
      metadataSnapshots: entry.game.metadataSnapshots,
      _count: entry.game._count,
      availability: entry.game.availability,
    },
  };
}

function collectionGameInclude() {
  return {
    availability: { include: { alternativeSource: true } },
    externalIds: {
      where: { namespace: "STEAM_APP" as const },
      select: { externalId: true },
    },
    compatSnapshots: {
      where: { provider: "PROTONDB" as const },
      orderBy: { fetchedAt: "desc" as const },
      take: 1,
      select: { result: true },
    },
    baseGame: { select: { id: true, name: true } },
    metadataSnapshots: {
      where: { provider: "RAWG" as const },
      select: { id: true, payload: true },
    },
    _count: { select: { dlcs: true, collections: true } },
  };
}

export default async function CollectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<CollectionSearchParams>;
}) {
  const [{ id }, { q = "", sort = "newest" }] = await Promise.all([params, searchParams]);
  const isSystem = isSystemCollectionId(id);
  const systemDef = isSystem ? getSystemCollectionDefinition(id) : undefined;
  let name = "";
  let color: string | null = null;
  let rows: LibraryGameCardEntry[] = [];

  if (systemDef) {
    name = systemDef.name;
    color = systemDef.color;
    const entries = await prisma.libraryEntry.findMany({
      where: systemDef.where,
      include: { game: { include: collectionGameInclude() } },
    });
    rows = entries.map(toLibraryEntry);
  } else {
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            game: {
              include: {
                libraryEntry: true,
                ...collectionGameInclude(),
              },
            },
          },
        },
      },
    });

    if (!collection) redirect("/collections");
    name = collection.name;
    color = collection.color;
    rows = collection.members
      .filter((member) => member.game.libraryEntry !== null)
      .map((member) => toLibraryEntry({ ...member.game.libraryEntry!, game: member.game }));
  }

  const query = q.trim().toLocaleLowerCase();
  const filteredRows = sortRows(
    rows.filter((row) => !query || row.game.name.toLocaleLowerCase().includes(query)),
    sort,
  );
  const emptyMessage = rows.length === 0
    ? isSystem ? "No games match this collection." : "No games in this collection."
    : "No games match this search.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="technical-label text-muted-foreground">
            <Link href="/collections" className="hover:text-foreground hover:underline">
              Library organization
            </Link>
            <span aria-hidden="true"> / </span>
            {name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="size-3 rounded-full" style={{ backgroundColor: color ?? "#9ca3af" }} aria-hidden />
            <h1>{name}</h1>
            {isSystem && (
              <StatusPill>
                <Calculator className="size-3" aria-hidden />
                Calculated
              </StatusPill>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {rows.length} catalog {rows.length === 1 ? "game" : "games"} in this collection.
          </p>
        </div>
        {!isSystem && (
          <CollectionDetailActions collectionId={id} initialName={name} initialColor={color} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CollectionListControls />
        <StatusPill>{filteredRows.length} shown</StatusPill>
      </div>

      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
          <Folder className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-lg font-medium">{emptyMessage}</p>
          <p className="text-sm text-muted-foreground">
            {rows.length === 0 ? "Add games from their catalog detail page." : "Try another search."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((entry) => (
            <LibraryGameCard key={entry.id} entry={entry} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
}
