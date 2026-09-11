import { describe, expect, it } from "vitest";

import { parseIgdbGameToPayload } from "./igdb-metadata-payload";
import type { IgdbGameResponse } from "./igdb-types";

const fetchedAt = new Date("2026-09-10T18:00:00.000Z");

describe("IGDB metadata payload", () => {
  it("maps the version-one contract with distinct ratings and capped media", () => {
    const game: IgdbGameResponse = {
      id: 42,
      slug: "portal-2",
      name: "Portal 2",
      summary: "A puzzle game",
      first_release_date: 1303084800,
      genres: [{ id: 1, name: "Puzzle" }],
      themes: [{ id: 2, name: "Science fiction" }],
      keywords: [{ id: 3, name: "Portal" }],
      involved_companies: [
        { company: { id: 10, name: "Valve" }, developer: true, publisher: true },
      ],
      age_ratings: [{ category: 1, rating: 6 }],
      websites: [{ category: 1, url: "https://www.thinkwithportals.com/" }],
      alternative_names: [{ name: "Portal 2" }],
      collection: { id: 20, name: "Portal" },
      franchise: { id: 21, name: "Portal" },
      category: 0,
      game_modes: [{ id: 1, name: "Single player" }, { id: 99, name: "Unknown" }],
      multiplayer_modes: [{ onlinecoop: true, lan: true }],
      dlcs: [{ id: 50, name: "DLC" }],
      remasters: [{ id: 51, name: "Remaster" }],
      cover: { image_id: "cover-id" },
      artworks: Array.from({ length: 7 }, (_, index) => ({
        image_id: `art-${index}`,
        image_type: { name: "Artwork" },
      })),
      screenshots: Array.from({ length: 7 }, (_, index) => ({ image_id: `screen-${index}`, width: 1920, height: 1080 })),
      aggregated_rating: 90,
      aggregated_rating_count: 10,
      rating: 88,
      rating_count: 20,
      total_rating: 89,
      total_rating_count: 30,
      updated_at: 1720000000,
    };

    expect(parseIgdbGameToPayload(game, fetchedAt)).toEqual({
      schemaVersion: 1,
      igdbId: 42,
      igdbSlug: "portal-2",
      name: "Portal 2",
      summary: "A puzzle game",
      firstReleaseDate: "2011-04-18T00:00:00.000Z",
      genres: [{ id: 1, name: "Puzzle" }],
      themes: [{ id: 2, name: "Science fiction" }],
      keywords: [{ id: 3, name: "Portal" }],
      developers: [{ id: 10, name: "Valve" }],
      publishers: [{ id: 10, name: "Valve" }],
      esrbRating: "Mature",
      officialWebsite: "https://www.thinkwithportals.com/",
      alternativeNames: ["Portal 2"],
      ratings: {
        aggregated: { score: 90, count: 10 },
        community: { score: 88, count: 20 },
        total: { score: 89, count: 30 },
      },
      collection: { id: 20, name: "Portal" },
      franchise: { id: 21, name: "Portal" },
      relations: [
        { kind: "DLC", igdbId: 50, name: "DLC" },
        { kind: "Remaster", igdbId: 51, name: "Remaster" },
      ],
      gameModes: ["Single-player"],
      multiplayerModes: ["LAN", "Online co-op"],
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cover-id.jpg",
      artworkUrls: [
        "https://images.igdb.com/igdb/image/upload/t_720p/art-0.jpg",
        "https://images.igdb.com/igdb/image/upload/t_720p/art-1.jpg",
        "https://images.igdb.com/igdb/image/upload/t_720p/art-2.jpg",
        "https://images.igdb.com/igdb/image/upload/t_720p/art-3.jpg",
        "https://images.igdb.com/igdb/image/upload/t_720p/art-4.jpg",
        "https://images.igdb.com/igdb/image/upload/t_720p/art-5.jpg",
      ],
      conceptArtUrls: [],
      screenshots: Array.from({ length: 6 }, (_, index) => ({
        image: `https://images.igdb.com/igdb/image/upload/t_1080p/screen-${index}.jpg`,
        width: 1920,
        height: 1080,
      })),
      igdbUpdatedAt: "2024-07-03T09:46:40.000Z",
      attribution: {
        provider: "IGDB",
        sourceUrl: "https://www.igdb.com/games/portal-2",
        fetchedAt: fetchedAt.toISOString(),
      },
      palette: null,
    });
  });

  it("degrades missing and malformed values to null or empty collections", () => {
    const malformed = {
      id: 0,
      slug: "",
      name: null,
      summary: 42,
      first_release_date: "not-a-date",
      genres: [{ id: 0, name: null }],
      involved_companies: [{ company: { id: 1, name: "" }, developer: true }],
      age_ratings: [{ category: 1, rating: 999 }],
      websites: [{ category: 1, url: 7 }],
      game_modes: [{ id: 999 }],
      screenshots: [{ image_id: null }],
    } as unknown as IgdbGameResponse;

    expect(parseIgdbGameToPayload(malformed, fetchedAt)).toMatchObject({
      igdbId: null,
      igdbSlug: null,
      name: null,
      summary: null,
      firstReleaseDate: null,
      genres: [],
      developers: [],
      publishers: [],
      esrbRating: null,
      officialWebsite: null,
      gameModes: [],
      screenshots: [],
      palette: null,
    });
  });

  it("keeps only key art, artwork, and concept art", () => {
    const payload = parseIgdbGameToPayload({
      id: 42,
      name: "Portal 2",
      artworks: [
        { image_id: "key-art", image_type: { name: "Key Art" } },
        { image_id: "regular", image_type: { name: "Artwork" } },
        { image_id: "concept", image_type: { name: "Concept Art" } },
        { image_id: "logo", image_type: { name: "Logo" } },
        { image_id: "untyped" },
      ],
    }, fetchedAt);

    expect(payload.artworkUrls).toEqual([
      "https://images.igdb.com/igdb/image/upload/t_720p/key-art.jpg",
      "https://images.igdb.com/igdb/image/upload/t_720p/regular.jpg",
    ]);
    expect(payload.conceptArtUrls).toEqual([
      "https://images.igdb.com/igdb/image/upload/t_720p/concept.jpg",
    ]);
  });
});
