import { describe, expect, it } from "vitest";
import {
  availabilitySchema,
  collectionsSchema,
  exportDocumentSchema,
  externalIdsSchema,
  gamesSchema,
  libraryEntriesSchema,
  settingsSchema,
} from "./export-schema";

const now = "2026-09-04T12:00:00.000Z";

describe("export schema: settings and catalog", () => {
  it("settings parses a valid row", () => {
    const row = {
      id: 1,
      theme: "SYSTEM",
      primaryOs: "LINUX",
      hasWindowsFallback: true,
      handheldOs: "LINUX",
      onboardingCompleted: true,
      priceCountry: "MX",
      timeZone: "America/Mexico_City",
      wallpaperEnabled: true,
      reducedData: false,
      durationProfile: "NORMALLY",
      steamDailySyncEnabled: true,
      itadDailyRefresh: true,
      createdAt: now,
      updatedAt: now,
    };
    expect(settingsSchema.parse(row)).toEqual(row);
  });

  it("settings rejects a wrong keyword string", () => {
    expect(() =>
      settingsSchema.parse({
        id: 1,
        theme: "NIGHT",
        primaryOs: "LINUX",
        hasWindowsFallback: true,
        handheldOs: "LINUX",
        onboardingCompleted: true,
        priceCountry: "MX",
        timeZone: "America/Mexico_City",
        wallpaperEnabled: true,
        reducedData: false,
        steamDailySyncEnabled: true,
        itadDailyRefresh: true,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });

  it("games parses a valid row and tolerates a null baseGameId", () => {
    const base = {
      id: "g1",
      type: "BASE_GAME",
      origin: "STEAM_IMPORT",
      name: "Portal 2",
      baseGameId: null,
      importAt: now,
      createdAt: now,
      updatedAt: now,
    };
    expect(gamesSchema.parse([base, { ...base, id: "g2", type: "DLC", baseGameId: "g1" }])).toHaveLength(2);
  });

  it("games rejects a malformed date", () => {
    expect(() =>
      gamesSchema.parse([
        {
          id: "g1",
          type: "BASE_GAME",
          origin: "STEAM_IMPORT",
          name: "X",
          baseGameId: null,
          importAt: "not-a-date",
          createdAt: now,
          updatedAt: now,
        },
      ]),
    ).toThrow();
  });

  it("parses library, availability, external ids, and collections", () => {
    const library = {
      id: "l1",
      gameId: "g1",
      playState: "IN_PROGRESS",
      isMainGame: true,
      priority: "HIGH",
      interest: 4,
      rating: 4,
      preferredEnvironment: "LINUX",
      gameExperience: "PC_GAMING",
      handheldSuitable: true,
      compatOverrideStatus: "READY",
      compatOverrideReason: null,
      playSoon: false,
      replayCandidate: true,
      hidden: false,
      notes: "great",
      createdAt: now,
      updatedAt: now,
    };
    const availability = {
      id: "a1",
      gameId: "g1",
      source: "STEAM",
      alternativeSourceId: "alt1",
      displayName: "Steam",
      steamAppId: "620",
      steamPlaytimeTotal: "12345",
      steamLastPlayed: now,
      addedAt: now,
    };
    const external = {
      id: "e1",
      namespaceId: "steam",
      namespace: "STEAM_APP",
      externalId: "620",
      matchMethod: "EXACT_STEAM_APP_ID",
      gameId: "g1",
    };
    expect(libraryEntriesSchema.parse([library])).toHaveLength(1);
    expect(libraryEntriesSchema.parse([library])[0].handheldSuitable).toBe(true);
    expect(availabilitySchema.parse([availability])).toHaveLength(1);
    expect(externalIdsSchema.parse([external])).toHaveLength(1);
    expect(
      collectionsSchema.parse([
        { id: "c1", name: "Favorites", color: "#ff0000", icon: null, isSystem: false, createdAt: now },
      ]),
    ).toHaveLength(1);
  });

  it("rejects a wrong library entry enum", () => {
    expect(() =>
      libraryEntriesSchema.parse([
        {
          id: "l1",
          gameId: "g1",
          playState: "NEVER",
          isMainGame: false,
          priority: "NONE",
          interest: null,
          rating: null,
          preferredEnvironment: null,
          gameExperience: null,
          compatOverrideStatus: null,
          compatOverrideReason: null,
          playSoon: false,
          replayCandidate: false,
          hidden: false,
          notes: null,
          createdAt: now,
          updatedAt: now,
        },
      ]),
    ).toThrow();
  });
});

describe("export document schema", () => {
  it("maps a version 1 environment into the current settings shape", () => {
    const legacyEntry = {
      id: "l1",
      gameId: "g1",
      playState: "NOT_STARTED",
      isMainGame: false,
      priority: null,
      interest: null,
      rating: null,
      preferredEnvironment: "BAZZITE",
      gameExperience: null,
      compatOverrideStatus: null,
      compatOverrideReason: null,
      playSoon: false,
      replayCandidate: false,
      hidden: false,
      notes: null,
      createdAt: now,
      updatedAt: now,
    };
    const legacyData = {
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
      libraryEntries: [legacyEntry],
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

    const parsed = exportDocumentSchema.parse({ version: 1, exportedAt: now, data: legacyData });
    expect(parsed.version).toBe(2);
    expect(parsed.data.settings).toMatchObject({
      primaryOs: "LINUX",
      hasWindowsFallback: true,
      handheldOs: "LINUX",
      onboardingCompleted: true,
      durationProfile: "NORMALLY",
    });
    expect(parsed.data.libraryEntries[0].preferredEnvironment).toBe("LINUX");
    expect(parsed.data.libraryEntries[0].handheldSuitable).toBeUndefined();
  });
});
