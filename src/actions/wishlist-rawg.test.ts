import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rawg-api", () => ({
  matchRawgGame: vi.fn(),
  searchRawgCandidates: vi.fn(),
}));
vi.mock("@/lib/rawg-enrichment", () => ({
  resolveWishlistStoreLink: vi.fn().mockResolvedValue(null),
  toWishlistMetadataPayload: (
    game: { id: number; name: string; rawgUrl: string },
    fetchedAt: Date,
    storeLink: unknown = null,
  ) => ({
    schemaVersion: 1,
    rawgId: game.id,
    title: game.name,
    rawgUrl: game.rawgUrl,
    storeLink,
    attribution: {
      provider: "RAWG",
      sourceUrl: game.rawgUrl,
      fetchedAt: fetchedAt.toISOString(),
    },
  }),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { matchRawgGame, searchRawgCandidates } from "@/lib/rawg-api";
import { resolveWishlistStoreLink } from "@/lib/rawg-enrichment";
import {
  enrichWishlistEntryWithRawg,
  removeWishlistMetadata,
  searchWishlistRawg,
} from "./wishlist-rawg";

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockDeleteMany = vi.fn();

const rawgGame = {
  id: 123,
  slug: "portal-2",
  name: "Portal 2",
  description: "A puzzle game",
  released: "2011-04-18",
  backgroundImage: "https://media.rawg.io/portal-2.jpg",
  backgroundImageAdditional: null,
  genres: [{ id: 1, name: "Puzzle", slug: "puzzle" }],
  tags: [{ id: 2, name: "Sci-fi", slug: "sci-fi" }],
  developers: [{ id: 3, name: "Valve", slug: "valve" }],
  publishers: [{ id: 3, name: "Valve", slug: "valve" }],
  website: "https://www.thinkwithportals.com/",
  rating: 4.6,
  metacritic: 95,
  playtime: 9,
  alternativeNames: [],
  rawgUpdatedAt: "2026-08-19T00:00:00Z",
  rawgUrl: "https://rawg.io/games/portal-2",
  stores: [
    { storeSlug: "steam", storeName: "Steam", url: "https://store.steampowered.com/app/620/Portal_2/" },
    { storeSlug: "gog", storeName: "GOG", url: "https://www.gog.com/game/portal_2" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (prisma as unknown as { wishlistEntry: Record<string, ReturnType<typeof vi.fn>> }).wishlistEntry = {
    findUnique: mockFindUnique,
  };
  (prisma as unknown as { wishlistMetadataSnapshot: Record<string, ReturnType<typeof vi.fn>> }).wishlistMetadataSnapshot = {
    upsert: mockUpsert,
    deleteMany: mockDeleteMany,
  };
  mockFindUnique.mockResolvedValue({ id: "wish-1", name: "Portal 2", type: "BASE_GAME" });
  mockUpsert.mockResolvedValue({ id: "snapshot-1", wishlistEntryId: "wish-1" });
  mockDeleteMany.mockResolvedValue({ count: 1 });
});

describe("searchWishlistRawg", () => {
  it("returns RAWG candidates for a title", async () => {
    vi.mocked(searchRawgCandidates).mockResolvedValue([
      { id: 123, slug: "portal-2", name: "Portal 2", released: "2011-04-18", backgroundImage: null },
    ]);

    const result = await searchWishlistRawg({ title: " Portal 2 " });

    expect(result.success).toBe(true);
    expect(searchRawgCandidates).toHaveBeenCalledWith("Portal 2", 1);

    await searchWishlistRawg({ title: "Portal 2", page: 2 });
    expect(searchRawgCandidates).toHaveBeenCalledWith("Portal 2", 2);
  });

  it("surfaces provider failures without touching wishlist state", async () => {
    vi.mocked(searchRawgCandidates).mockResolvedValue({
      category: "HTTP",
      message: "RAWG rate limit",
      status: 429,
    });

    const result = await searchWishlistRawg({ title: "Portal 2" });

    expect(result).toEqual({ success: false, data: null, error: "RAWG rate limit" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe("enrichWishlistEntryWithRawg", () => {
  it("persists normalized metadata with attribution", async () => {
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "MATCHED",
      matchMethod: "MANUAL_RAWG_SEARCH",
      game: rawgGame,
    });

    const result = await enrichWishlistEntryWithRawg({ wishlistEntryId: "wish-1", rawgId: 123 });

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { wishlistEntryId: "wish-1" },
      create: expect.objectContaining({
        provider: "RAWG",
        sourceUrl: rawgGame.rawgUrl,
        payload: expect.objectContaining({
          rawgId: 123,
          attribution: expect.objectContaining({ provider: "RAWG", sourceUrl: rawgGame.rawgUrl }),
        }),
      }),
    }));
  });  it("persists the resolved Steam store link with the snapshot", async () => {
    const link = { steamUrl: "https://store.steampowered.com/app/620", steamAppId: "620" };
    vi.mocked(resolveWishlistStoreLink).mockResolvedValue(link);
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "MATCHED",
      matchMethod: "MANUAL_RAWG_SEARCH",
      game: rawgGame,
    });

    await enrichWishlistEntryWithRawg({ wishlistEntryId: "wish-1", rawgId: 123 });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          payload: expect.objectContaining({ storeLink: link }),
        }),
      }),
    );
    vi.mocked(resolveWishlistStoreLink).mockResolvedValue(null);
  });

  it("does not overwrite the snapshot when RAWG fails", async () => {
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "UNAVAILABLE",
      error: { category: "NETWORK", message: "RAWG could not be reached" },
    });

    const result = await enrichWishlistEntryWithRawg({ wishlistEntryId: "wish-1", rawgId: 123 });

    expect(result).toEqual({ success: false, data: null, error: "RAWG could not be reached" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rejects DLC metadata enrichment and removes a snapshot explicitly", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "wish-1", name: "DLC", type: "DLC" });
    const rejected = await enrichWishlistEntryWithRawg({ wishlistEntryId: "wish-1", rawgId: 123 });
    const removed = await removeWishlistMetadata({ wishlistEntryId: "wish-1" });

    expect(rejected.error).toBe("RAWG metadata is only available for base-game wishes");
    expect(removed.success).toBe(true);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { wishlistEntryId: "wish-1" } });
  });
});
