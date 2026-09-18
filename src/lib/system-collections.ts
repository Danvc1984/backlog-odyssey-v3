import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseIgdbMetadataPayload } from "@/lib/igdb-metadata-payload";
import type { IgdbNamedValue } from "@/lib/igdb-types";

const SYSTEM_COLLECTION_IDS = [
  "play-soon",
  "replay-candidates",
  "favorites",
  "hidden",
  "abandoned",
  "in-progress",
  "completed",
  "backlog",
  "handheld-picks",
  "games-with-dlc",
] as const;

export type SystemCollectionId = (typeof SYSTEM_COLLECTION_IDS)[number];
export type DynamicCollectionKind = "series" | "franchise" | "tag";

export type SystemCollectionDefinition = {
  id: SystemCollectionId;
  name: string;
  icon: string;
  color: string;
  where: Prisma.LibraryEntryWhereInput;
};

export type DynamicSystemCollection = {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
  kind: DynamicCollectionKind;
  igdbId?: number;
  tagId?: string;
}

export type SystemCollectionSummary = {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
  kind?: DynamicCollectionKind;
  igdbId?: number;
};

export const SYSTEM_COLLECTIONS: SystemCollectionDefinition[] = [
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
  {
    id: "in-progress",
    name: "In progress",
    icon: "Play",
    color: "#14b8a6",
    where: { playState: "IN_PROGRESS" },
  },
  {
    id: "completed",
    name: "Previously completed",
    icon: "CheckCircle",
    color: "#22c55e",
    where: {
      OR: [{ playState: "COMPLETED" }, { completedBefore: true }],
    },
  },
  {
    id: "backlog",
    name: "Backlog",
    icon: "List",
    color: "#8b5cf6",
    where: { playState: "NOT_STARTED" },
  },
  {
    id: "handheld-picks",
    name: "Handheld picks",
    icon: "GameController",
    color: "#ec4899",
    where: { handheldSuitable: true },
  },
  {
    id: "games-with-dlc",
    name: "Games with DLC",
    icon: "Stack",
    color: "#f97316",
    where: {
      game: {
        type: "BASE_GAME",
        dlcs: { some: {} },
      },
    },
  },
];

function dynamicCollectionId(kind: DynamicCollectionKind, igdbId: number): string {
  return `igdb-${kind}-${igdbId}`;
}

export function parseDynamicCollectionId(id: string): {
  kind: DynamicCollectionKind;
  igdbId: number;
} | null {
  const match = /^igdb-(series|franchise)-([1-9]\d*)$/.exec(id);
  if (!match) return null;
  const igdbId = Number(match[2]);
  if (!Number.isSafeInteger(igdbId) || igdbId <= 0) return null;
  return { kind: match[1] as DynamicCollectionKind, igdbId };
}

export function isSystemCollectionId(id: string): id is SystemCollectionId {
  return SYSTEM_COLLECTION_IDS.includes(id as SystemCollectionId);
}

export function parseTagCollectionId(id: string): string | null {
  const match = /^tag-([a-z0-9_-]+)$/.exec(id);
  return match?.[1] ?? null;
}

export function isCalculatedCollectionId(id: string): boolean {
  return isSystemCollectionId(id) || parseDynamicCollectionId(id) !== null || parseTagCollectionId(id) !== null;
}

export function getSystemCollectionDefinition(id: string) {
  return SYSTEM_COLLECTIONS.find((c) => c.id === id);
}

type DynamicEvidenceRow = {
  gameId: string;
  game: {
    metadataSnapshots: { payload: unknown }[];
  };
};

export async function getPersonalTagCollections(): Promise<DynamicSystemCollection[]> {
  const tags = await prisma.personalTag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { games: true } } },
  });
  return tags.map((tag) => ({
    id: `tag-${tag.id}`,
    name: tag.name,
    icon: "Tag",
    color: "#f97316",
    count: tag._count.games,
    kind: "tag" as const,
    tagId: tag.id,
  }));
}

function dynamicEvidenceWhere() {
  return {
    game: {
      type: "BASE_GAME" as const,
      metadataSnapshots: { some: { provider: "IGDB" as const } },
    },
  } as const;
}

function dynamicEvidenceSelect() {
  return {
    gameId: true,
    game: {
      select: {
        metadataSnapshots: {
          where: { provider: "IGDB" as const },
          orderBy: { fetchedAt: "desc" as const },
          take: 1,
          select: { payload: true },
        },
      },
    },
  } as const;
}

function dynamicEvidenceQuery() {
  return {
    where: dynamicEvidenceWhere(),
    select: dynamicEvidenceSelect(),
  } as const;
}

async function getDynamicEvidence(): Promise<DynamicEvidenceRow[]> {
  return prisma.libraryEntry.findMany(dynamicEvidenceQuery()) as unknown as Promise<DynamicEvidenceRow[]>;
}

function dynamicNamedValue(
  payload: ReturnType<typeof parseIgdbMetadataPayload>,
  kind: DynamicCollectionKind,
): IgdbNamedValue | null {
  if (!payload) return null;
  const value = kind === "series" ? payload.collection : payload.franchise;
  return value && value.name.trim() ? value : null;
}

function dynamicCollectionsFromEvidence(rows: DynamicEvidenceRow[]): DynamicSystemCollection[] {
  const groups = new Map<string, {
    kind: DynamicCollectionKind;
    igdbId: number;
    names: Set<string>;
    gameIds: Set<string>;
  }>();
  const seenGames = new Set<string>();

  for (const row of rows) {
    if (seenGames.has(row.gameId)) continue;
    seenGames.add(row.gameId);
    const payload = parseIgdbMetadataPayload(row.game.metadataSnapshots[0]?.payload);
    if (!payload) continue;

    for (const kind of ["series", "franchise"] as const) {
      const value = dynamicNamedValue(payload, kind);
      if (!value) continue;
      const id = dynamicCollectionId(kind, value.id);
      const group = groups.get(id) ?? {
        kind,
        igdbId: value.id,
        names: new Set<string>(),
        gameIds: new Set<string>(),
      };
      group.names.add(value.name.trim());
      group.gameIds.add(row.gameId);
      groups.set(id, group);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      name: [...group.names].sort((left, right) => left.localeCompare(right))[0],
      icon: group.kind === "series" ? "Books" : "GitBranch",
      color: group.kind === "series" ? "#0ea5e9" : "#a855f7",
      count: group.gameIds.size,
      kind: group.kind,
      igdbId: group.igdbId,
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name) ||
      left.kind.localeCompare(right.kind) ||
      left.igdbId - right.igdbId,
    );
}

export async function getDynamicSystemCollections(): Promise<DynamicSystemCollection[]> {
  return dynamicCollectionsFromEvidence(await getDynamicEvidence());
}

export async function getDynamicSystemCollectionGameIds(id: string): Promise<string[] | null> {
  const tagId = parseTagCollectionId(id);
  if (tagId) {
    const rows = await prisma.gameTag.findMany({ where: { tagId }, select: { gameId: true } });
    return rows.map((row) => row.gameId);
  }

  const dynamic = parseDynamicCollectionId(id);
  if (!dynamic) return null;

  const entries = await getDynamicEvidence();
  const seenGames = new Set<string>();
  return entries.flatMap((entry) => {
    if (seenGames.has(entry.gameId)) return [];
    seenGames.add(entry.gameId);
    const payload = parseIgdbMetadataPayload(entry.game.metadataSnapshots[0]?.payload);
    const value = dynamicNamedValue(payload, dynamic.kind);
    return value?.id === dynamic.igdbId ? [entry.gameId] : [];
  });
}

export async function getSystemCollections(): Promise<SystemCollectionSummary[]> {
  const [counts, dynamicCollections] = await Promise.all([
    Promise.all(
      SYSTEM_COLLECTIONS.map((c) => prisma.libraryEntry.count({ where: c.where })),
    ),
    getDynamicSystemCollections(),
  ]);

  return [
    ...SYSTEM_COLLECTIONS.map((c, i) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      count: counts[i],
    })),
    ...dynamicCollections,
  ];
}

const LIBRARY_GAME_INCLUDE = {
  availability: { include: { alternativeSource: true } },
};

export async function getSystemCollectionGames(id: string) {
  const def = getSystemCollectionDefinition(id);
  if (def) {
    return prisma.libraryEntry.findMany({
      where: def.where,
      include: {
        game: {
          include: LIBRARY_GAME_INCLUDE,
        },
      },
      orderBy: { game: { name: "asc" } },
    });
  }

  const dynamic = parseDynamicCollectionId(id);
  if (!dynamic) return [];

  const entries = await prisma.libraryEntry.findMany({
    where: dynamicEvidenceWhere(),
    include: {
      game: {
        include: {
          ...LIBRARY_GAME_INCLUDE,
          metadataSnapshots: {
            where: { provider: "IGDB" as const },
            orderBy: { fetchedAt: "desc" as const },
            take: 1,
            select: { payload: true },
          },
        },
      },
    },
    orderBy: { game: { name: "asc" } },
  });

  const seenGames = new Set<string>();
  return entries.filter((entry) => {
    if (seenGames.has(entry.gameId)) return false;
    seenGames.add(entry.gameId);
    const payload = parseIgdbMetadataPayload(entry.game.metadataSnapshots[0]?.payload);
    const value = dynamicNamedValue(payload, dynamic.kind);
    return value?.id === dynamic.igdbId;
  });
}
