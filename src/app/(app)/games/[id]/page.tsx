import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PersonalFieldsForm } from "@/components/games/PersonalFieldsForm";
import { TagsSection } from "@/components/games/TagsSection";

const TYPE_LABELS: Record<string, string> = {
  BASE_GAME: "Base game",
  DLC: "DLC",
};

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: "Manual entry",
  STEAM_IMPORT: "Steam import",
};

const SOURCE_LABELS: Record<string, string> = {
  STEAM: "Steam",
  OTHER_PLATFORM: "Other platform",
  ROM: "ROM",
};

const PLAY_STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PLAYED_BEFORE: "Played before",
  ABANDONED: "Abandoned",
};

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      libraryEntry: true,
      availability: true,
      tags: {
        include: { tag: true },
      },
    },
  });

  if (!game) {
    redirect("/library");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{game.name}</h1>
      </div>

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
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Display name</th>
                </tr>
              </thead>
              <tbody>
                {game.availability.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {SOURCE_LABELS[a.source] ?? a.source}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.displayName || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          Play state
        </h2>
        <p className="text-sm">
          {game.libraryEntry
            ? PLAY_STATE_LABELS[game.libraryEntry.playState] ??
              game.libraryEntry.playState
            : "Not in library"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Play state (managed by play states feature)
        </p>
      </section>
    </div>
  );
}