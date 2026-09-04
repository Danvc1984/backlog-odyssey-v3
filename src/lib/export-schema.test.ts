import { describe, expect, it } from "vitest";
import {
  availabilitySchema,
  collectionsSchema,
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
    };
    expect(settingsSchema.parse(row)).toEqual(row);
  });

  it("settings rejects a wrong keyword string", () => {
    expect(() =>
      settingsSchema.parse({
        id: 1,
        theme: "NIGHT",
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
      preferredEnvironment: "BAZZITE",
      gameExperience: "PC_GAMING",
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