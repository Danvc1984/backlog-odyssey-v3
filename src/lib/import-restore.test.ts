import { describe, expect, it, vi } from "vitest";
import {
  assertEmptySchema,
  restoreExportDocument,
  reviveRows,
  type ImportDb,
  type TxDb,
} from "./import-restore";
import type { ExportDocument } from "./export-schema";

const now = "2026-09-04T12:00:00.000Z";

function minimalDocument(): ExportDocument {
  return {
    version: 2,
    exportedAt: now,
    data: {
      settings: null,
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
    },
  };
}

function mockTxDb() {
  const callOrder: string[] = [];
  const createMany = (model: string) =>
    vi.fn().mockImplementation(async () => {
      callOrder.push(model);
      return { count: 0 };
    });
  const db = {
    appSettings: { createMany: createMany("appSettings") },
    game: { createMany: createMany("game") },
    libraryEntry: { createMany: createMany("libraryEntry") },
    gameAvailability: { createMany: createMany("gameAvailability") },
    externalGameId: { createMany: createMany("externalGameId") },
    alternativeSource: { createMany: createMany("alternativeSource") },
    personalTag: { createMany: createMany("personalTag") },
    gameTag: { createMany: createMany("gameTag") },
    collection: { createMany: createMany("collection") },
    collectionMembership: { createMany: createMany("collectionMembership") },
    wishlistEntry: { createMany: createMany("wishlistEntry") },
    unresolvedSteamDlc: { createMany: createMany("unresolvedSteamDlc") },
    wishlistImportReview: { createMany: createMany("wishlistImportReview") },
    wishlistImportIgnore: { createMany: createMany("wishlistImportIgnore") },
    possibleDuplicate: { createMany: createMany("possibleDuplicate") },
    recommendationRun: { createMany: createMany("recommendationRun") },
    recommendationItem: { createMany: createMany("recommendationItem") },
    recommendationFeedback: { createMany: createMany("recommendationFeedback") },
    recommendationEvent: { createMany: createMany("recommendationEvent") },
    recommendationProfile: { createMany: createMany("recommendationProfile") },
    recommendationPreference: { createMany: createMany("recommendationPreference") },
    recommendationTuneState: { createMany: createMany("recommendationTuneState") },
    recommendationPreset: { createMany: createMany("recommendationPreset") },
  } as unknown as TxDb;
  return { db, callOrder };
}

function gameRow(id: string, baseGameId: string | null) {
  return {
    id,
    type: baseGameId ? "DLC" : "BASE_GAME",
    origin: "MANUAL",
    name: id,
    baseGameId,
    importAt: now,
    createdAt: now,
    updatedAt: now,
  } as const;
}

const zeroDb = () =>
  Object.fromEntries(
    [
      "appSettings",
      "game",
      "libraryEntry",
      "gameAvailability",
      "externalGameId",
      "alternativeSource",
      "personalTag",
      "gameTag",
      "collection",
      "collectionMembership",
      "wishlistEntry",
      "unresolvedSteamDlc",
      "wishlistImportReview",
      "wishlistImportIgnore",
      "possibleDuplicate",
      "recommendationRun",
      "recommendationItem",
      "recommendationFeedback",
      "recommendationEvent",
      "recommendationProfile",
      "recommendationPreference",
      "recommendationTuneState",
      "recommendationPreset",
    ].map((model) => [model, { count: vi.fn().mockResolvedValue(0) }]),
  ) as unknown as ImportDb;

describe("reviveRows", () => {
  it("converts the named date fields to Date instances", () => {
    const rows = [
      {
        id: "g1",
        name: "Portal 2",
        createdAt: "2026-09-04T12:00:00.000Z",
        updatedAt: "2026-09-04T12:00:01.000Z",
      },
      {
        id: "g2",
        name: "Half-Life",
        createdAt: "2026-09-04T12:00:00.000Z",
        updatedAt: "2026-09-04T12:00:01.000Z",
      },
    ];
    const revived = reviveRows(rows, ["createdAt", "updatedAt"]);
    expect(revived[0].createdAt).toBeInstanceOf(Date);
    expect(revived[0].updatedAt).toBeInstanceOf(Date);
    expect((revived[0].createdAt as Date).toISOString()).toBe("2026-09-04T12:00:00.000Z");
    expect(revived[1]).toEqual({
      id: "g2",
      name: "Half-Life",
      createdAt: new Date("2026-09-04T12:00:00.000Z"),
      updatedAt: new Date("2026-09-04T12:00:01.000Z"),
    });
  });

  it("preserves null and non-date values untouched", () => {
    const revived = reviveRows(
      [{ id: "w1", reviewedAt: null, notes: "hi", updatedAt: "2026-01-01T00:00:00.000Z" }],
      ["reviewedAt", "updatedAt"],
    );
    expect(revived[0].reviewedAt).toBeNull();
    expect(revived[0].notes).toBe("hi");
    expect(revived[0].updatedAt).toBeInstanceOf(Date);
  });
});

describe("assertEmptySchema", () => {
  it("returns empty for a fully empty database", async () => {
    const result = await assertEmptySchema(zeroDb());
    expect(result).toEqual({ empty: true, nonEmpty: [] });
  });

  it("lists a single non-empty domain", async () => {
    const db = zeroDb();
    (db.game.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    const result = await assertEmptySchema(db);
    expect(result.empty).toBe(false);
    expect(result.nonEmpty).toEqual(["games"]);
  });

  it("lists multiple non-empty domains without duplicates", async () => {
    const db = zeroDb();
    (db.wishlistEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (db.recommendationRun.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (db.recommendationItem.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

    const result = await assertEmptySchema(db);
    expect(result.empty).toBe(false);
    expect(result.nonEmpty).toEqual(["wishlist", "recommendations"]);
  });
});

describe("restoreExportDocument", () => {
  it("restores marked and unmarked handheld options, defaulting old rows to null", async () => {
    const { db } = mockTxDb();
    const doc = minimalDocument();
    doc.data.libraryEntries = [
      {
        id: "l1",
        gameId: "g1",
        playState: "NOT_STARTED",
        isMainGame: false,
        priority: "NONE",
        interest: null,
        rating: null,
        preferredEnvironment: null,
        gameExperience: null,
        handheldSuitable: true,
        compatOverrideStatus: null,
        compatOverrideReason: null,
        playSoon: false,
        replayCandidate: false,
        hidden: false,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "l2",
        gameId: "g2",
        playState: "NOT_STARTED",
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
    ];

    await restoreExportDocument(db, doc);

    const rows = (db.libraryEntry.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(rows).toEqual([
      expect.objectContaining({ id: "l1", handheldSuitable: true }),
      expect.objectContaining({ id: "l2", handheldSuitable: null }),
    ]);
  });

  it("inserts in the documented order with base games before DLCs", async () => {
    const { db, callOrder } = mockTxDb();
    const doc = minimalDocument();
    doc.data.games = [
      gameRow("dlc2", "base1"),
      gameRow("base2", null),
      gameRow("base1", null),
      gameRow("dlc1", "base1"),
    ];
    doc.data.alternativeSources = [
      { id: "alt1", name: "GOG", normalizedName: "gog", knownKey: null, archivedAt: null, createdAt: now, updatedAt: now },
    ];
    doc.data.tags = [{ id: "tag1", name: "Puzzle" }];
    doc.data.collections = [{ id: "col1", name: "Favorites", color: null, icon: null, isSystem: false, createdAt: now }];
    doc.data.libraryEntries = [
      {
        id: "l1",
        gameId: "base1",
        playState: "NOT_STARTED",
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
    ];
    doc.data.externalIds = [
      { id: "e1", namespaceId: "s", namespace: "STEAM_APP", externalId: "620", matchMethod: "EXACT_STEAM_APP_ID", gameId: "base1" },
    ];
    doc.data.availability = [
      { id: "a1", gameId: "base1", source: "STEAM", alternativeSourceId: "alt1", displayName: null, steamAppId: "620", steamPlaytimeTotal: null, steamLastPlayed: null, addedAt: now },
    ];
    doc.data.recommendations.runs = [{ id: "r1", kind: "PLAY_NEXT", context: null, createdAt: now }];
    doc.data.recommendations.items = [
      { id: "i1", runId: "r1", gameId: "base1", wishlistEntryId: null, rank: 1, score: 8, positive: null, negative: null, caveats: null, role: "BEST_FIT_1", createdAt: now },
    ];

    const counts = await restoreExportDocument(db, doc);

    expect(callOrder).toEqual([
      "game",
      "game",
      "alternativeSource",
      "personalTag",
      "collection",
      "libraryEntry",
      "externalGameId",
      "gameAvailability",
      "recommendationRun",
      "recommendationItem",
    ]);
    const game = db.game.createMany as ReturnType<typeof vi.fn>;
    expect(game).toHaveBeenCalledTimes(2);
    const firstData = game.mock.calls[0][0].data as Array<{ id: string }>;
    const secondData = game.mock.calls[1][0].data as Array<{ id: string }>;
    expect(firstData.map((r) => r.id)).toEqual(["base2", "base1"]);
    expect(secondData.map((r) => r.id)).toEqual(["dlc2", "dlc1"]);
    expect(counts.games).toBe(4);
    expect(counts.libraryEntries).toBe(1);
    expect(counts.recommendationRuns).toBe(1);
    expect(counts.recommendationItems).toBe(1);
  });

  it("creates the singleton rows when present and skips them when null", async () => {
    const { db, callOrder } = mockTxDb();
    const doc = minimalDocument();
    doc.data.settings = {
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
      steamDailySyncEnabled: true,
      itadDailyRefresh: true,
      createdAt: now,
      updatedAt: now,
    };
    doc.data.recommendations.profile = { id: 1, version: 1, payload: {}, rebuiltAt: now, updatedAt: now };
    doc.data.recommendations.tuneState = { id: 1, playTune: null, buyTune: null, updatedAt: now };

    const counts = await restoreExportDocument(db, doc);
    expect(callOrder).toEqual(["appSettings", "recommendationProfile", "recommendationTuneState"]);
    expect(counts.settings).toBe(1);
    expect(counts.recommendationProfile).toBe(1);
    expect(counts.recommendationTuneState).toBe(1);

    const { db: emptyDb, callOrder: emptyOrder } = mockTxDb();
    await restoreExportDocument(emptyDb, minimalDocument());
    expect(emptyOrder).toEqual([]);
  });

  it("counts match input lengths and every populated domain is written", async () => {
    const { db, callOrder } = mockTxDb();
    const doc = minimalDocument();
    doc.data.wishlist = [
      { id: "w1", name: "Elden Ring", type: "BASE_GAME", baseGameId: null, interest: 5, gameExperience: null, targetPriceMxn: "899.00", notes: null, steamAppId: "1245620", steamAppIdProvenance: "STEAM_IMPORT", createdAt: now, updatedAt: now },
    ];
    doc.data.unresolvedDlc = [
      { id: "u1", steamAppId: "1000", name: "DLC", steamBaseAppId: null, source: "OWNED_SYNC", status: "PENDING", discardedAt: null, createdAt: now, updatedAt: now },
    ];
    doc.data.wishlistImportReviews = [
      { id: "r2", steamAppId: "2000", name: "X", candidates: [], status: "OPEN", reviewedAt: null, createdAt: now, updatedAt: now },
    ];
    doc.data.wishlistImportIgnores = [{ id: "ig1", steamAppId: "3000", name: "Y", createdAt: now }];
    doc.data.possibleDuplicates = [
      { id: "p1", gameAId: "a", gameBId: "b", evidence: null, confidence: 0.9, status: "OPEN", reviewedAt: null },
    ];
    doc.data.recommendations.preferences = [
      { id: "pref1", dimension: "GENRE", value: "puzzle", attitude: "PREFER", createdAt: now, updatedAt: now },
    ];
    doc.data.recommendations.events = [
      { id: "ev1", kind: "START", gameId: "a", wishlistEntryId: null, runId: null, reason: null, payload: null, createdAt: now },
    ];
    doc.data.recommendations.feedback = [
      { id: "fb1", gameId: "a", wishlistEntryId: null, kind: "PLAY_NEXT", createdAt: now },
    ];
    doc.data.recommendations.presets = [
      { id: "pr1", name: "Balanced", tune: {}, createdAt: now, updatedAt: now },
    ];

    const counts = await restoreExportDocument(db, doc);
    expect(counts.wishlist).toBe(1);
    expect(counts.unresolvedDlc).toBe(1);
    expect(counts.wishlistImportReviews).toBe(1);
    expect(counts.wishlistImportIgnores).toBe(1);
    expect(counts.possibleDuplicates).toBe(1);
    expect(counts.recommendationPreferences).toBe(1);
    expect(counts.recommendationEvents).toBe(1);
    expect(counts.recommendationFeedback).toBe(1);
    expect(counts.recommendationPresets).toBe(1);
    expect(callOrder).toEqual([
      "wishlistEntry",
      "unresolvedSteamDlc",
      "wishlistImportReview",
      "wishlistImportIgnore",
      "possibleDuplicate",
      "recommendationFeedback",
      "recommendationEvent",
      "recommendationPreference",
      "recommendationPreset",
    ]);
  });

  it("aborts on a thrown failure without calling later models", async () => {
    const { db, callOrder } = mockTxDb();
    const doc = minimalDocument();
    doc.data.games = [gameRow("base1", null)];
    doc.data.libraryEntries = [
      {
        id: "l1",
        gameId: "base1",
        playState: "NOT_STARTED",
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
    ];
    (db.libraryEntry.createMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

    await expect(restoreExportDocument(db, doc)).rejects.toThrow("boom");
    expect(callOrder).toEqual(["game"]);
  });
});
