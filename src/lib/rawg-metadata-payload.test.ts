import { describe, expect, it } from "vitest";
import { parseRawgMetadataPayload } from "./rawg-metadata-payload";

const validPayload = {
  schemaVersion: 1 as const,
  rawgId: 42,
  rawgSlug: "hollow-knight",
  title: "Hollow Knight",
  description: null,
  releaseDate: null,
  backgroundImageUrls: [],
  genres: ["Metroidvania"],
  tags: [],
  developers: [],
  publishers: [],
  website: null,
  rating: null,
  metacriticScore: null,
  playtimeHours: null,
  alternativeNames: [],
  rawgUrl: "https://rawg.io/games/hollow-knight",
  attribution: {
    provider: "RAWG" as const,
    sourceUrl: "https://rawg.io/games/hollow-knight",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("parseRawgMetadataPayload", () => {
  it("passes through a version 1 payload with title and genres", () => {
    expect(parseRawgMetadataPayload(validPayload)).toEqual(validPayload);
  });

  it("passes through a version 2 payload with the new evidence fields", () => {
    const v2Payload = {
      ...validPayload,
      schemaVersion: 2 as const,
      esrbRating: { name: "Teen", slug: "teen" },
      seriesGames: [{ rawgId: 1, name: "Portal", slug: "portal", released: "2007-10-09" }],
    };

    expect(parseRawgMetadataPayload(v2Payload)).toEqual(v2Payload);
  });

  it("rejects non-object payloads", () => {
    expect(parseRawgMetadataPayload(null)).toBeNull();
    expect(parseRawgMetadataPayload("payload")).toBeNull();
    expect(parseRawgMetadataPayload(42)).toBeNull();
  });

  it("rejects payloads missing title or with malformed fields", () => {
    expect(parseRawgMetadataPayload({ ...validPayload, title: undefined })).toBeNull();
    expect(parseRawgMetadataPayload({ ...validPayload, genres: undefined })).toBeNull();
    expect(parseRawgMetadataPayload({ ...validPayload, genres: "Metroidvania" })).toBeNull();
  });
});
