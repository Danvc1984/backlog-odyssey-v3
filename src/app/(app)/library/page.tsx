import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CreateGameDialog } from "@/components/games/CreateGameDialog";
import { LibraryFilters } from "@/components/games/LibraryFilters";

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

interface LibrarySearchParams {
  q?: string;
  source?: string;
  state?: string;
  sort?: string;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const { q = "", source, state, sort = "newest" } = await searchParams;

  const sourceFilter =
    source && source !== "ALL"
      ? ["STEAM", "OTHER_PLATFORM", "ROM"].includes(source)
        ? (source as "STEAM" | "OTHER_PLATFORM" | "ROM")
        : undefined
      : undefined;
  const stateFilter =
    state && state !== "ALL"
      ? ["NOT_STARTED", "IN_PROGRESS", "PLAYED_BEFORE", "ABANDONED"].includes(
          state,
        )
        ? (state as "NOT_STARTED" | "IN_PROGRESS" | "PLAYED_BEFORE" | "ABANDONED")
        : undefined
      : undefined;

  const entries = await prisma.libraryEntry.findMany({
    where: {
      game: {
        name: q
          ? { contains: q, mode: "insensitive" }
          : undefined,
        availability: sourceFilter
          ? { some: { source: sourceFilter } }
          : undefined,
      },
      playState: stateFilter ?? undefined,
    },
    include: {
      game: {
        include: {
          availability: true,
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
        <CreateGameDialog />
      </div>

      <div className="mt-4">
        <LibraryFilters />
      </div>

      {entries.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <p className="text-lg font-medium">No games found</p>
          <p className="text-sm text-muted-foreground">
            {q || source || state
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
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/games/${entry.game.id}`}
                      className="hover:underline"
                    >
                      {entry.game.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{entry.game.type}</td>
                  <td className="px-4 py-3">
                    {entry.game.availability
                      .map((a) => SOURCE_LABELS[a.source] ?? a.source)
                      .join(", ") || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {PLAY_STATE_LABELS[entry.playState] ?? entry.playState}
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
