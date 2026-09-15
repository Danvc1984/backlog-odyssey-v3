import { describe, expect, it, vi } from "vitest";
import { rebuildRecommendationProfile } from "./profile";

const payload = (extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  igdbId: 1,
  igdbSlug: "game",
  name: "Game",
  summary: null,
  firstReleaseDate: "2020-01-01T00:00:00.000Z",
  genres: [{ id: 1, name: "RPG" }],
  themes: [],
  keywords: [{ id: 2, name: "Story" }],
  developers: [],
  publishers: [{ id: 3, name: "Studio" }],
  esrbRating: "Mature",
  officialWebsite: null,
  alternativeNames: [],
  ratings: { aggregated: { score: null, count: null }, community: { score: null, count: null }, total: { score: null, count: null } },
  collection: { id: 4, name: "Game 2" },
  franchise: null,
  relations: [],
  gameModes: [],
  multiplayerModes: [],
  coverUrl: null,
  artworkUrls: [],
  conceptArtUrls: [],
  screenshots: [],
  igdbUpdatedAt: null,
  attribution: { provider: "IGDB", sourceUrl: "https://www.igdb.com/games/game", fetchedAt: "2026-01-01T00:00:00.000Z" },
  palette: null,
  ...extra,
});

describe("rebuildRecommendationProfile", () => {
  it("aggregates event dimensions, maturity, series, and decay", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const client = {
      recommendationEvent: { findMany: vi.fn().mockResolvedValue([
        {
          kind: "COMPLETION", gameId: "g1", wishlistEntryId: null, createdAt: now,
          payload: null, game: { libraryEntry: { gameExperience: "PC_GAMING", preferredEnvironment: "LINUX" }, metadataSnapshots: [{ payload: payload() }], playtimeEvidence: { provider: "IGDB", payload: { normallySeconds: 9 * 3600 } } }, wishlistEntry: null,
        },
        {
          kind: "START", gameId: "g1", wishlistEntryId: null, createdAt: new Date("2025-07-05T00:00:00.000Z"),
          payload: null, game: { libraryEntry: null, metadataSnapshots: [{ payload: payload({ esrbRating: null, collection: null }) }] }, wishlistEntry: null,
        },
      ]) },
      recommendationProfile: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const result = await rebuildRecommendationProfile(client as never, now);
    expect(result.evidence.eventsConsidered).toBe(2);
    expect(result.dimensions.GENRE.RPG).toMatchObject({ weight: 2.5, support: 2 });
    expect(result.dimensions.MATURITY.Mature).toMatchObject({ weight: 2, support: 1 });
    expect(result.dimensions.SERIES["Game 2"]).toMatchObject({ weight: 2, support: 1 });
    expect(result.dimensions.DURATION.MEDIUM).toMatchObject({ weight: 2, support: 1 });
    expect(client.recommendationProfile.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
  });

  it("keeps empty history well formed and counts unresolved targets", async () => {
    const upsert = vi.fn();
    const client = {
      recommendationEvent: { findMany: vi.fn().mockResolvedValue([{ kind: "START", gameId: "missing", wishlistEntryId: null, createdAt: new Date(), payload: null, game: null, wishlistEntry: null }]) },
      recommendationProfile: { upsert },
    };
    const result = await rebuildRecommendationProfile(client as never, new Date("2026-01-01T00:00:00.000Z"));
    expect(result.evidence.unresolvedTargets).toBe(1);
    expect(Object.keys(result.dimensions)).toHaveLength(9);
  });

  it("retains completion and abandonment signals from hidden games", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const hiddenGame = {
      libraryEntry: {
        hidden: true,
        gameExperience: "PC_GAMING",
        preferredEnvironment: "LINUX",
      },
    };
    const client = {
      recommendationEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            kind: "COMPLETION",
            gameId: "hidden-completed",
            wishlistEntryId: null,
            createdAt: now,
            payload: null,
            game: { ...hiddenGame, metadataSnapshots: [{ payload: payload({ genres: [{ id: 1, name: "RPG" }] }) }] },
            wishlistEntry: null,
          },
          {
            kind: "ABANDONMENT",
            gameId: "hidden-abandoned",
            wishlistEntryId: null,
            createdAt: now,
            payload: null,
            game: { ...hiddenGame, metadataSnapshots: [{ payload: payload({ genres: [], keywords: [{ id: 5, name: "Stealth" }] }) }] },
            wishlistEntry: null,
          },
        ]),
      },
      recommendationProfile: { upsert: vi.fn().mockResolvedValue({}) },
    };

    const result = await rebuildRecommendationProfile(client as never, now);

    expect(result.evidence.byKind).toMatchObject({ COMPLETION: 1, ABANDONMENT: 1 });
    expect(result.dimensions.GENRE.RPG).toMatchObject({ weight: 2, support: 1 });
    expect(result.dimensions.TAG.Stealth).toMatchObject({ weight: -1, support: 1 });
    expect(result.dimensions.EXPERIENCE.PC_GAMING).toMatchObject({ weight: 1, support: 2 });
  });

  it("filters legacy environment evidence while preserving other dimensions", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const client = {
      recommendationEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            kind: "COMPLETION",
            gameId: "legacy-windows",
            wishlistEntryId: null,
            createdAt: now,
            payload: null,
            game: {
              libraryEntry: { gameExperience: "PC_GAMING", preferredEnvironment: "WINDOWS" },
              metadataSnapshots: [{ payload: payload({ genres: [{ id: 1, name: "RPG" }] }) }],
            },
            wishlistEntry: null,
          },
        ]),
      },
      recommendationProfile: { upsert: vi.fn().mockResolvedValue({}) },
    };

    const result = await rebuildRecommendationProfile(client as never, now, ["LINUX"]);

    expect(result.dimensions.ENVIRONMENT).toEqual({});
    expect(result.dimensions.GENRE.RPG).toMatchObject({ weight: 2, support: 1 });
    expect(result.dimensions.EXPERIENCE.PC_GAMING).toMatchObject({ weight: 2, support: 1 });
  });

  it("uses wishlist IGDB duration evidence for profile signals", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const client = {
      recommendationEvent: {
        findMany: vi.fn().mockResolvedValue([{
          kind: "COMPLETION",
          gameId: null,
          wishlistEntryId: "wish-1",
          createdAt: now,
          payload: null,
          game: null,
          wishlistEntry: {
            gameExperience: null,
            metadataSnapshot: { payload: { durationEvidence: { provider: "IGDB", payload: { normallySeconds: 9 * 3600 } } } },
          },
        }]),
      },
      recommendationProfile: { upsert: vi.fn().mockResolvedValue({}) },
    };

    const result = await rebuildRecommendationProfile(client as never, now, ["LINUX"], "NORMALLY");

    expect(result.dimensions.DURATION.MEDIUM).toMatchObject({ weight: 2, support: 1 });
  });
});
