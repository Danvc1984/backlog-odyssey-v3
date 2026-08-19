import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PersonalFieldsForm } from "@/components/games/PersonalFieldsForm";
import { PlayStateSection } from "@/components/games/PlayStateSection";
import { TagsSection } from "@/components/games/TagsSection";
import { CollectionsSection } from "@/components/games/CollectionsSection";
import { DuplicateWarning } from "@/components/games/DuplicateWarning";
import { DeleteGameDialog } from "@/components/games/DeleteGameDialog";
import { AvailabilityRowForm } from "@/components/games/AvailabilityRowForm";
import { GameNameForm } from "@/components/games/GameNameForm";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{game.name}</h1>
        <div className="mt-4">
          <GameNameForm gameId={game.id} initialName={game.name} />
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

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          DLC
        </h2>
        {game.dlcs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No DLC owned.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {game.dlcs.map((dlc) => (
              <li key={dlc.id}>
                <Link href={`/games/${dlc.id}`} className="hover:underline">
                  {dlc.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

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
