import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rawg-api", () => ({ matchRawgGame: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { matchRawgGame } from "@/lib/rawg-api";
import { autoEnrichWishlistEntries } from "./wishlist-rawg-queue";

const findUniqueEntry = vi.fn();
const upsertSnapshot = vi.fn();
const rawgGame = {
  id: 123,
  slug: "portal-2",
  name: "Portal 2",
  description: "A puzzle game",
  released: "2011-04-18",
  backgroundImage: null,
  backgroundImageAdditional: null,
  genres: [],
  tags: [],
  developers: [],
  publishers: [],
  website: null,
  rating: 4,
  metacritic: 95,
  playtime: 9,
  alternativeNames: [],
  rawgUpdatedAt: null,
  rawgUrl: "https://rawg.io/games/portal-2",
  stores: [],
  esrbRating: null,
  seriesGames: [],
  screenshots: [],
  palette: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  (prisma as unknown as Record<string, unknown>).wishlistEntry = { findUnique: findUniqueEntry };
  (prisma as unknown as Record<string, unknown>).wishlistMetadataSnapshot = { upsert: upsertSnapshot };
  findUniqueEntry.mockResolvedValue({
    id: "wish-1",
    name: "Portal 2",
    type: "BASE_GAME",
    metadataSnapshot: null,
  });
  upsertSnapshot.mockResolvedValue({ id: "snapshot-1" });
  vi.mocked(matchRawgGame).mockResolvedValue({
    outcome: "MATCHED",
    matchMethod: "MANUAL_RAWG_SEARCH",
    game: rawgGame,
  });
});

describe("autoEnrichWishlistEntries", () => {
  it("persists an exact RAWG match", async () => {
    await expect(autoEnrichWishlistEntries(["wish-1"])).resolves.toEqual({
      enriched: 1,
      skipped: 0,
    });
    expect(matchRawgGame).toHaveBeenCalledWith({ title: "Portal 2", selectedRawgId: null });
    expect(upsertSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      where: { wishlistEntryId: "wish-1" },
      create: expect.objectContaining({ provider: "RAWG", sourceUrl: rawgGame.rawgUrl }),
    }));
  });

  it("skips ambiguous and not-found matches", async () => {
    vi.mocked(matchRawgGame)
      .mockResolvedValueOnce({ outcome: "AMBIGUOUS", candidates: [] })
      .mockResolvedValueOnce({ outcome: "NOT_FOUND" });

    await expect(autoEnrichWishlistEntries(["wish-1", "wish-2"])).resolves.toEqual({
      enriched: 0,
      skipped: 2,
    });
    expect(upsertSnapshot).not.toHaveBeenCalled();
  });

  it("swallows RAWG errors and skips entries with existing snapshots", async () => {
    vi.mocked(matchRawgGame).mockRejectedValue(new Error("RAWG unavailable"));
    findUniqueEntry
      .mockResolvedValueOnce({
        id: "wish-1",
        name: "Portal 2",
        type: "BASE_GAME",
        metadataSnapshot: { id: "snapshot-1" },
      })
      .mockResolvedValueOnce({
        id: "wish-2",
        name: "Another game",
        type: "BASE_GAME",
        metadataSnapshot: null,
      });

    await expect(autoEnrichWishlistEntries(["wish-1", "wish-2"])).resolves.toEqual({
      enriched: 0,
      skipped: 2,
    });
    expect(matchRawgGame).toHaveBeenCalledTimes(1);
    expect(upsertSnapshot).not.toHaveBeenCalled();
  });

  it("bounds concurrent RAWG matches for a larger import", async () => {
    let inFlight = 0;
    let peak = 0;
    findUniqueEntry.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: where.id,
      type: "BASE_GAME",
      metadataSnapshot: null,
    }));
    vi.mocked(matchRawgGame).mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return { outcome: "MATCHED", matchMethod: "MANUAL_RAWG_SEARCH", game: rawgGame };
    });

    await expect(
      autoEnrichWishlistEntries(["wish-1", "wish-2", "wish-3", "wish-4", "wish-5", "wish-6"]),
    ).resolves.toEqual({ enriched: 6, skipped: 0 });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBe(3);
  });
});
