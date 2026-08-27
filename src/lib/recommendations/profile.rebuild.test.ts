import { describe, expect, it, vi } from "vitest";
import { rebuildRecommendationProfile } from "./profile";

const payload = (extra: Record<string, unknown> = {}) => ({
  title: "Game",
  genres: ["RPG"],
  tags: ["Story"],
  publishers: ["Studio"],
  releaseDate: "2020-01-01",
  playtimeHours: 10,
  esrbRating: { name: "Mature" },
  seriesGames: [{ name: "Game 2" }],
  ...extra,
});

describe("rebuildRecommendationProfile", () => {
  it("aggregates event dimensions, maturity, series, and decay", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const client = {
      recommendationEvent: { findMany: vi.fn().mockResolvedValue([
        {
          kind: "COMPLETION", gameId: "g1", wishlistEntryId: null, createdAt: now,
          payload: null, game: { libraryEntry: { gameExperience: "PC_GAMING", preferredEnvironment: "BAZZITE" }, metadataSnapshots: [{ payload: payload() }] }, wishlistEntry: null,
        },
        {
          kind: "START", gameId: "g1", wishlistEntryId: null, createdAt: new Date("2025-07-05T00:00:00.000Z"),
          payload: null, game: { libraryEntry: null, metadataSnapshots: [{ payload: payload({ esrbRating: undefined, seriesGames: undefined }) }] }, wishlistEntry: null,
        },
      ]) },
      recommendationProfile: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const result = await rebuildRecommendationProfile(client as never, now);
    expect(result.evidence.eventsConsidered).toBe(2);
    expect(result.dimensions.GENRE.RPG).toMatchObject({ weight: 2.5, support: 2 });
    expect(result.dimensions.MATURITY.Mature).toMatchObject({ weight: 2, support: 1 });
    expect(result.dimensions.SERIES["Game 2"]).toMatchObject({ weight: 2, support: 1 });
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
});
