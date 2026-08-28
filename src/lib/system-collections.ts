import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const SYSTEM_COLLECTION_IDS = [
  "play-soon",
  "replay-candidates",
  "favorites",
  "hidden",
  "abandoned",
] as const;

export type SystemCollectionId = (typeof SYSTEM_COLLECTION_IDS)[number];

export const SYSTEM_COLLECTIONS: {
  id: SystemCollectionId;
  name: string;
  icon: string;
  color: string;
  where: Prisma.LibraryEntryWhereInput;
}[] = [
  {
    id: "play-soon",
    name: "Play soon",
    icon: "Clock",
    color: "#f59e0b",
    where: { playSoon: true },
  },
  {
    id: "replay-candidates",
    name: "Replay candidates",
    icon: "RotateCcw",
    color: "#3b82f6",
    where: { replayCandidate: true },
  },
  {
    id: "favorites",
    name: "Favorites",
    icon: "Star",
    color: "#f43f5e",
    where: { rating: { gte: 8 } },
  },
  {
    id: "hidden",
    name: "Hidden",
    icon: "EyeOff",
    color: "#6b7280",
    where: { hidden: true },
  },
  {
    id: "abandoned",
    name: "Abandoned",
    icon: "Flag",
    color: "#ef4444",
    where: { playState: "ABANDONED" },
  },
];

export function isSystemCollectionId(
  id: string,
): id is SystemCollectionId {
  return SYSTEM_COLLECTION_IDS.includes(id as SystemCollectionId);
}

export function getSystemCollectionDefinition(id: string) {
  return SYSTEM_COLLECTIONS.find((c) => c.id === id);
}

export async function getSystemCollections() {
  const counts = await Promise.all(
    SYSTEM_COLLECTIONS.map((c) => prisma.libraryEntry.count({ where: c.where })),
  );

  return SYSTEM_COLLECTIONS.map((c, i) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    count: counts[i],
  }));
}

export async function getSystemCollectionGames(id: string) {
  const def = getSystemCollectionDefinition(id);
  if (!def) return [];

  return prisma.libraryEntry.findMany({
    where: def.where,
    include: {
      game: {
        include: {
          availability: { include: { alternativeSource: true } },
        },
      },
    },
    orderBy: { game: { name: "asc" } },
  });
}
