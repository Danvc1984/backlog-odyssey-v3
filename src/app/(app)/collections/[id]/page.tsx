import Link from "next/link";
import { redirect } from "next/navigation";
import { Calculator, Folder } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getSystemCollectionDefinition,
  getSystemCollectionGames,
  isSystemCollectionId,
} from "@/lib/system-collections";
import { CollectionDetailActions } from "@/components/games/CollectionDetailActions";
import { Fragment } from "react";
import { availabilitySourcePresentation } from "@/lib/sources/known-sources";
import { SourceIcon } from "@/components/sources/SourceIcon";

const TYPE_LABELS: Record<string, string> = {
  BASE_GAME: "Base game",
  DLC: "DLC",
};

const PLAY_STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PLAYED_BEFORE: "Played before",
  ABANDONED: "Abandoned",
};

interface GameRow {
  game: {
    id: string;
    name: string;
    type: string;
    availability: {
      id: string;
      source: "STEAM" | "OTHER_PLATFORM" | "ROM";
      alternativeSource: { name: string } | null;
    }[];
  };
  playState: string;
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isSystem = isSystemCollectionId(id);
  const systemDef = isSystem
    ? getSystemCollectionDefinition(id)
    : undefined;

  let name = "";
  let color: string | null = null;
  let rows: GameRow[] = [];

  if (systemDef) {
    name = systemDef.name;
    color = systemDef.color;
    const entries = await getSystemCollectionGames(id);
    rows = entries.map((e) => ({
      game: {
        id: e.game.id,
        name: e.game.name,
        type: e.game.type,
        availability: e.game.availability,
      },
      playState: e.playState,
    }));
  } else {
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { addedAt: "desc" },
          include: {
            game: {
              include: {
                availability: { include: { alternativeSource: true } },
                libraryEntry: true,
              },
            },
          },
        },
      },
    });

    if (!collection) {
      redirect("/collections");
    }

    name = collection.name;
    color = collection.color;
    rows = collection.members.map((m) => ({
      game: {
        id: m.game.id,
        name: m.game.name,
        type: m.game.type,
        availability: m.game.availability,
      },
      playState: m.game.libraryEntry?.playState ?? "NOT_STARTED",
    }));
  }

  const emptyMessage = isSystem
    ? "No games match this collection."
    : "No games in this collection.";

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{name}</h1>
          {isSystem && (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
              <Calculator className="size-3" aria-hidden />
              Calculated
            </span>
          )}
        </div>
        {!isSystem && (
          <CollectionDetailActions
            collectionId={id}
            initialName={name}
            initialColor={color}
          />
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <Folder className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-lg font-medium">{emptyMessage}</p>
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
              {rows.map((row) => (
                <tr
                  key={row.game.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/games/${row.game.id}`}
                      className="hover:underline"
                    >
                      {row.game.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {TYPE_LABELS[row.game.type] ?? row.game.type}
                  </td>
                  <td className="px-4 py-3">
                    {row.game.availability.length === 0
                      ? "-"
                      : row.game.availability.map((a, index) => {
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
                    {PLAY_STATE_LABELS[row.playState] ?? row.playState}
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
