import { describe, expect, it } from "vitest";
import {
  exportDocumentSchema,
  EXPORT_VERSION,
  recommendationsSchema,
  type ExportDocument,
} from "./export-schema";

const now = "2026-09-04T12:00:00.000Z";

function emptyData(): ExportDocument["data"] {
  return {
    settings: {
      id: 1,
      theme: "SYSTEM",
      desktopOs: "BAZZITE",
      portableDevice: "STEAM_DECK",
      fallbackOs: "WINDOWS",
      priceCountry: "MX",
      timeZone: "America/Mexico_City",
      wallpaperEnabled: true,
      reducedData: false,
      steamDailySyncEnabled: true,
      itadDailyRefresh: true,
      createdAt: now,
      updatedAt: now,
    },
    games: [],
    libraryEntries: [],
    availability: [],
    externalIds: [],
    alternativeSources: [],
    tags: [],
    gameTags: [],
    collections: [],
    collectionMemberships: [],
    wishlist: [],
    unresolvedDlc: [],
    wishlistImportReviews: [],
    wishlistImportIgnores: [],
    possibleDuplicates: [],
    recommendations: {
      runs: [],
      items: [],
      feedback: [],
      events: [],
      profile: null,
      preferences: [],
      tuneState: null,
      presets: [],
    },
  };
}

describe("export document schema", () => {
  it("parses a complete minimal document", () => {
    const doc = { version: EXPORT_VERSION, exportedAt: now, data: emptyData() };
    const parsed = exportDocumentSchema.parse(doc);
    expect(parsed.version).toBe(1);
    expect(parsed.data.settings).not.toBeNull();
  });

  it("rejects a wrong version", () => {
    expect(() =>
      exportDocumentSchema.parse({ version: 2, exportedAt: now, data: emptyData() }),
    ).toThrow();
  });

  it("parses a null settings row", () => {
    const data = emptyData();
    data.settings = null;
    expect(exportDocumentSchema.parse({ version: 1, exportedAt: now, data }).data.settings).toBeNull();
  });

  it("parses a wishlist row with a decimal target price as a string", () => {
    const wishlist = [
      {
        id: "w1",
        name: "Elden Ring",
        type: "BASE_GAME",
        baseGameId: null,
        interest: 5,
        gameExperience: null,
        targetPriceMxn: "899.00",
        notes: null,
        steamAppId: "1245620",
        steamAppIdProvenance: "STEAM_IMPORT",
        createdAt: now,
        updatedAt: now,
      } as const,
    ];
    const data = emptyData();
    data.wishlist = wishlist;
    expect(exportDocumentSchema.parse({ version: 1, exportedAt: now, data }).data.wishlist).toHaveLength(1);
  });

  it("parses a full recommendations object with a profile and tunes", () => {
    const recommendations = {
      runs: [
        { id: "r1", kind: "PLAY_NEXT", context: null, createdAt: now },
      ],
      items: [
        {
          id: "i1",
          runId: "r1",
          gameId: "g1",
          wishlistEntryId: null,
          rank: 1,
          score: 8.5,
          positive: null,
          negative: null,
          caveats: { note: "long" },
          role: "BEST_FIT_1",
          createdAt: now,
        },
      ],
      feedback: [{ id: "f1", gameId: "g1", wishlistEntryId: null, kind: "PLAY_NEXT", createdAt: now }],
      events: [
        {
          id: "e1",
          kind: "START",
          gameId: "g1",
          wishlistEntryId: null,
          runId: "r1",
          reason: "picked",
          payload: { source: "ui" },
          createdAt: now,
        },
      ],
      profile: { id: 1, version: 1, payload: { tastes: [] }, rebuiltAt: now, updatedAt: now },
      preferences: [
        {
          id: "p1",
          dimension: "GENRE",
          value: "puzzle",
          attitude: "PREFER",
          createdAt: now,
          updatedAt: now,
        },
      ],
      tuneState: { id: 1, playTune: null, buyTune: { weight: 0.5 }, updatedAt: now },
      presets: [{ id: "s1", name: "Balanced", tune: { settings: {} }, createdAt: now, updatedAt: now }],
    };
    expect(recommendationsSchema.parse(recommendations).runs).toHaveLength(1);
  });

  it("rejects an empty arrays fail case by rejecting a wrong kind", () => {
    expect(() =>
      recommendationsSchema.parse({
        runs: [{ id: "r1", kind: "WATCH", context: null, createdAt: now }],
        items: [],
        feedback: [],
        events: [],
        profile: null,
        preferences: [],
        tuneState: null,
        presets: [],
      }),
    ).toThrow();
  });
});
