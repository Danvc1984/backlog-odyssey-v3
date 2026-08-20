import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PersonalFieldsForm } from "@/components/games/PersonalFieldsForm";
import { PlayStateSection } from "@/components/games/PlayStateSection";
import { TagsSection } from "@/components/games/TagsSection";
import { CollectionsSection } from "@/components/games/CollectionsSection";
import { DuplicateWarning } from "@/components/games/DuplicateWarning";
import { DeleteGameDialog } from "@/components/games/DeleteGameDialog";
import { AvailabilityRowForm } from "@/components/games/AvailabilityRowForm";
import { GameNameForm } from "@/components/games/GameNameForm";
import { MetadataSection } from "@/components/games/MetadataSection";
import { RawgEnrichmentPanel } from "@/components/games/RawgEnrichmentPanel";
import { DlcSection } from "@/components/games/DlcSection";
import { ParentBaseGameBanner } from "@/components/games/ParentBaseGameBanner";
import { rawgJobSelect, toRawgEnrichmentJobView } from "@/lib/rawg-job-view";
import type { RawgMetadataPayload } from "@/lib/rawg-types";

const TYPE_LABELS: Record<string, string> = {
  BASE_GAME: "Base game",
  DLC: "DLC",
};

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: "Manual entry",
  STEAM_IMPORT: "Steam import",
};

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, manualCollections, possibleDuplicate] = await Promise.all([
    prisma.game.findUnique({
      where: { id },
      include: {
        baseGame: {
          select: { id: true, name: true },
        },
        libraryEntry: true,
        availability: true,
        tags: {
          include: { tag: true },
        },
        collections: {
          include: { collection: true },
        },
        dlcs: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
        metadataSnapshots: {
          where: { provider: "RAWG" },
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { payload: true, sourceUrl: true, fetchedAt: true },
        },
        enrichmentJobs: {
          where: { provider: "RAWG" },
          select: rawgJobSelect,
        },
      },
    }),
    prisma.collection.findMany({
      where: { isSystem: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.possibleDuplicate.findFirst({
      where: {
        status: "OPEN",
        OR: [{ gameAId: id }, { gameBId: id }],
      },
      select: {
        gameAId: true,
        gameBId: true,
        gameA: { select: { name: true } },
        gameB: { select: { name: true } },
      },
    }),
  ]);

  if (!game) {
    redirect("/library");
  }

  const otherGameName = possibleDuplicate
    ? possibleDuplicate.gameAId === id
      ? possibleDuplicate.gameB.name
      : possibleDuplicate.gameA.name
    : null;
  const rawgSnapshot = game.metadataSnapshots[0];
  const rawgPayload = rawgSnapshot
    ? (rawgSnapshot.payload as unknown as RawgMetadataPayload)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{game.name}</h1>
        {game.type === "DLC" && (
          <div className="mt-4">
            <ParentBaseGameBanner baseGame={game.baseGame} />
          </div>
        )}
        <div className="mt-4">
          <GameNameForm key={game.name} gameId={game.id} initialName={game.name} />
        </div>
      </div>

      {otherGameName && <DuplicateWarning otherGameName={otherGameName} />}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Metadata
        </h2>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Type</span>
            <span className="ml-2 rounded-md border border-border px-2 py-0.5 text-xs font-medium">
              {TYPE_LABELS[game.type] ?? game.type}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Origin</span>
            <span className="ml-2">{ORIGIN_LABELS[game.origin] ?? game.origin}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Added</span>
            <span className="ml-2">
              {game.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <MetadataSection
          payload={rawgPayload}
          sourceUrl={rawgSnapshot?.sourceUrl ?? null}
          fetchedAt={rawgSnapshot?.fetchedAt ?? null}
        />
        <RawgEnrichmentPanel
          gameId={game.id}
          catalogName={game.name}
          initialJob={
            game.enrichmentJobs[0] ? toRawgEnrichmentJobView(game.enrichmentJobs[0]) : null
          }
          hasRawgSnapshot={game.metadataSnapshots.length > 0}
          rawgTitle={rawgPayload?.title ?? null}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Availability
        </h2>
        {game.availability.length === 0 ? (
          <p className="text-sm text-muted-foreground">No availability records.</p>
        ) : (
          <div className="grid gap-3">
            {game.availability.map((a) => (
              <div key={a.id} className="rounded-lg border border-border">
                <AvailabilityRowForm
                  availabilityId={a.id}
                  source={a.source}
                  displayName={a.displayName}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Personal fields
        </h2>
        <PersonalFieldsForm
          gameId={game.id}
          libraryEntry={
            game.libraryEntry
              ? {
                  priority: game.libraryEntry.priority,
                  interest: game.libraryEntry.interest,
                  rating: game.libraryEntry.rating,
                  preferredEnvironment: game.libraryEntry.preferredEnvironment,
                  notes: game.libraryEntry.notes,
                }
              : null
          }
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Tags
        </h2>
        <TagsSection
          gameId={game.id}
          initialTags={game.tags.map((gt) => ({
            id: gt.tag.id,
            name: gt.tag.name,
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Collections
        </h2>
        <CollectionsSection
          gameId={game.id}
          initialCollections={game.collections.map((cm) => ({
            id: cm.collection.id,
            name: cm.collection.name,
            color: cm.collection.color,
          }))}
          availableCollections={manualCollections}
        />
      </section>

      {game.type === "BASE_GAME" && (
        <DlcSection baseGameId={game.id} dlcs={game.dlcs} />
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Play state
        </h2>
        <PlayStateSection
          gameId={game.id}
          libraryEntry={
            game.libraryEntry
              ? {
                  playState: game.libraryEntry.playState,
                  isMainGame: game.libraryEntry.isMainGame,
                  playSoon: game.libraryEntry.playSoon,
                  replayCandidate: game.libraryEntry.replayCandidate,
                  hidden: game.libraryEntry.hidden,
                }
              : null
          }
        />
      </section>

      <section className="flex items-center justify-between border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold">Delete {game.name}</h2>
          <p className="text-sm text-muted-foreground">
            Removes this game and its attached records. You can undo it shortly after.
          </p>
        </div>
        <DeleteGameDialog gameId={game.id} />
      </section>
    </div>
  );
}
