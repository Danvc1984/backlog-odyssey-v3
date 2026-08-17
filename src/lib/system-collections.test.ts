import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { prisma } from "@/lib/prisma";
import {
  SYSTEM_COLLECTIONS,
  isSystemCollectionId,
  getSystemCollectionDefinition,
  getSystemCollections,
  getSystemCollectionGames,
} from "./system-collections";

describe("system collection definitions", () => {
  it("defines the five expected system collections", () => {
    expect(SYSTEM_COLLECTIONS.map((c) => c.id)).toEqual([
      "play-soon",
      "replay-candidates",
      "favorites",
      "hidden",
      "abandoned",
    ]);
  });

  it("recognizes system collection ids", () => {
    expect(isSystemCollectionId("play-soon")).toBe(true);
    expect(isSystemCollectionId("abandoned")).toBe(true);
    expect(isSystemCollectionId("custom-collection")).toBe(false);
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

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as { libraryEntry: { count: typeof mockCount } }).libraryEntry = {
      count: mockCount,
    };
    mockCount.mockResolvedValue(3);
  });

  it("returns id, name, icon, color, and count per collection", async () => {
    const result = await getSystemCollections();

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      id: "play-soon",
      name: "Play soon",
      icon: "Clock",
      color: "#f59e0b",
      count: 3,
    });
    expect(mockCount).toHaveBeenCalledTimes(5);
    expect(mockCount).toHaveBeenCalledWith({
      where: { playSoon: true },
    });
    expect(mockCount).toHaveBeenCalledWith({
      where: { playState: "ABANDONED" },
    });
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

  it("queries games with the matching filter", async () => {
    await getSystemCollectionGames("favorites");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { rating: { gte: 8 } },
      include: {
        game: {
          include: {
            availability: true,
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

  it("returns an empty array for an unknown system collection id", async () => {
    const result = await getSystemCollectionGames("not-a-system");

    expect(result).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns the games from the query", async () => {
    mockFindMany.mockResolvedValue([{ id: "entry-1" }, { id: "entry-2" }]);

    const result = await getSystemCollectionGames("hidden");

    expect(result).toEqual([{ id: "entry-1" }, { id: "entry-2" }]);
  });
});
