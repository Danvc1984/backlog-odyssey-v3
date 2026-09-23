import { describe, expect, it } from "vitest";
import {
  availabilitySchema,
  exportDocumentSchema,
  externalIdsSchema,
  gamesSchema,
  libraryEntriesSchema,
  settingsSchema,
  tagsSchema,
  wishlistSchema,
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
      displayCurrency: "MXN",
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

  it("parses library, availability, and external ids", () => {
    const library = {
      id: "l1",
      gameId: "g1",
      playState: "IN_PROGRESS",
      completedBefore: false,
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
      createdAt: now,
      updatedAt: now,
    };
    const availability = {
      id: "a1",
      gameId: "g1",
      source: "STEAM",
      alternativeSourceId: "alt1",
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
  });

  it("rejects retired notes and availability display labels", () => {
    const library = {
      id: "l1",
      gameId: "g1",
      playState: "IN_PROGRESS",
      completedBefore: false,
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
      createdAt: now,
      updatedAt: now,
      notes: "retired",
    };
    const availability = {
      id: "a1",
      gameId: "g1",
      source: "STEAM",
      alternativeSourceId: null,
      steamAppId: null,
      steamPlaytimeTotal: null,
      steamLastPlayed: null,
      addedAt: now,
      displayName: "retired",
    };

    expect(() => libraryEntriesSchema.parse([library])).toThrow();
    expect(() => availabilitySchema.parse([availability])).toThrow();
  });

  it("requires the persisted normalized tag identity", () => {
    expect(tagsSchema.parse([{ id: "tag-1", name: "RPG", normalizedName: "rpg" }])).toHaveLength(1);
    expect(() => tagsSchema.parse([{ id: "tag-1", name: "RPG" }])).toThrow();
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
          createdAt: now,
          updatedAt: now,
        },
      ]),
    ).toThrow();
  });
});

describe("export document schema", () => {
  it("round-trips the IGDB suggestion provenance", () => {
    const wishlistEntry = {
      id: "w1",
      name: "Portal 2",
      type: "BASE_GAME",
      baseGameId: null,
      interest: null,
      gameExperience: null,
      handheldSuitable: null,
      targetPriceMxn: null,
      steamAppId: "620",
      steamAppIdProvenance: "IGDB_SUGGESTION",
      createdAt: now,
      updatedAt: now,
    } as const;

    expect(wishlistSchema.parse([wishlistEntry])).toEqual([wishlistEntry]);
  });

  it("rejects legacy export versions instead of migrating play states", () => {
    expect(() =>
      exportDocumentSchema.parse({
        version: 1,
        exportedAt: now,
        data: { settings: null, games: [], libraryEntries: [] },
      }),
    ).toThrow();
  });
});
