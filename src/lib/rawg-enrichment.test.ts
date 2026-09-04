import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { prisma } from "@/lib/prisma";
import {
  persistRawgMatch,
  hasRawgSteamStore,
  resolveWishlistStoreLink,
  toRawgMetadataPayload,
  toWishlistMetadataPayload,
  deriveSequelRelationship,
} from "./rawg-enrichment";
import type { RawgGameDetails, RawgMatchResult, RawgSeriesEntry } from "./rawg-types";

const fetchedAt = new Date("2026-08-19T18:30:00.000Z");

const game: RawgGameDetails = {
  id: 123,
  slug: "portal-2",
  name: "Portal 2",
  description: "A puzzle game",
  released: "2011-04-18",
  backgroundImage: "https://media.rawg.io/portal-2.jpg",
  backgroundImageAdditional: null,
  genres: [{ id: 1, name: "Puzzle", slug: "puzzle" }],
  tags: [{ id: 2, name: "Singleplayer", slug: "singleplayer" }],
  developers: [{ id: 3, name: "Valve", slug: "valve" }],
  publishers: [{ id: 4, name: "Valve", slug: "valve" }],
  website: "https://www.thinkwithportals.com/",
  rating: 4.4,
  metacritic: 95,
  playtime: 9,
  alternativeNames: ["Portal 2"],
  rawgUpdatedAt: "2026-08-19T00:00:00Z",
  rawgUrl: "https://rawg.io/games/portal-2",
  stores: [],
  esrbRating: null,
  seriesGames: [],
  screenshots: [],
  palette: null,
};

const matched: RawgMatchResult = {
  outcome: "MATCHED",
  matchMethod: "EXACT_STEAM_APP_ID",
  game,
};

describe("RAWG metadata persistence", () => {
  const findUniqueExternalId = vi.fn();
  const deleteExternalIds = vi.fn();
  const createExternalId = vi.fn();
  const deleteSnapshots = vi.fn();
  const createSnapshot = vi.fn();
  const transaction = vi.fn();
  const tx = {
    externalGameId: {
      findUnique: findUniqueExternalId,
      deleteMany: deleteExternalIds,
      create: createExternalId,
    },
    metadataSnapshot: {
      deleteMany: deleteSnapshots,
      create: createSnapshot,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as { $transaction: typeof transaction }).$transaction =
      transaction;
    transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    findUniqueExternalId.mockResolvedValue(null);
    deleteExternalIds.mockResolvedValue({ count: 0 });
    createExternalId.mockResolvedValue({ id: "external-1" });
    deleteSnapshots.mockResolvedValue({ count: 1 });
    createSnapshot.mockResolvedValue({ id: "snapshot-1" });
  });

  it("maps normalized RAWG fields into the versioned payload", () => {
    expect(toRawgMetadataPayload(game, fetchedAt)).toEqual({
      schemaVersion: 3,
      rawgId: 123,
      rawgSlug: "portal-2",
      title: "Portal 2",
      description: "A puzzle game",
      releaseDate: "2011-04-18",
      backgroundImageUrls: ["https://media.rawg.io/portal-2.jpg"],
      genres: ["Puzzle"],
      tags: ["Singleplayer"],
      developers: ["Valve"],
      publishers: ["Valve"],
      website: "https://www.thinkwithportals.com/",
      rating: 4.4,
      metacriticScore: 95,
      playtimeHours: 9,
      alternativeNames: ["Portal 2"],
      rawgUrl: "https://rawg.io/games/portal-2",
      attribution: {
        provider: "RAWG",
        sourceUrl: "https://rawg.io/games/portal-2",
        fetchedAt: "2026-08-19T18:30:00.000Z",
      },
      esrbRating: null,
      seriesGames: [],
      palette: null,
      screenshots: [],
    });
  });

  it("writes the identity and replaceable snapshot in one transaction", async () => {
    await expect(persistRawgMatch("game-1", matched, fetchedAt)).resolves.toEqual({
      success: true,
      data: { gameId: "game-1", rawgId: 123, fetchedAt },
      error: null,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(findUniqueExternalId).toHaveBeenCalledWith({
      where: {
        namespace_externalId: {
          namespace: "RAWG_GAME",
          externalId: "123",
        },
      },
    });
    expect(deleteExternalIds).toHaveBeenCalledWith({
      where: { gameId: "game-1", namespace: "RAWG_GAME" },
    });
    expect(createExternalId).toHaveBeenCalledWith({
      data: {
        namespaceId: "123",
        namespace: "RAWG_GAME",
        externalId: "123",
        matchMethod: "EXACT_STEAM_APP_ID",
        gameId: "game-1",
      },
    });
    expect(deleteSnapshots).toHaveBeenCalledWith({
      where: { gameId: "game-1", provider: "RAWG" },
    });
    expect(createSnapshot).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gameId: "game-1",
        provider: "RAWG",
        sourceUrl: "https://rawg.io/games/portal-2",
        fetchedAt,
        payload: expect.objectContaining({ schemaVersion: 3, rawgId: 123 }),
      }),
    });
  });

  it("rejects an identity collision before any mutation", async () => {
    findUniqueExternalId.mockResolvedValue({ gameId: "other-game" });

    await expect(persistRawgMatch("game-1", matched, fetchedAt)).resolves.toEqual({
      success: false,
      data: null,
      error: {
        code: "RAWG_ID_CONFLICT",
        message: "RAWG game identity is already attached to another catalog game",
      },
    });

    expect(deleteExternalIds).not.toHaveBeenCalled();
    expect(createExternalId).not.toHaveBeenCalled();
    expect(deleteSnapshots).not.toHaveBeenCalled();
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    { outcome: "NOT_FOUND" as const },
    { outcome: "AMBIGUOUS" as const, candidates: [] },
    {
      outcome: "UNAVAILABLE" as const,
      error: { category: "NETWORK" as const, message: "offline" },
    },
  ])("does not write for a $outcome result", async (result) => {
    await expect(persistRawgMatch("game-1", result, fetchedAt)).resolves.toMatchObject({
      success: false,
      error: { code: "NOT_MATCHED" },
    });

    expect(transaction).not.toHaveBeenCalled();
  });

  it("keeps optional provider data empty instead of fabricating values", () => {
    const incomplete = {
      ...game,
      description: null,
      backgroundImage: null,
      backgroundImageAdditional: null,
      genres: [],
      tags: [],
      developers: [],
      publishers: [],
      website: null,
      rating: null,
      metacritic: null,
      playtime: null,
      alternativeNames: [],
    };

    const payload = toRawgMetadataPayload(incomplete, fetchedAt);
    expect(payload.description).toBeNull();
    expect(payload.backgroundImageUrls).toEqual([]);
    expect(payload.genres).toEqual([]);
    expect(payload.website).toBeNull();
    expect(payload.rating).toBeNull();
  });
});

describe("wishlist store-link extension", () => {
  it("detects the steam-slug store entry regardless of its empty URL", () => {
    expect(
      hasRawgSteamStore([
        { storeSlug: "gog", storeName: "GOG", url: "" },
        { storeSlug: "steam", storeName: "Steam", url: "" },
      ]),
    ).toBe(true);
    expect(hasRawgSteamStore([{ storeSlug: "gog", storeName: "GOG", url: null }])).toBe(false);
  });

  it("returns null without a lookup when RAWG lists no Steam store", async () => {
    const findSteamAppId = vi.fn();

    expect(
      await resolveWishlistStoreLink({ ...game, stores: [{ storeSlug: "gog", storeName: "GOG", url: "" }] }, findSteamAppId),
    ).toBeNull();
    expect(findSteamAppId).not.toHaveBeenCalled();
  });

  it("resolves the App ID through the exact-name Steam lookup", async () => {
    const link = {
      steamUrl: "https://store.steampowered.com/app/620",
      steamAppId: "620",
    };
    const findSteamAppId = vi.fn().mockResolvedValue(link);
    const gameWithSteamStore = {
      ...game,
      stores: [{ storeSlug: "steam", storeName: "Steam", url: "" }],
    };

    expect(await resolveWishlistStoreLink(gameWithSteamStore, findSteamAppId)).toEqual(link);
    expect(findSteamAppId).toHaveBeenCalledWith("Portal 2");
  });

  it("adds the resolved store link to the wishlist payload only, never the catalog payload", () => {
    const storeLink = { steamUrl: "https://store.steampowered.com/app/620", steamAppId: "620" };

    expect(toWishlistMetadataPayload(game, fetchedAt, storeLink)).toMatchObject({
      storeLink,
    });
    expect(toWishlistMetadataPayload(game, fetchedAt)).toMatchObject({ storeLink: null });

    const catalogPayload = toRawgMetadataPayload(game, fetchedAt) as unknown as Record<string, unknown>;
    expect(catalogPayload).not.toHaveProperty("storeLink");
  });
});

describe("sequel derivation", () => {
  const series: RawgSeriesEntry[] = [
    { rawgId: 3, name: "Bridge Constructor Portal", slug: "bridge-constructor-portal", released: "2017-12-20" },
    { rawgId: 1, name: "Portal", slug: "portal", released: "2007-10-09" },
    { rawgId: 123, name: "Portal 2", slug: "portal-2", released: "2011-04-18" },
    { rawgId: 6, name: "Same-day release", slug: "same-day", released: "2011-04-18" },
    { rawgId: 2, name: "Portal Stories: Mel", slug: "portal-stories-mel", released: "2015-06-30" },
    { rawgId: 4, name: "Undated entry", slug: null, released: null },
    { rawgId: 5, name: "Unparseable date", slug: null, released: "not-a-date" },
  ];

  it("keeps only strictly later releases, oldest first, excluding the current game", () => {
    expect(deriveSequelRelationship({ rawgId: 123, releaseDate: "2011-04-18" }, series)).toEqual([
      { rawgId: 2, name: "Portal Stories: Mel", slug: "portal-stories-mel", released: "2015-06-30" },
      { rawgId: 3, name: "Bridge Constructor Portal", slug: "bridge-constructor-portal", released: "2017-12-20" },
    ]);
  });

  it("returns empty when the current game has no release date", () => {
    expect(deriveSequelRelationship({ rawgId: 123, releaseDate: null }, series)).toEqual([]);
  });

  it("returns empty when the current release date cannot be parsed", () => {
    expect(deriveSequelRelationship({ rawgId: 123, releaseDate: "garbage" }, series)).toEqual([]);
  });
});
