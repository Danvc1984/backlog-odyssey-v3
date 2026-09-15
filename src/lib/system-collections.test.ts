import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { prisma } from "@/lib/prisma";
import { parseIgdbGameToPayload } from "@/lib/igdb-metadata-payload";
import {
  SYSTEM_COLLECTIONS,
  getDynamicSystemCollections,
  getSystemCollections,
  getSystemCollectionDefinition,
  getSystemCollectionGames,
  isCalculatedCollectionId,
  isSystemCollectionId,
  parseDynamicCollectionId,
} from "./system-collections";

const payload = (id: number, name: string, collection: { id: number; name: string } | null, franchise: { id: number; name: string } | null) =>
  parseIgdbGameToPayload({ id, name, collection, franchise });

describe("system collection definitions", () => {
  it("defines the existing and planned system collections", () => {
    expect(SYSTEM_COLLECTIONS.map((c) => c.id)).toEqual([
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
    ]);
    expect(getSystemCollectionDefinition("in-progress")?.where).toEqual({ playState: "IN_PROGRESS" });
    expect(getSystemCollectionDefinition("completed")?.where).toEqual({ playState: "PLAYED_BEFORE" });
    expect(getSystemCollectionDefinition("backlog")?.where).toEqual({ playState: "NOT_STARTED" });
    expect(getSystemCollectionDefinition("handheld-picks")?.where).toEqual({ handheldSuitable: true });
    expect(getSystemCollectionDefinition("games-with-dlc")?.where).toEqual({
      game: { type: "BASE_GAME", dlcs: { some: {} } },
    });
  });

  it("recognizes static and dynamic calculated collection ids", () => {
    expect(isSystemCollectionId("play-soon")).toBe(true);
    expect(isSystemCollectionId("abandoned")).toBe(true);
    expect(isSystemCollectionId("custom-collection")).toBe(false);
    expect(parseDynamicCollectionId("igdb-series-20")).toEqual({ kind: "series", igdbId: 20 });
    expect(parseDynamicCollectionId("igdb-franchise-20")).toEqual({ kind: "franchise", igdbId: 20 });
    expect(parseDynamicCollectionId("igdb-series-0")).toBeNull();
    expect(parseDynamicCollectionId("igdb-series-not-an-id")).toBeNull();
    expect(isCalculatedCollectionId("igdb-series-20")).toBe(true);
    expect(isCalculatedCollectionId("not-a-system")).toBe(false);
  });

  it("resolves a definition by id", () => {
    const def = getSystemCollectionDefinition("favorites");
    expect(def?.name).toBe("Favorites");
    expect(def?.where).toEqual({ rating: { gte: 8 } });
    expect(getSystemCollectionDefinition("nope")).toBeUndefined();
  });
});

describe("getSystemCollections", () => {
  const mockCount = vi.fn();
  const mockFindMany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as {
      libraryEntry: { count: typeof mockCount; findMany: typeof mockFindMany };
    }).libraryEntry = {
      count: mockCount,
      findMany: mockFindMany,
    };
    mockCount.mockResolvedValue(3);
    mockFindMany.mockResolvedValue([]);
  });

  it("returns all static collections and their counts", async () => {
    const result = await getSystemCollections();

    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({
      id: "play-soon",
      name: "Play soon",
      icon: "Clock",
      color: "#f59e0b",
      count: 3,
    });
    expect(mockCount).toHaveBeenCalledTimes(10);
    expect(mockCount).toHaveBeenCalledWith({ where: { playState: "IN_PROGRESS" } });
    expect(mockCount).toHaveBeenCalledWith({
      where: { game: { type: "BASE_GAME", dlcs: { some: {} } } },
    });
  });

  it("groups only valid current IGDB evidence with stable, distinct ids", async () => {
    mockFindMany.mockResolvedValue([
      { gameId: "game-1", game: { metadataSnapshots: [{ payload: payload(1, "Alpha", { id: 20, name: "Portal" }, { id: 20, name: "Portal" }) }] } },
      { gameId: "game-2", game: { metadataSnapshots: [{ payload: payload(2, "Beta", { id: 20, name: "Portal" }, null) }] } },
      { gameId: "game-1", game: { metadataSnapshots: [{ payload: payload(1, "Duplicate", { id: 20, name: "Portal" }, null) }] } },
      { gameId: "malformed", game: { metadataSnapshots: [{ payload: { schemaVersion: 1 } }] } },
      { gameId: "stale", game: { metadataSnapshots: [{ payload: { ...payload(3, "Old", { id: 20, name: "Portal" }, null), ratings: null } }, { payload: payload(3, "Old", { id: 20, name: "Portal" }, null) }] } },
    ]);

    const result = await getSystemCollections();
    expect(result.slice(10)).toEqual([
      {
        id: "igdb-franchise-20",
        name: "Portal",
        icon: "GitBranch",
        color: "#a855f7",
        count: 1,
        kind: "franchise",
        igdbId: 20,
      },
      {
        id: "igdb-series-20",
        name: "Portal",
        icon: "Books",
        color: "#0ea5e9",
        count: 2,
        kind: "series",
        igdbId: 20,
      },
    ]);
    expect(await getDynamicSystemCollections()).toHaveLength(2);
  });
});

describe("getSystemCollectionGames", () => {
  const mockFindMany = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as {
      libraryEntry: { findMany: typeof mockFindMany };
    }).libraryEntry = { findMany: mockFindMany };
    mockFindMany.mockResolvedValue([]);
  });

  it("queries static games with the matching filter", async () => {
    await getSystemCollectionGames("favorites");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { rating: { gte: 8 } },
      include: {
        game: {
          include: {
            availability: { include: { alternativeSource: true } },
          },
        },
      },
      orderBy: { game: { name: "asc" } },
    });
  });

  it("queries with the abandoned play-state filter", async () => {
    await getSystemCollectionGames("abandoned");

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playState: "ABANDONED" },
      }),
    );
  });

  it("returns the games from the static query", async () => {
    mockFindMany.mockResolvedValue([{ id: "entry-1" }, { id: "entry-2" }]);

    const result = await getSystemCollectionGames("hidden");

    expect(result).toEqual([{ id: "entry-1" }, { id: "entry-2" }]);
  });

  it("returns only matching current evidence for a dynamic shelf", async () => {
    mockFindMany.mockResolvedValue([
      {
        gameId: "game-1",
        game: { metadataSnapshots: [{ payload: payload(1, "Alpha", { id: 20, name: "Portal" }, null) }] },
      },
      {
        gameId: "game-2",
        game: { metadataSnapshots: [{ payload: payload(2, "Beta", null, { id: 20, name: "Portal" }) }] },
      },
      {
        gameId: "game-3",
        game: { metadataSnapshots: [{ payload: { schemaVersion: 1 } }] },
      },
    ]);

    const result = await getSystemCollectionGames("igdb-series-20");
    expect(result.map((entry) => entry.gameId)).toEqual(["game-1"]);
  });

  it("returns an empty array for an unknown or malformed id", async () => {
    expect(await getSystemCollectionGames("igdb-series-999")).toEqual([]);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    mockFindMany.mockClear();

    expect(await getSystemCollectionGames("not-a-system")).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
