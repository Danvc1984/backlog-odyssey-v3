import { describe, expect, it } from "vitest";
import {
  igdbLibraryCardMetadataView,
  igdbWishlistCardMetadataView,
  libraryCardMetadataView,
} from "./card-metadata-view";

const payload = {
  title: "Portal 2",
  description: "A puzzle game",
  backgroundImageUrls: ["https://example.com/portal-2.jpg"],
  genres: ["Puzzle"],
  developers: ["Valve"],
  releaseDate: "2011-04-18",
  rating: 4.6,
  metacriticScore: 95,
  playtimeHours: 9,
  esrbRating: { name: "Everyone 10+" },
};

describe("card metadata views", () => {
  it("projects IGDB portrait and wide artwork with total rating fallback", () => {
    expect(igdbLibraryCardMetadataView({
      schemaVersion: 1,
      name: "Portal 2",
      summary: "A puzzle game",
      coverUrl: "https://images.example/cover.jpg",
      artworkUrls: [],
      screenshots: [{ image: "https://images.example/screenshot.jpg", width: null, height: null }],
      genres: [{ id: 1, name: "Puzzle" }],
      developers: [{ id: 2, name: "Valve" }],
      firstReleaseDate: "2011-04-18",
      ratings: {
        total: { score: null, count: 0 },
        aggregated: { score: 92, count: 10 },
      },
      esrbRating: "Everyone 10+",
    })).toMatchObject({
      imageUrl: "https://images.example/cover.jpg",
      wideImageUrl: "https://images.example/screenshot.jpg",
      rating: 92,
    });
  });

  it("projects IGDB wishlist artwork, summary, and duration", () => {
    expect(igdbWishlistCardMetadataView({
      schemaVersion: 1,
      name: "Portal 2",
      summary: "A puzzle game",
      coverUrl: "https://images.example/cover.jpg",
      artworkUrls: ["https://images.example/artwork.jpg"],
      screenshots: [{ image: "https://images.example/screenshot.jpg", width: null, height: null }],
      genres: [{ id: 1, name: "Puzzle" }],
      developers: [{ id: 2, name: "Valve" }],
      ratings: { total: { score: 92, count: 10 }, aggregated: { score: null, count: null }, community: { score: null, count: null } },
      themes: [], keywords: [], publishers: [], relations: [], gameModes: [], multiplayerModes: [],
      firstReleaseDate: "2011-04-18", esrbRating: null, officialWebsite: null, alternativeNames: [],
      collection: null, franchise: null, conceptArtUrls: [], igdbId: 1, igdbSlug: "portal-2",
      igdbUpdatedAt: null, attribution: { provider: "IGDB", sourceUrl: "https://igdb.com/games/portal-2", fetchedAt: "2026-09-11" }, palette: null,
    }, 9)).toEqual({
      imageUrl: "https://images.example/cover.jpg",
      wideImageUrl: "https://images.example/artwork.jpg",
      description: "A puzzle game",
      genres: ["Puzzle"],
      developers: ["Valve"],
      releaseDate: "2011-04-18",
      rating: 92,
      durationHours: 9,
    });
  });

  it("keeps duration cards when an IGDB summary is absent", () => {
    expect(igdbLibraryCardMetadataView({
      schemaVersion: 1,
      name: "Portal 2",
      summary: null,
      coverUrl: "https://images.example/cover.jpg",
      artworkUrls: [],
      screenshots: [],
      genres: [],
      developers: [],
      ratings: { total: { score: null, count: null }, aggregated: { score: null, count: null } },
    }, 12)).toMatchObject({
      description: null,
      playtimeHours: 12,
    });
  });

  it("projects the library cover and card metadata", () => {
    expect(libraryCardMetadataView(payload)).toEqual({
      imageUrl: "https://example.com/portal-2.jpg",
      genres: ["Puzzle"],
      description: "A puzzle game",
      developers: ["Valve"],
      releaseDate: "2011-04-18",
      rating: 4.6,
      metacriticScore: 95,
      playtimeHours: 9,
      esrbName: "Everyone 10+",
    });
  });

  it("returns null for invalid payloads", () => {
    expect(libraryCardMetadataView({ title: "Missing genres" })).toBeNull();
  });
});
