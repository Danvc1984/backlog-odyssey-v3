import { describe, expect, it } from "vitest";
import { parseRecommendationMetadata } from "./metadata";

const payload = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  igdbId: 1,
  igdbSlug: "example",
  name: "Example",
  summary: null,
  firstReleaseDate: "2020-01-01T00:00:00.000Z",
  genres: [{ id: 1, name: "RPG" }],
  themes: [{ id: 2, name: "Fantasy" }],
  keywords: [{ id: 3, name: "Quest" }],
  developers: [],
  publishers: [{ id: 4, name: "Studio" }],
  esrbRating: "Teen",
  officialWebsite: null,
  alternativeNames: [],
  ratings: {
    aggregated: { score: 82, count: 4 },
    community: { score: 79, count: 10 },
    total: { score: 88, count: 20 },
  },
  collection: { id: 5, name: "Example Collection" },
  franchise: null,
  relations: [],
  gameModes: ["Single-player"],
  multiplayerModes: ["Online co-op"],
  coverUrl: null,
  artworkUrls: [],
  conceptArtUrls: [],
  screenshots: [],
  igdbUpdatedAt: null,
  attribution: { provider: "IGDB", sourceUrl: "https://www.igdb.com/games/example", fetchedAt: "2026-01-01T00:00:00.000Z" },
  palette: null,
  ...overrides,
});

describe("parseRecommendationMetadata", () => {
  it("maps IGDB dimensions and combines descriptive tags", () => {
    expect(parseRecommendationMetadata(payload())).toMatchObject({
      genres: ["RPG"],
      tags: ["Fantasy", "Quest", "Single-player", "Online co-op"],
      publishers: ["Studio"],
      seriesGames: [{ name: "Example Collection" }],
      rating: 4.4,
      ratingCount: 20,
      ratingSource: "IGDB_TOTAL",
    });
  });

  it("falls back to aggregated rating when total rating is absent", () => {
    expect(parseRecommendationMetadata(payload({ ratings: {
      aggregated: { score: 82, count: 4 },
      community: { score: null, count: null },
      total: { score: null, count: null },
    } }))).toMatchObject({ rating: 4.1, ratingCount: 4, ratingSource: "IGDB_AGGREGATED" });
  });

  it("returns no recommendation evidence for malformed or missing payloads", () => {
    expect(parseRecommendationMetadata(null)).toBeNull();
    expect(parseRecommendationMetadata({ schemaVersion: 3 })).toBeNull();
  });
});
