import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/actions/game-detail", () => ({ updatePlayState: vi.fn() }));
vi.mock("@/lib/protondb-api", () => ({
  parseProtonDbSummary: vi.fn((_appId: string, payload: unknown) => {
    const candidate = payload as { status?: string; tier?: string; confidence?: string } | null;
    if (!candidate?.status) return null;
    return {
      appId: _appId,
      status: candidate.status,
      tier: candidate.tier ?? "borked",
      confidence: candidate.confidence ?? "weak",
      raw: candidate,
    };
  }),
}));
vi.mock("@/lib/recommendations/events", () => ({
  logRecommendationEvent: vi.fn(),
  pruneRecommendationEvents: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/recommendations/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/recommendations/profile")>();
  return {
    ...actual,
    rebuildRecommendationProfile: vi.fn().mockResolvedValue({
      windowEnd: "2026-01-01T00:00:00.000Z",
      evidence: { eventsConsidered: 0 },
      dimensions: {
        GENRE: {}, TAG: {}, EXPERIENCE: {}, DURATION: {}, PUBLISHER: {}, ERA: {}, SERIES: {}, ENVIRONMENT: {}, MATURITY: {},
      },
    }),
  };
});

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { updatePlayState } from "@/actions/game-detail";
import { EXPOSURE_COOLDOWN_DAYS, RUN_RETENTION_DAYS } from "@/lib/recommendations/types";
import { logRecommendationEvent } from "@/lib/recommendations/events";
import { rebuildRecommendationProfile } from "@/lib/recommendations/profile";
import {
  dismissRecommendation,
  recordRunExposure,
  restartRecommendations,
  setRecommendationPreference,
  removeRecommendationPreference,
  rebuildRecommendationProfileAction,
  updateRecommendations,
  rotateRecommendationRole,
  startPlayingFromRecommendation,
  saveTuneState,
  clearTuneState,
  saveRecommendationPreset,
  listRecommendationPresets,
  deleteRecommendationPreset,
  listKnownGenreTagValues,
  resetKnownGenreTagValuesCache,
  loadRecommendationPreset,
  saveTasteSetup,
} from "./recommendations";

const transaction = vi.fn();
const runCreate = vi.fn();
const runDeleteMany = vi.fn();
const runUpdate = vi.fn();
const runFindUnique = vi.fn();
const itemUpdateMany = vi.fn();
const itemFindFirst = vi.fn();
const eventFindMany = vi.fn();
const gameFindUnique = vi.fn();
const wishlistFindUnique = vi.fn();
const libraryFindFirst = vi.fn();
const gameFindMany = vi.fn();
const wishlistFindMany = vi.fn();
const feedbackCreate = vi.fn();
const feedbackGroupBy = vi.fn();
const eventCreate = vi.fn();
const eventCreateMany = vi.fn();
const eventDeleteMany = vi.fn();
const feedbackDeleteMany = vi.fn();
const preferenceUpsert = vi.fn();
const preferenceDeleteMany = vi.fn();
const preferenceFindMany = vi.fn();
const profileDeleteMany = vi.fn();
const presetDeleteMany = vi.fn();
const tuneStateDeleteMany = vi.fn();
const tuneStateFindUnique = vi.fn();
const tuneStateUpsert = vi.fn();
const presetUpsert = vi.fn();
const presetFindMany = vi.fn();
const presetFindUnique = vi.fn();
const presetDeleteManyDirect = vi.fn();
const libraryEntryUpdate = vi.fn();

let recentExposureEvents: Array<{ gameId: string | null; wishlistEntryId: string | null; createdAt: Date }> = [];

const EMPTY_DIMENSIONS = {
  GENRE: {},
  TAG: {},
  EXPERIENCE: {},
  DURATION: {},
  PUBLISHER: {},
  ERA: {},
  SERIES: {},
  ENVIRONMENT: {},
  MATURITY: {},
};

function txFactory() {
  return {
    recommendationRun: { create: runCreate, deleteMany: runDeleteMany },
    recommendationFeedback: { create: feedbackCreate, groupBy: feedbackGroupBy, deleteMany: feedbackDeleteMany },
    recommendationEvent: { create: eventCreate, createMany: eventCreateMany, deleteMany: eventDeleteMany, findMany: eventFindMany },
    recommendationProfile: { upsert: vi.fn(), deleteMany: profileDeleteMany },
    recommendationPreference: { upsert: preferenceUpsert, deleteMany: preferenceDeleteMany, findMany: preferenceFindMany },
    recommendationPreset: { deleteMany: presetDeleteMany },
    recommendationTuneState: { deleteMany: tuneStateDeleteMany, findUnique: tuneStateFindUnique },
    game: { findMany: gameFindMany },
    libraryEntry: { update: libraryEntryUpdate },
    wishlistEntry: { findMany: wishlistFindMany },
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({} as never);
  await resetKnownGenreTagValuesCache();
transaction.mockImplementation(async (callback: (tx: ReturnType<typeof txFactory>) => unknown) =>
      callback(txFactory()),
    );
    const prismaMock = prisma as unknown as Record<string, unknown>;
    prismaMock.$transaction = transaction;
    prismaMock.recommendationFeedback = { create: feedbackCreate, groupBy: feedbackGroupBy };
    prismaMock.recommendationEvent = { create: eventCreate, createMany: eventCreateMany, deleteMany: eventDeleteMany, findMany: eventFindMany };
    prismaMock.recommendationPreference = { upsert: preferenceUpsert, deleteMany: preferenceDeleteMany };
    prismaMock.recommendationRun = { create: runCreate, update: runUpdate, findUnique: runFindUnique, deleteMany: runDeleteMany };
    prismaMock.recommendationTuneState = { upsert: tuneStateUpsert };
    prismaMock.recommendationPreset = { upsert: presetUpsert, findMany: presetFindMany, findUnique: presetFindUnique, deleteMany: presetDeleteManyDirect };
    prismaMock.recommendationItem = { findFirst: itemFindFirst, updateMany: itemUpdateMany };
    prismaMock.libraryEntry = { findFirst: libraryFindFirst, update: libraryEntryUpdate };
    prismaMock.game = { findMany: gameFindMany, findUnique: gameFindUnique };
    prismaMock.wishlistEntry = { findMany: wishlistFindMany, findUnique: wishlistFindUnique };
  runDeleteMany.mockResolvedValue({ count: 2 });
  runCreate.mockImplementation(async ({ data }: { data: { kind: string } }) => ({
    id: data.kind === "PLAY_NEXT" ? "run-play" : "run-buy",
  }));
  runUpdate.mockResolvedValue({ id: "run-1" });
  runFindUnique.mockResolvedValue(null);
  itemUpdateMany.mockResolvedValue({ count: 1 });
  itemFindFirst.mockResolvedValue(null);
  eventFindMany.mockResolvedValue([]);
  gameFindUnique.mockResolvedValue(null);
  wishlistFindUnique.mockResolvedValue(null);
  libraryFindFirst.mockResolvedValue(null);
  vi.mocked(updatePlayState).mockResolvedValue({
    success: true,
    data: {},
    error: null,
  } as never);
  feedbackCreate.mockResolvedValue({ id: "feedback-1" });
  feedbackGroupBy.mockResolvedValue([]);
  eventCreateMany.mockResolvedValue({ count: 0 });
  eventDeleteMany.mockResolvedValue({ count: 0 });
  vi.mocked(rebuildRecommendationProfile).mockResolvedValue({
    windowEnd: "2026-01-01T00:00:00.000Z",
    evidence: { eventsConsidered: 0 },
    dimensions: EMPTY_DIMENSIONS,
  } as never);
  feedbackDeleteMany.mockResolvedValue({ count: 0 });
  preferenceUpsert.mockResolvedValue({ id: "pref-1" });
  preferenceDeleteMany.mockResolvedValue({ count: 0 });
  preferenceFindMany.mockResolvedValue([]);
  profileDeleteMany.mockResolvedValue({ count: 0 });
  presetDeleteMany.mockResolvedValue({ count: 0 });
  tuneStateDeleteMany.mockResolvedValue({ count: 0 });
  tuneStateFindUnique.mockResolvedValue(null);
  tuneStateUpsert.mockResolvedValue({ id: 1 });
  presetUpsert.mockResolvedValue({ id: "preset-1" });
  presetFindMany.mockResolvedValue([]);
  presetFindUnique.mockResolvedValue(null);
  presetDeleteManyDirect.mockResolvedValue({ count: 1 });
  libraryEntryUpdate.mockResolvedValue({});
  gameFindMany.mockResolvedValue([]);
  wishlistFindMany.mockResolvedValue([]);
  recentExposureEvents = [];
  eventFindMany.mockImplementation(async ({ where }: { where?: { createdAt?: { gte?: Date } } }) =>
    recentExposureEvents.filter((event) => !where?.createdAt?.gte || event.createdAt.getTime() >= where.createdAt!.gte!.getTime()),
  );
});

describe("recommendation preferences", () => {
  it("validates and upserts a preference", async () => {
    const result = await setRecommendationPreference({ dimension: "GENRE", value: " RPG ", attitude: "PREFER" });
    expect(result.success).toBe(true);
    expect(preferenceUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dimension_value: { dimension: "GENRE", value: "RPG" } },
      update: { attitude: "PREFER" },
    }));
  });

  it("rejects invalid input and removes idempotently", async () => {
    expect((await setRecommendationPreference({ dimension: "NOPE" })).success).toBe(false);
    expect(await removeRecommendationPreference({ id: "pref-1" })).toMatchObject({ success: true });
    expect(await rebuildRecommendationProfileAction()).toMatchObject({ success: true });
  });
});

describe("recommendation tune and preset actions", () => {
  const tune = {
    experience: "COUCH_GAMING" as const,
    length: null,
    genres: ["Puzzle"],
    tags: ["Co-op"],
    sequelPosture: null,
    era: null,
    maturity: null,
  };

  it("saves and clears tune state per engine", async () => {
    await saveTuneState({ engine: "PLAY_NEXT", tune });
    expect(tuneStateUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      update: { playTune: tune },
    }));
    await clearTuneState({ engine: "BUY" });
    expect(tuneStateUpsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 1 },
      update: { buyTune: null },
    }));
  });

  it("upserts, lists, and deletes presets and rejects invalid inputs", async () => {
    await saveRecommendationPreset({ name: "  Couch nights ", tune });
    expect(presetUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { name: "Couch nights" },
      update: { tune },
    }));
    expect(await listRecommendationPresets()).toMatchObject({ success: true, data: [] });
    expect(await deleteRecommendationPreset({ id: "preset-1" })).toMatchObject({ success: true });
    expect((await saveTuneState({ engine: "PLAY_NEXT", tune: { ...tune, unknown: true } })).success).toBe(false);
    expect((await saveRecommendationPreset({ name: "", tune })).success).toBe(false);
  });

  it("loads a valid preset into the selected engine", async () => {
    presetFindUnique.mockResolvedValue({ id: "preset-1", tune });
    await expect(loadRecommendationPreset({ id: "preset-1", engine: "BUY" })).resolves.toMatchObject({ success: true });
    expect(tuneStateUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: { buyTune: tune } }));
  });

  it("returns distinct sorted RAWG genre and tag values from catalog and wishlist", async () => {
    gameFindMany.mockResolvedValue([
      { metadataSnapshots: [{ payload: { title: "A", genres: ["RPG", "Puzzle"], tags: ["Story"] } }] },
      { metadataSnapshots: [{ payload: { title: "B", genres: ["RPG"], tags: ["Co-op"] } }] },
    ]);
    wishlistFindMany.mockResolvedValue([
      { metadataSnapshot: { payload: { title: "C", genres: ["Action"], tags: ["Story"] } } },
    ]);

    await expect(listKnownGenreTagValues()).resolves.toEqual({
      success: true,
      data: { genres: ["Action", "Puzzle", "RPG"], tags: ["Co-op", "Story"] },
      error: null,
    });
  });

  it("uses the cached values until the TTL expires", async () => {
    gameFindMany.mockResolvedValue([{ metadataSnapshots: [{ payload: { genres: ["RPG"], tags: [] } }] }]);
    wishlistFindMany.mockResolvedValue([]);

    await listKnownGenreTagValues();
    await listKnownGenreTagValues();

    expect(gameFindMany).toHaveBeenCalledTimes(1);
    expect(wishlistFindMany).toHaveBeenCalledTimes(1);
  });

  it("refetches values after the TTL expires", async () => {
    vi.useFakeTimers();
    try {
      gameFindMany.mockResolvedValue([{ metadataSnapshots: [{ payload: { genres: ["RPG"], tags: [] } }] }]);
      wishlistFindMany.mockResolvedValue([]);

      await listKnownGenreTagValues();
      vi.advanceTimersByTime(10 * 60 * 1000);
      await listKnownGenreTagValues();

      expect(gameFindMany).toHaveBeenCalledTimes(2);
      expect(wishlistFindMany).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not cache failures", async () => {
    gameFindMany.mockRejectedValueOnce(new Error("catalog unavailable"));
    wishlistFindMany.mockResolvedValue([]);

    await expect(listKnownGenreTagValues()).resolves.toMatchObject({
      success: false,
      data: null,
      error: "catalog unavailable",
    });

    gameFindMany.mockResolvedValue([{ metadataSnapshots: [] }]);
    await expect(listKnownGenreTagValues()).resolves.toMatchObject({
      success: true,
      data: { genres: [], tags: [] },
      error: null,
    });
    expect(gameFindMany).toHaveBeenCalledTimes(2);
  });
});

describe("saveTasteSetup", () => {
  const ownedRows = [
    {
      id: "game-played",
      name: "Played game",
      type: "BASE_GAME",
      libraryEntry: { playState: "NOT_STARTED", interest: null, hidden: false, isMainGame: false },
    },
    {
      id: "game-liked",
      name: "Liked game",
      type: "BASE_GAME",
      libraryEntry: { playState: "NOT_STARTED", interest: null, hidden: false, isMainGame: false },
    },
    {
      id: "game-skipped",
      name: "Skipped game",
      type: "BASE_GAME",
      libraryEntry: { playState: "NOT_STARTED", interest: null, hidden: false, isMainGame: false },
    },
  ];

  it("seeds answered picks, records all answers, and rebuilds the profile", async () => {
    gameFindMany.mockResolvedValue(ownedRows);

    const result = await saveTasteSetup({
      picks: [
        { gameId: "game-played", answer: "PLAYED" },
        { gameId: "game-liked", answer: "LIKED" },
        { gameId: "game-skipped", answer: "SKIPPED" },
      ],
      experience: "COUCH_GAMING",
      environment: "STEAM_DECK",
    });

    expect(result.success).toBe(true);
    expect(libraryEntryUpdate).toHaveBeenNthCalledWith(1, {
      where: { gameId: "game-played" },
      data: { playState: "PLAYED_BEFORE", gameExperience: "COUCH_GAMING", preferredEnvironment: "STEAM_DECK" },
    });
    expect(libraryEntryUpdate).toHaveBeenNthCalledWith(2, {
      where: { gameId: "game-liked" },
      data: { interest: 5, gameExperience: "COUCH_GAMING", preferredEnvironment: "STEAM_DECK" },
    });
    expect(libraryEntryUpdate).toHaveBeenCalledTimes(2);
    expect(logRecommendationEvent).toHaveBeenCalledTimes(3);
    expect(logRecommendationEvent).toHaveBeenNthCalledWith(3, expect.anything(), {
      kind: "TASTE_SETUP_ANSWER",
      gameId: "game-skipped",
      payload: { answer: "SKIPPED" },
    });
    expect(rebuildRecommendationProfile).toHaveBeenCalledWith(expect.objectContaining({ game: expect.anything() }), expect.any(Date));
    expect(result.data?.picks).toEqual([
      { gameId: "game-played", name: "Played game", answer: "PLAYED", seeded: true },
      { gameId: "game-liked", name: "Liked game", answer: "LIKED", seeded: true },
      { gameId: "game-skipped", name: "Skipped game", answer: "SKIPPED", seeded: false },
    ]);
  });

  it("guards existing play state and interest while still seeding personal fields", async () => {
    gameFindMany.mockResolvedValue([
      { id: "in-progress", name: "In progress", type: "BASE_GAME", libraryEntry: { playState: "IN_PROGRESS", interest: null, hidden: false, isMainGame: false } },
      { id: "already-liked", name: "Already liked", type: "BASE_GAME", libraryEntry: { playState: "NOT_STARTED", interest: 3, hidden: false, isMainGame: false } },
    ]);

    await saveTasteSetup({
      picks: [{ gameId: "in-progress", answer: "PLAYED" }, { gameId: "already-liked", answer: "LIKED" }],
      experience: "PC_GAMING",
      environment: "BAZZITE",
    });

    expect(libraryEntryUpdate).toHaveBeenNthCalledWith(1, {
      where: { gameId: "in-progress" },
      data: { gameExperience: "PC_GAMING", preferredEnvironment: "BAZZITE" },
    });
    expect(libraryEntryUpdate).toHaveBeenNthCalledWith(2, {
      where: { gameId: "already-liked" },
      data: { gameExperience: "PC_GAMING", preferredEnvironment: "BAZZITE" },
    });
  });

  it("rejects malformed, duplicate, unowned, and unanswerable picks", async () => {
    expect((await saveTasteSetup({ picks: [{ gameId: "game-1", answer: "LIKED" }, { gameId: "game-1", answer: "PLAYED" }] })).success).toBe(false);
    expect((await saveTasteSetup({ picks: [{ gameId: "game-1" }] })).success).toBe(false);
    gameFindMany.mockResolvedValue([]);
    expect((await saveTasteSetup({ picks: [{ gameId: "missing", answer: "LIKED" }] })).success).toBe(false);
    gameFindMany.mockResolvedValue([{ id: "dlc-1", name: "DLC", type: "DLC", libraryEntry: { playState: "NOT_STARTED", interest: null, hidden: false, isMainGame: false } }]);
    expect((await saveTasteSetup({ picks: [{ gameId: "dlc-1", answer: "LIKED" }] })).success).toBe(false);
    expect(libraryEntryUpdate).not.toHaveBeenCalled();
  });

  it("propagates transaction failure without rebuilding the profile", async () => {
    gameFindMany.mockResolvedValue([ownedRows[0]]);
    vi.mocked(logRecommendationEvent).mockRejectedValueOnce(new Error("event unavailable"));

    const result = await saveTasteSetup({ picks: [{ gameId: "game-played", answer: "PLAYED" }] });

    expect(result).toMatchObject({ success: false, data: null, error: "event unavailable" });
    expect(rebuildRecommendationProfile).not.toHaveBeenCalled();
  });
});

interface CandidateRowShape {
  id: string;
  name: string;
  type: "BASE_GAME";
  libraryEntry: {
    playState: "NOT_STARTED" | "IN_PROGRESS" | "PLAYED_BEFORE" | "ABANDONED";
    priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
    interest: number | null;
    playSoon: boolean;
    replayCandidate: boolean;
    hidden: boolean;
    isMainGame: boolean;
    gameExperience?: "PC_GAMING" | "MULTIPLAYER_COOP" | "COUCH_GAMING" | "ON_THE_GO" | null;
    preferredEnvironment?: "BAZZITE" | "STEAM_DECK" | "WINDOWS" | null;
  };
  externalIds: { externalId: string }[];
  availability: {
    source: "STEAM" | "OTHER_PLATFORM" | "ROM";
    alternativeSourceId?: string | null;
    alternativeSource?: { name: string } | null;
    steamLastPlayed?: Date | null;
  }[];
  compatSnapshots: { provider: string; result: unknown; fetchedAt: Date }[];
  metadataSnapshots: { payload: unknown }[];
  envCompat: { environment: "BAZZITE" | "STEAM_DECK" | "WINDOWS"; status: "READY" | "READY_WITH_TINKERING" | "FALLBACK_RECOMMENDED" | "REQUIRED" | "UNKNOWN" }[];
}

function libraryEntry(
  overrides: Partial<CandidateRowShape["libraryEntry"]> = {},
): CandidateRowShape["libraryEntry"] {
  return {
    playState: "NOT_STARTED",
    priority: "NONE",
    interest: null,
    playSoon: false,
    replayCandidate: false,
    hidden: false,
    isMainGame: false,
    ...overrides,
  };
}

function baseRow(): CandidateRowShape {
  return {
    id: "game-1",
    name: "Portal 2",
    type: "BASE_GAME",
    libraryEntry: libraryEntry(),
    externalIds: [{ externalId: "620" }],
    availability: [{ source: "STEAM" }],
    metadataSnapshots: [],
    envCompat: [],
    compatSnapshots: [
      {
        provider: "PROTONDB",
        result: { status: "READY", tier: "gold", confidence: "strong" },
        fetchedAt: new Date("2026-08-01T00:00:00.000Z"),
      },
      {
        provider: "ARE_WE_ANTICHEAT_YET",
        result: { status: "Denied", anticheats: ["Easy Anti-Cheat"] },
        fetchedAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ],
  };
}

interface BuyRowShape {
  id: string;
  name: string;
  type: "BASE_GAME" | "DLC";
  interest: number | null;
  targetPriceMxn: string | null;
  updatedAt: Date;
  baseGameId: string | null;
  offers: Array<{
    price: string | null;
    currency: string;
    discount: number | null;
    historicalLow: string | null;
    sourceHistoricalLow: string | null;
    expiresAt: Date | null;
    fetchedAt: Date;
    itadFlag: string | null;
  }>;
}

function buyOffer(overrides: Partial<BuyRowShape["offers"][number]> = {}): BuyRowShape["offers"][number] {
  return {
    price: "299.00",
    currency: "MXN",
    discount: null,
    historicalLow: null,
    sourceHistoricalLow: null,
    expiresAt: null,
    fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    itadFlag: null,
    ...overrides,
  };
}

function buyRow(overrides: Partial<BuyRowShape> = {}): BuyRowShape {
  return {
    id: "wish-1",
    name: "Portal 2",
    type: "BASE_GAME",
    interest: 2,
    targetPriceMxn: null,
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    baseGameId: null,
    offers: [buyOffer()],
    ...overrides,
  };
}

function emptyTuneForAction() {
  return {
    experience: null,
    length: null,
    genres: [],
    tags: [],
    sequelPosture: null,
    era: null,
    maturity: null,
  };
}

describe("updateRecommendations", () => {
  it("requires authentication before touching the database", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await updateRecommendations();

    expect(result).toEqual({ success: false, data: null, error: "Unauthorized" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("applies tune points before cold-start selection and records the tune context", async () => {
    tuneStateFindUnique.mockResolvedValue({
      playTune: { experience: null, length: null, genres: ["RPG"], tags: [], sequelPosture: null, era: null, maturity: null },
      buyTune: null,
    });
    gameFindMany.mockResolvedValue([
      { ...baseRow(), id: "game-aaa", name: "Aaa", metadataSnapshots: [{ payload: { title: "Aaa", genres: ["Puzzle"] } }] },
      { ...baseRow(), id: "game-zzz", name: "Zzz", metadataSnapshots: [{ payload: { title: "Zzz", genres: ["RPG"] } }] },
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const playCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT",
    )!;
    const items = (playCall[0] as {
      data: {
        items: {
          create: Array<{
            game: { connect: { id: string } };
            score: number;
            positive: Array<{ factor: string; points: number }>;
            caveats: Array<{ factor: string; label: string }>;
          }>;
        };
      };
    }).data.items.create;
    expect(items[0].game.connect.id).toBe("game-zzz");
    expect(items[0].positive).toContainEqual(expect.objectContaining({ factor: "tune_match", points: 5 }));
    expect(items.find((item) => item.game.connect.id === "game-aaa")?.caveats).toContainEqual({
      factor: "tune_thin_pool",
      label: "Only 1 candidates match your tune",
    });
    expect((playCall[0] as { data: { context: { tune: unknown } } }).data.context.tune).toEqual({
      play: { experience: null, length: null, genres: ["RPG"], tags: [], sequelPosture: null, era: null, maturity: null },
      buy: null,
      thinPool: true,
    });
  });

  it("boosts source-matching play items while leaving buy scoring untouched", async () => {
    const sourceTune = {
      steam: true,
      rom: false,
      allAlternatives: false,
      alternativeSourceIds: [],
    };
    tuneStateFindUnique.mockResolvedValue({
      playTune: { ...emptyTuneForAction(), sourceTune },
      buyTune: { ...emptyTuneForAction(), sourceTune },
    });
    gameFindMany.mockResolvedValue([baseRow()]);
    wishlistFindMany.mockResolvedValue([buyRow()]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const playCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT")!;
    const buyCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "BUY")!;
    expect(playCall[0].data.items.create[0].positive).toContainEqual(expect.objectContaining({ factor: "source_tune", points: 3 }));
    expect(buyCall[0].data.items.create[0].positive).not.toContainEqual(expect.objectContaining({ factor: "source_tune" }));
    expect((buyCall[0] as { data: { context: { tune: { buy: unknown } } } }).data.context.tune.buy).toEqual({ ...emptyTuneForAction(), sourceTune });
  });

  it("demotes an abandoned replay candidate to out-of-the-box when a primary exists", async () => {
    gameFindMany.mockResolvedValue([
      { ...baseRow(), id: "primary", name: "Primary", libraryEntry: libraryEntry({ interest: 5 }) },
      { ...baseRow(), id: "second-chance", name: "Second chance", libraryEntry: libraryEntry({ playState: "ABANDONED", replayCandidate: true, interest: 5 }) },
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const playCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT")!;
    const secondChance = playCall[0].data.items.create.find((item: { game: { connect: { id: string } } }) => item.game.connect.id === "second-chance");
    expect(secondChance).toMatchObject({ role: "OUT_OF_THE_BOX" });
    expect(secondChance.caveats).toContainEqual({ factor: "second_chance", label: "Second chance: previously abandoned, flagged for replay" });
  });

  it("calibrates play and buy interest from grouped, kind-specific feedback", async () => {
    gameFindMany.mockResolvedValue([{ ...baseRow(), libraryEntry: libraryEntry({ interest: 5 }) }]);
    wishlistFindMany.mockResolvedValue([buyRow({ interest: 5 })]);
    feedbackGroupBy.mockResolvedValue([
      { kind: "PLAY_NEXT", gameId: "game-1", wishlistEntryId: null, _count: { _all: 3 } },
      { kind: "BUY", gameId: null, wishlistEntryId: "wish-1", _count: { _all: 6 } },
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const playCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT")!;
    const buyCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "BUY")!;
    expect(playCall[0].data.items.create[0]).toMatchObject({ score: 40, negative: [{ factor: "calibration", label: "Dismissed 3 times", points: -10 }] });
    expect(playCall[0].data.items.create[0].positive).toContainEqual({ factor: "interest", label: "Interest 4", points: 40 });
    expect(buyCall[0].data.items.create[0]).toMatchObject({ score: 30, negative: [{ factor: "calibration", label: "Dismissed 6 times", points: -20 }] });
    expect(buyCall[0].data.items.create[0].positive).toContainEqual({ factor: "interest", label: "Interest 3", points: 30 });
    expect(feedbackGroupBy).toHaveBeenCalledTimes(1);
  });

  it("clamps calibrated play interest at zero and leaves null buy interest untouched", async () => {
    gameFindMany.mockResolvedValue([{ ...baseRow(), libraryEntry: libraryEntry({ interest: 2 }) }]);
    wishlistFindMany.mockResolvedValue([buyRow({ interest: null })]);
    feedbackGroupBy.mockResolvedValue([
      { kind: "PLAY_NEXT", gameId: "game-1", wishlistEntryId: null, _count: { _all: 99 } },
      { kind: "BUY", gameId: null, wishlistEntryId: "wish-1", _count: { _all: 3 } },
    ]);

    await updateRecommendations();

    const playCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT")!;
    const buyCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "BUY")!;
    expect(playCall[0].data.items.create[0].positive).not.toContainEqual(expect.objectContaining({ factor: "interest" }));
    expect(playCall[0].data.items.create[0].negative).toContainEqual({ factor: "calibration", label: "Dismissed 99 times", points: -20 });
    expect(buyCall[0].data.items.create[0].positive).not.toContainEqual(expect.objectContaining({ factor: "interest" }));
    expect(buyCall[0].data.items.create[0].negative).not.toContainEqual(expect.objectContaining({ factor: "calibration" }));
  });

  it("filters recent exposures from both cold-start pools and records per-run counts", async () => {
    const rows: CandidateRowShape[] = [];
    for (let index = 1; index <= 5; index += 1) {
      rows.push({
        ...baseRow(),
        id: `game-${index}`,
        name: `Game ${index}`,
        libraryEntry: libraryEntry({ interest: index }),
      });
    }
    gameFindMany
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([]);
    wishlistFindMany.mockResolvedValue([
      buyRow({ id: "wish-1", interest: 5 }),
      buyRow({ id: "wish-2", interest: 4 }),
      buyRow({ id: "wish-3", interest: 3 }),
      buyRow({ id: "wish-4", interest: 2 }),
    ]);
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000);
    eventFindMany.mockResolvedValue([
      { gameId: "game-1", wishlistEntryId: null, createdAt: recent },
      { gameId: null, wishlistEntryId: "wish-1", createdAt: recent },
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const playCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT")!;
    const buyCall = runCreate.mock.calls.find((call) => (call[0] as { data: { kind: string } }).data.kind === "BUY")!;
    expect(playCall[0].data.items.create.map((item: { game: { connect: { id: string } } }) => item.game.connect.id)).not.toContain("game-1");
    expect(buyCall[0].data.items.create.map((item: { wishlistEntry: { connect: { id: string } } }) => item.wishlistEntry.connect.id)).not.toContain("wish-1");
    expect(playCall[0].data.context).toMatchObject({ staleExcluded: 1, rerank: { mode: "COLD_START" } });
    expect(buyCall[0].data.context).toMatchObject({ staleExcluded: 1, rerank: { mode: "COLD_START" } });
    expect(eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ kind: { in: ["EXPOSURE", "ROTATION"] } }),
    }));
  });

  it("creates both runs in one transaction with four cold-start play items and full explanations", async () => {
    const rows: CandidateRowShape[] = [
      { ...baseRow(), libraryEntry: libraryEntry({ interest: 5 }) },
    ];
    for (let index = 1; index <= 4; index += 1) {
      rows.push({
        ...baseRow(),
        id: `game-${index}`,
        name: `Game ${index}`,
        libraryEntry: libraryEntry({ interest: index }),
      });
    }
    gameFindMany.mockResolvedValue(rows);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      playNextItems: 4,
      playNextEligible: 5,
      prunedRuns: 2,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(runCreate).toHaveBeenCalledTimes(2);

    const playNextCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT",
    )!;
    const items = playNextCall[0].data.items.create;
    expect(items).toHaveLength(4);
    expect(items.map((item: { rank: number }) => item.rank)).toEqual([1, 2, 3, 4]);
    expect(items.map((item: { role: string }) => item.role)).toEqual([
      "BEST_FIT_1",
      "BEST_FIT_2",
      "OUT_OF_THE_BOX",
      "CHANGE_OF_PACE",
    ]);
    expect(items[0]).toMatchObject({
      game: { connect: { id: "game-1" } },
      score: 50,
    });
    expect(items[0].positive).toEqual([
      { factor: "interest", label: "Interest 5", points: 50 },
      { factor: "compat_bazzite", label: "Runs well on Bazzite", points: 0 },
    ]);
    expect(items[0].caveats).toEqual([
      { factor: "anticheat", label: "Anti-cheat blocks Linux" },
      { factor: "limited_basis", label: "Cold start: limited history, showing a varied mix" },
    ]);
  });

  it("writes the locked context JSON with buy counts and empty-BUY fallback", async () => {
    gameFindMany.mockResolvedValue([baseRow()]);

    const result = await updateRecommendations();

    for (const call of runCreate.mock.calls as Array<[{ data: { context: unknown; kind: string; items?: { create: unknown[] } } }]>) {
      expect(call[0].data.context).toMatchObject({
        eligible: { playNext: 1, buy: 0 },
        prunedRuns: 2,
        prunedEvents: 0,
        profile: expect.objectContaining({ eventsConsidered: 0 }),
        rerank: { mode: "COLD_START", applied: { taste: 0, steam: 0, environment: 0, quality: 0 } },
        roles: {
          batches: {
            BEST_FIT_1: [],
            BEST_FIT_2: [],
            CHANGE_OF_PACE: [],
            DEAL: [],
            OUT_OF_THE_BOX: [],
          },
        },
      });
      if (call[0].data.kind === "BUY") {
        expect(call[0].data.context).toMatchObject({
          roles: { saturation: { saturated: false, fresh80Count: 0, eligibleCount: 0 } },
        });
      }
      if (call[0].data.kind === "BUY") {
        expect(call[0].data.items?.create).toEqual([]);
      }
    }
    expect(result.data).toMatchObject({ buyItems: 0, buyEligible: 0 });
    expect(rebuildRecommendationProfile).toHaveBeenCalledTimes(1);
  });

  it("persists buy roles and additive role context for a three-item run", async () => {
    gameFindMany
      .mockResolvedValueOnce([baseRow()])
      .mockResolvedValueOnce([]);
    wishlistFindMany.mockResolvedValue([
      buyRow({ id: "wish-1", interest: 5 }),
      buyRow({ id: "wish-2", interest: 4 }),
      buyRow({ id: "wish-3", interest: 2, offers: [buyOffer({ discount: 50 })] }),
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const buyCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "BUY",
    )!;
    const items = buyCall[0].data.items.create;
    expect(items).toHaveLength(3);
    expect(items.map((item: { role: string }) => item.role)).toEqual([
      "BEST_FIT_1",
      "BEST_FIT_2",
      "DEAL",
    ]);
    expect(buyCall[0].data.context).toMatchObject({
      eligible: { playNext: 1, buy: 3 },
      roles: {
        batches: expect.objectContaining({ DEAL: [] }),
        saturation: { saturated: false, fresh80Count: 0, eligibleCount: 3 },
      },
    });
  });

  it("persists BUY items with ranks, scores, factors, and caveats from persisted offers", async () => {
    wishlistFindMany.mockResolvedValue([
      {
        ...buyRow(),
        interest: 3,
        offers: [buyOffer({ discount: 50 })],
      },
      {
        ...buyRow(),
        id: "wish-2",
        name: "Expansion",
        type: "DLC" as const,
        baseGameId: "game-1",
        interest: null,
        targetPriceMxn: "350.00",
        updatedAt: new Date("2026-08-21T00:00:00.000Z"),
        offers: [buyOffer()],
      },
    ]);
    gameFindMany
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() =>
        Promise.resolve([
          {
            id: "game-1",
            availability: [{ source: "STEAM" }],
            libraryEntry: { rating: 5, playState: "PLAYED_BEFORE", replayCandidate: false },
          },
        ]),
      );

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ buyItems: 2, buyEligible: 2 });
    const buyCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "BUY",
    )!;
    const items = buyCall[0].data.items.create;
    expect(items.map((item: { rank: number }) => item.rank)).toEqual([1, 2]);
    expect(items[0]).toMatchObject({
      wishlistEntry: { connect: { id: "wish-1" } },
      score: 35,
    });
    expect(items[0].positive).toContainEqual({ factor: "offer_discount", label: "50% off", points: 5 });
    expect(items[1]).toMatchObject({
      wishlistEntry: { connect: { id: "wish-2" } },
      score: 8 + 6,
    });
    expect(items[1].positive).toContainEqual({ factor: "target_hit", label: "At or below target $350", points: 8 });
    expect(items[1].positive).toContainEqual({ factor: "dlc_affinity", label: "Owned base game you enjoyed", points: 6 });
  });

  it("prunes runs older than the 12-month cutoff only", async () => {
    const before = Date.now();
    gameFindMany.mockResolvedValue([baseRow()]);

    await updateRecommendations();

    const after = Date.now();
    expect(runDeleteMany).toHaveBeenCalledTimes(1);
    const call = runDeleteMany.mock.calls[0][0] as {
      where: { createdAt: { lt: Date } };
    };
    const expectedLow = before - RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expectedHigh = after - RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(call.where.createdAt.lt.getTime()).toBeGreaterThanOrEqual(expectedLow);
    expect(call.where.createdAt.lt.getTime()).toBeLessThanOrEqual(expectedHigh);
  });

  it("creates a successful empty run when nothing is eligible", async () => {
    gameFindMany.mockResolvedValue([
      { ...baseRow(), libraryEntry: libraryEntry({ playState: "IN_PROGRESS" }) },
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ playNextItems: 0, playNextEligible: 0 });
    const playNextCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT",
    )!;
    expect(playNextCall[0].data.items.create).toEqual([]);
  });

  it("writes scored snapshot batches into the play context and keeps role assignment unchanged", async () => {
    const rows: CandidateRowShape[] = [];
    for (let index = 1; index <= 6; index += 1) {
      rows.push({
        ...baseRow(),
        id: `game-${index}`,
        name: `Game ${index}`,
        libraryEntry: libraryEntry({ interest: index }),
      });
    }
    gameFindMany.mockResolvedValue(rows);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const playNextCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT",
    )!;
    const context = playNextCall[0].data.context as {
      roles: { batches: Record<string, Array<{ id: string; score: number; positive: unknown[]; negative: unknown[]; caveats: unknown[] }>> };
    };
    const snapshots = context.roles.batches.BEST_FIT_1;
    expect(snapshots).toHaveLength(2);
    for (const snapshot of snapshots) {
      expect(snapshot).toEqual(expect.objectContaining({
        id: expect.any(String),
        score: expect.any(Number),
        positive: expect.any(Array),
        negative: expect.any(Array),
        caveats: expect.any(Array),
      }));
    }
    expect(playNextCall[0].data.items.create.map((item: { role: string }) => item.role)).toEqual([
      "BEST_FIT_1",
      "BEST_FIT_2",
      "OUT_OF_THE_BOX",
      "CHANGE_OF_PACE",
    ]);
  });

  it("writes scored snapshot batches into the buy context with role assignment unchanged", async () => {
    gameFindMany
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve([]));
    wishlistFindMany.mockResolvedValue([
      buyRow({ id: "wish-1", interest: 5 }),
      buyRow({ id: "wish-2", interest: 4 }),
      buyRow({ id: "wish-3", interest: 3 }),
      buyRow({ id: "wish-4", interest: 2 }),
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ buyItems: 3, buyEligible: 4 });
    const buyCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "BUY",
    )!;
    const context = buyCall[0].data.context as {
      roles: { batches: Record<string, Array<{ id: string; score: number; positive: unknown[]; caveats: unknown[] }>> };
    };
    for (const snapshot of context.roles.batches.DEAL) {
      expect(snapshot).toEqual(expect.objectContaining({
        id: expect.any(String),
        score: expect.any(Number),
        positive: expect.any(Array),
        negative: expect.any(Array),
        caveats: expect.any(Array),
      }));
    }
    expect(buyCall[0].data.items.create.map((item: { role: string }) => item.role)).toEqual([
      "BEST_FIT_1",
      "BEST_FIT_2",
      "DEAL",
    ]);
  });
});

describe("dismissRecommendation", () => {
  it("inserts one log row with the given target and kind", async () => {
    const result = await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT" });

    expect(result.success).toBe(true);
    expect(feedbackCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { gameId: "game-1", wishlistEntryId: null, kind: "PLAY_NEXT" },
      }),
    );
  });

  it("logs a dismissal event with its reason and run", async () => {
    const result = await dismissRecommendation({
      gameId: "game-1",
      kind: "PLAY_NEXT",
      runId: "run-1",
      reason: "Already playing something else",
    });

    expect(result.success).toBe(true);
    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, {
      kind: "DISMISSAL",
      gameId: "game-1",
      wishlistEntryId: undefined,
      runId: "run-1",
      reason: "Already playing something else",
    });
  });

  it("keeps the dismissal successful when event logging fails", async () => {
    vi.mocked(logRecommendationEvent).mockRejectedValueOnce(new Error("event unavailable"));

    const result = await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT" });

    expect(result).toEqual({ success: true, data: { id: "feedback-1" }, error: null });
  });

  it("trims reasons and rejects reasons over 500 characters", async () => {
    await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT", reason: "  Not now  " });
    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, expect.objectContaining({ reason: "Not now" }));

    const invalid = await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT", reason: "x".repeat(501) });
    expect(invalid.success).toBe(false);
  });

  it("rejects input without exactly one target", async () => {
    const none = await dismissRecommendation({ kind: "PLAY_NEXT" });
    const both = await dismissRecommendation({
      gameId: "game-1",
      wishlistEntryId: "wish-1",
      kind: "PLAY_NEXT",
    });

    expect(none).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(both).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("rejects unknown kinds and extra fields", async () => {
    const badKind = await dismissRecommendation({ gameId: "game-1", kind: "MAYBE" });
    const extraField = await dismissRecommendation({ gameId: "game-1", note: "x", kind: "BUY" });

    expect(badKind.error).toBe("Invalid input");
    expect(extraField.error).toBe("Invalid input");
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("returns auth failures in the standard shape", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT" });

    expect(result).toEqual({ success: false, data: null, error: "Unauthorized" });
    expect(feedbackCreate).not.toHaveBeenCalled();
  });
});

describe("recordRunExposure", () => {
  it("creates one exposure event per valid item", async () => {
    eventCreateMany.mockResolvedValue({ count: 2 });

    const result = await recordRunExposure({
      runId: "run-1",
      items: [{ gameId: "game-1", role: "BEST_FIT_1" }, { wishlistEntryId: "wish-1" }],
    });

    expect(result).toEqual({ success: true, data: { count: 2 }, error: null });
    expect(eventCreateMany).toHaveBeenCalledWith({
      data: [
        {
          runId: "run-1",
          kind: "EXPOSURE",
          gameId: "game-1",
          wishlistEntryId: null,
          payload: { role: "BEST_FIT_1" },
        },
        { runId: "run-1", kind: "EXPOSURE", gameId: null, wishlistEntryId: "wish-1" },
      ],
    });
  });

  it("treats an empty item list as a no-op and rejects malformed targets", async () => {
    const empty = await recordRunExposure({ runId: "run-1", items: [] });
    const invalid = await recordRunExposure({ runId: "run-1", items: [{ gameId: "game-1", wishlistEntryId: "wish-1" }] });

    expect(empty).toEqual({ success: true, data: { count: 0 }, error: null });
    expect(invalid.success).toBe(false);
    expect(eventCreateMany).not.toHaveBeenCalled();
  });
});

describe("restartRecommendations", () => {
  it("deletes recommendation-owned tables and returns counts", async () => {
    const tx = txFactory();
    tx.recommendationEvent.deleteMany.mockResolvedValue({ count: 4 });
    tx.recommendationFeedback.deleteMany.mockResolvedValue({ count: 2 });
    tx.recommendationRun.deleteMany.mockResolvedValue({ count: 3 });
    tx.recommendationProfile.deleteMany.mockResolvedValue({ count: 1 });
    tx.recommendationPreference.deleteMany.mockResolvedValue({ count: 2 });
    tx.recommendationPreset.deleteMany.mockResolvedValue({ count: 5 });
    tx.recommendationTuneState.deleteMany.mockResolvedValue({ count: 1 });
    transaction.mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await restartRecommendations();

    expect(result).toEqual({
      success: true,
      data: { recommendationEvent: 4, recommendationFeedback: 2, recommendationRun: 3, recommendationProfile: 1, recommendationPreference: 2, recommendationPreset: 5, recommendationTuneState: 1 },
      error: null,
    });
    expect(tx.recommendationEvent.deleteMany).toHaveBeenCalledWith({});
    expect(tx.recommendationFeedback.deleteMany).toHaveBeenCalledWith({});
    expect(tx.recommendationRun.deleteMany).toHaveBeenCalledWith({});
    expect(tx.recommendationProfile.deleteMany).toHaveBeenCalledWith({});
    expect(tx.recommendationPreference.deleteMany).toHaveBeenCalledWith({});
    expect(tx.recommendationPreset.deleteMany).toHaveBeenCalledWith({});
    expect(tx.recommendationTuneState.deleteMany).toHaveBeenCalledWith({});
  });

  it("succeeds with zero counts when no recommendation data exists", async () => {
    runDeleteMany.mockResolvedValueOnce({ count: 0 });
    const result = await restartRecommendations();
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ recommendationEvent: 0, recommendationFeedback: 0, recommendationRun: 0, recommendationProfile: 0, recommendationPreference: 0, recommendationPreset: 0, recommendationTuneState: 0 });
  });
});

describe("updateRecommendations re-ranking", () => {
  it("re-ranks a tied pool by taste and quality and records the rerank context", async () => {
    vi.mocked(rebuildRecommendationProfile).mockResolvedValue({
      windowEnd: "2026-01-01T00:00:00.000Z",
      evidence: { eventsConsidered: 5 },
      dimensions: { ...EMPTY_DIMENSIONS, GENRE: { RPG: { weight: 9, support: 4, lastAt: "2026-01-01T00:00:00.000Z" } } },
    } as never);

    gameFindMany.mockResolvedValue([
      {
        ...baseRow(),
        id: "game-aaa",
        name: "Aaa",
        libraryEntry: libraryEntry({ interest: 4 }),
        metadataSnapshots: [{ payload: { title: "Aaa", genres: ["Puzzle"] } }],
      },
      {
        ...baseRow(),
        id: "game-zzz",
        name: "Zzz",
        libraryEntry: libraryEntry({ interest: 4 }),
        metadataSnapshots: [{ payload: { title: "Zzz", genres: ["RPG"], metacriticScore: 95 } }],
      },
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const playNextCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT",
    )!;
    const items = playNextCall[0].data.items.create;
    expect(items.map((item: { game: { connect: { id: string } } }) => item.game.connect.id)).toEqual(["game-zzz", "game-aaa"]);
    expect(items[0].score).toBe(45);
    expect(items[0].positive).toEqual(expect.arrayContaining([
      { factor: "taste_profile", label: "RPG affinity", points: 3 },
      { factor: "quality", label: "Metacritic 95", points: 2 },
    ]));
    expect(playNextCall[0].data.context).toMatchObject({
      rerank: { mode: "RERANKED", applied: { taste: 1, steam: 0, environment: 0, quality: 1 } },
    });
  });

  it("supplements a cold-start pool with steam recency but no taste or quality", async () => {
    gameFindMany.mockResolvedValue([
      {
        ...baseRow(),
        libraryEntry: libraryEntry({ interest: 2, playState: "ABANDONED", replayCandidate: true, preferredEnvironment: "BAZZITE" }),
        availability: [{ source: "STEAM", steamLastPlayed: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }],
        metadataSnapshots: [{ payload: { title: "Portal 2", genres: ["Puzzle"], metacriticScore: 95 } }],
        envCompat: [{ environment: "BAZZITE", status: "READY" }],
      },
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const playNextCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT",
    )!;
    const items = playNextCall[0].data.items.create;
    expect(items[0].score).toBe(20 + 2 + 2);
    expect(items[0].positive).toEqual(expect.arrayContaining([
      { factor: "steam_recent", label: "Played recently on Steam", points: 2 },
      { factor: "environment_fit", label: "Ready on your setup", points: 2 },
    ]));
    expect(items[0].caveats).toContainEqual({
      factor: "limited_basis",
      label: "Cold start: limited history, showing a varied mix",
    });
    expect(playNextCall[0].data.context).toMatchObject({
      rerank: { mode: "COLD_START", applied: { taste: 0, steam: 1, environment: 1, quality: 0 } },
    });
  });
});

describe("updateRecommendations buy re-ranking", () => {
  it("re-ranks buy items by taste and quality, keeping the tiebreak chain for equal adjusted scores", async () => {
    vi.mocked(rebuildRecommendationProfile).mockResolvedValue({
      windowEnd: "2026-01-01T00:00:00.000Z",
      evidence: { eventsConsidered: 5 },
      dimensions: { ...EMPTY_DIMENSIONS, GENRE: { RPG: { weight: 9, support: 4, lastAt: "2026-01-01T00:00:00.000Z" } } },
    } as never);

    wishlistFindMany.mockResolvedValue([
      {
        ...buyRow(),
        id: "wish-rpg",
        name: "RPG Wish",
        interest: 4,
        metadataSnapshot: { payload: { title: "RPG Wish", genres: ["RPG"], metacriticScore: 95 } },
      },
      {
        ...buyRow(),
        id: "wish-plain",
        name: "Plain Wish",
        interest: 4,
        updatedAt: new Date("2026-08-25T00:00:00.000Z"),
        metadataSnapshot: { payload: { title: "Plain Wish", genres: ["Puzzle"] } },
      },
    ]);
    gameFindMany
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve([]));

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const buyCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "BUY",
    )!;
    const items = buyCall[0].data.items.create;
    expect(items.map((item: { wishlistEntry: { connect: { id: string } } }) => item.wishlistEntry.connect.id)).toEqual(["wish-rpg", "wish-plain"]);
    expect(items[0].score).toBe(45);
    expect(items[0].positive).toEqual(expect.arrayContaining([
      { factor: "taste_profile", label: "RPG affinity", points: 3 },
      { factor: "quality", label: "Metacritic 95", points: 2 },
    ]));
    expect(buyCall[0].data.context).toMatchObject({
      rerank: { mode: "RERANKED", applied: { taste: 1, steam: 0, environment: 0, quality: 1 } },
    });
  });

  it("preserves the updatedAt tiebreak for equal adjusted scores under re-ranking", async () => {
    vi.mocked(rebuildRecommendationProfile).mockResolvedValue({
      windowEnd: "2026-01-01T00:00:00.000Z",
      evidence: { eventsConsidered: 5 },
      dimensions: { ...EMPTY_DIMENSIONS, GENRE: { RPG: { weight: 9, support: 4, lastAt: "2026-01-01T00:00:00.000Z" } } },
    } as never);

    wishlistFindMany.mockResolvedValue([
      {
        ...buyRow(),
        id: "wish-old",
        interest: 4,
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        metadataSnapshot: { payload: { title: "Old", genres: ["Puzzle"] } },
      },
      {
        ...buyRow(),
        id: "wish-new",
        interest: 4,
        updatedAt: new Date("2026-08-20T00:00:00.000Z"),
        metadataSnapshot: { payload: { title: "New", genres: ["Puzzle"] } },
      },
    ]);
    gameFindMany
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => Promise.resolve([]));

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const buyCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "BUY",
    )!;
    const items = buyCall[0].data.items.create;
    expect(items.map((item: { wishlistEntry: { connect: { id: string } } }) => item.wishlistEntry.connect.id)).toEqual(["wish-new", "wish-old"]);
    expect(buyCall[0].data.context).toMatchObject({ rerank: { mode: "RERANKED", applied: { taste: 0, quality: 0 } } });
  });

  it("resolves DLC taste through the DLC wish's own snapshot", async () => {
    vi.mocked(rebuildRecommendationProfile).mockResolvedValue({
      windowEnd: "2026-01-01T00:00:00.000Z",
      evidence: { eventsConsidered: 5 },
      dimensions: { ...EMPTY_DIMENSIONS, GENRE: { RPG: { weight: 9, support: 4, lastAt: "2026-01-01T00:00:00.000Z" } } },
    } as never);

    wishlistFindMany.mockResolvedValue([
      {
        ...buyRow(),
        id: "wish-2",
        name: "Expansion",
        type: "DLC" as const,
        baseGameId: "game-1",
        interest: null,
        targetPriceMxn: "350.00",
        updatedAt: new Date("2026-08-21T00:00:00.000Z"),
        metadataSnapshot: { payload: { title: "Expansion", genres: ["RPG"] } },
        offers: [buyOffer()],
      },
    ]);
    gameFindMany
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() =>
        Promise.resolve([
          {
            id: "game-1",
            availability: [{ source: "STEAM" }],
            libraryEntry: { rating: 5, playState: "PLAYED_BEFORE", replayCandidate: false },
          },
        ]),
      );

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    const buyCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "BUY",
    )!;
    const items = buyCall[0].data.items.create;
    expect(items[0].score).toBe(8 + 6 + 3);
    expect(items[0].positive).toContainEqual({ factor: "taste_profile", label: "RPG affinity", points: 3 });
  });
});

describe("rotateRecommendationRole", () => {
  function playRun(batches: Record<string, Array<{ id: string; score: number }>>) {
    runFindUnique.mockResolvedValue({
      id: "run-play",
      kind: "PLAY_NEXT",
      context: { roles: { batches } },
    });
  }

  const DAY = 24 * 60 * 60 * 1000;

  it("picks the first non-cooldown candidate in batch order and swaps the row in place", async () => {
    playRun({
      BEST_FIT_1: [
        { id: "game-a", score: 30 },
        { id: "game-b", score: 20 },
      ],
      BEST_FIT_2: [{ id: "game-a", score: 30 }],
      OUT_OF_THE_BOX: [],
      CHANGE_OF_PACE: [],
      DEAL: [],
    });
    itemFindFirst.mockResolvedValue({ id: "item-1", gameId: "game-1", wishlistEntryId: null });
    gameFindUnique.mockResolvedValue({ name: "Game B" });

    const result = await rotateRecommendationRole({ runId: "run-play", role: "BEST_FIT_1", itemId: "item-1" });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      rotated: true,
      item: { itemId: "item-1", role: "BEST_FIT_1", gameId: "game-a", name: "Game B", score: 30 },
    });
    expect(itemUpdateMany).toHaveBeenCalledWith({
      where: { id: "item-1", runId: "run-play", role: "BEST_FIT_1" },
      data: expect.objectContaining({ gameId: "game-a", wishlistEntryId: null, score: 30 }),
    });
  });

  it("removes the swapped-in candidate from every role batch in the persisted context", async () => {
    playRun({
      "BEST_FIT_1": [{ id: "game-a", score: 30 }, { id: "game-x", score: 10 }],
      "BEST_FIT_2": [{ id: "game-a", score: 30 }],
      "CHANGE_OF_PACE": [{ id: "game-a", score: 30 }, { id: "game-y", score: 5 }],
      "OUT_OF_THE_BOX": [],
      "DEAL": [],
    });
    itemFindFirst.mockResolvedValue({ id: "item-1", gameId: "game-z", wishlistEntryId: null });
    gameFindUnique.mockResolvedValue({ name: "Game A" });

    const result = await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-play", itemId: "item-1" });

    expect(result.success).toBe(true);
    const updateCall = runUpdate.mock.calls[0][0] as { where: { id: string }; data: { context: { roles: { batches: Record<string, Array<{ id: string }>> } } } };
    expect(updateCall.where.id).toBe("run-play");
    const batches = updateCall.data.context.roles.batches;
    for (const role of Object.keys(batches)) {
      expect(batches[role].map((candidate) => candidate.id)).not.toContain("game-a");
    }
  });

  it("emits ROTATION for the replaced item and EXPOSURE for the replacement", async () => {
    playRun({
      "BEST_FIT_1": [{ id: "game-a", score: 30 }, { id: "game-b", score: 20 }],
      "BEST_FIT_2": [], "OUT_OF_THE_BOX": [], "CHANGE_OF_PACE": [], "DEAL": [],
    });
    itemFindFirst.mockResolvedValue({ id: "item-1", gameId: "game-old", wishlistEntryId: null });
    gameFindUnique.mockResolvedValue({ name: "Game A" });

    await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-play", itemId: "item-1" });

    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, expect.objectContaining({
      kind: "ROTATION", runId: "run-play", gameId: "game-old", payload: { role: "BEST_FIT_1" },
    }));
    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, expect.objectContaining({
      kind: "EXPOSURE", runId: "run-play", gameId: "game-a", payload: { role: "BEST_FIT_1" },
    }));
  });

  it("still rotates when event writes fail without blocking the swap", async () => {
    playRun({ "BEST_FIT_1": [{ id: "game-b", score: 20 }], "BEST_FIT_2": [], "OUT_OF_THE_BOX": [], "CHANGE_OF_PACE": [], "DEAL": [] });
    itemFindFirst.mockResolvedValue({ id: "item-1", gameId: "game-old", wishlistEntryId: null });
    gameFindUnique.mockResolvedValue({ name: "Game B" });
    vi.mocked(logRecommendationEvent).mockRejectedValue(new Error("event unavailable"));

    const result = await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-play", itemId: "item-1" });

    expect(result.success).toBe(true);
    expect(result.data?.rotated).toBe(true);
    expect(itemUpdateMany).toHaveBeenCalled();
  });

  it("excludes a candidate exposed within the cooldown window and treats an old exposure as pickable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T00:00:00.000Z"));
    const now = Date.now();
    recentExposureEvents = [
      { gameId: "game-recent", wishlistEntryId: null, createdAt: new Date(now - 6 * DAY) },
      { gameId: "game-old", wishlistEntryId: null, createdAt: new Date(now - (7 * DAY + 60_000)) },
    ];
    playRun({
      "BEST_FIT_1": [{ id: "game-recent", score: 40 }, { id: "game-old", score: 10 }],
      "BEST_FIT_2": [], "OUT_OF_THE_BOX": [], "CHANGE_OF_PACE": [], "DEAL": [],
    });
    itemFindFirst.mockResolvedValue({ id: "item-1", gameId: "-1", wishlistEntryId: null });
    gameFindUnique.mockResolvedValue({ name: "Old" });

    const result = await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-play", itemId: "item-1" });

    expect(eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ createdAt: { gte: expect.any(Date) } }),
    }));
    const cutoff = (eventFindMany.mock.calls[0][0] as { where: { createdAt: { gte: Date } } }).where.createdAt.gte.getTime();
    expect(now - cutoff).toBe(EXPOSURE_COOLDOWN_DAYS * DAY);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ rotated: true, item: { gameId: "game-old" } });
    vi.useRealTimers();
  });

  it("returns rotated false without mutating when the role batch is drained by cooldown", async () => {
    playRun({
      "BEST_FIT_1": [{ id: "game-a", score: 30 }],
      "BEST_FIT_2": [], "OUT_OF_THE_BOX": [], "CHANGE_OF_PACE": [], "DEAL": [],
    });
    recentExposureEvents = [{ gameId: "game-a", wishlistEntryId: null, createdAt: new Date(Date.now() - 1 * DAY) }];
    itemFindFirst.mockResolvedValue({ id: "item-1", gameId: "game-a", wishlistEntryId: null });

    const result = await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-play", itemId: "item-1" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ rotated: false, item: null });
    expect(itemUpdateMany).not.toHaveBeenCalled();
    expect(runUpdate).not.toHaveBeenCalled();
    expect(logRecommendationEvent).not.toHaveBeenCalled();
  });

  it("returns { rotated: false } without mutating when the batch is empty", async () => {
    playRun({
      "BEST_FIT_1": [], "BEST_FIT_2": [], "OUT_OF_THE_BOX": [], "CHANGE_OF_PACE": [], "DEAL": [],
    });

    const result = await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-play", itemId: "item-1" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ rotated: false, item: null });
    expect(itemFindFirst).not.toHaveBeenCalled();
    expect(runUpdate).not.toHaveBeenCalled();
  });

  it("reports an optimistic-race error when the guarded update rows is zero", async () => {
    playRun({ "BEST_FIT_1": [{ id: "game-a", score: 30 }] });
    itemFindFirst.mockResolvedValue({ id: "item-1", gameId: "game-old", wishlistEntryId: null });
    itemUpdateMany.mockResolvedValueOnce({ count: 0 });

    const result = await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-play", itemId: "item-1" });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(runUpdate).not.toHaveBeenCalled();
    expect(logRecommendationEvent).not.toHaveBeenCalled();
  });

  it("rotates a buy role using the wishlist target column", async () => {
    runFindUnique.mockResolvedValue({
      id: "run-buy",
      kind: "BUY",
      context: {
        roles: {
          batches: {
            BEST_FIT_1: [{ id: "wish-a", score: 25 }, { id: "wish-b", score: 15 }],
            BEST_FIT_2: [], OUT_OF_THE_BOX: [], CHANGE_OF_PACE: [], DEAL: [],
          },
        },
      },
    });
    itemFindFirst.mockResolvedValue({ id: "item-9", gameId: null, wishlistEntryId: "wish-old" });
    wishlistFindUnique.mockResolvedValue({ name: "Wish A" });

    const result = await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-buy", itemId: "item-9" });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ rotated: true, item: { wishlistEntryId: "wish-a", name: "Wish A" } });
    expect(itemUpdateMany).toHaveBeenCalledWith({
      where: { id: "item-9", runId: "run-buy", role: "BEST_FIT_1" },
      data: expect.objectContaining({ gameId: null, wishlistEntryId: "wish-a", score: 25 }),
    });
    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, expect.objectContaining({
      kind: "ROTATION", wishlistEntryId: "wish-old",
    }));
  });

  it("supports legacy runs whose batches are bare ids instead of snapshots", async () => {
    playRun({
      "BEST_FIT_1": ["game-a", "game-b", "game-c"] as unknown as Array<{ id: string; score: number }>,
      "BEST_FIT_2": [], "OUT_OF_THE_BOX": [], "CHANGE_OF_PACE": [], "DEAL": [],
    });
    itemFindFirst.mockResolvedValue({ id: "item-1", gameId: "game-old", wishlistEntryId: null });
    gameFindUnique.mockResolvedValue({ name: "Game A" });

    const result = await rotateRecommendationRole({ role: "BEST_FIT_1", runId: "run-play", itemId: "item-1" });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ rotated: true, item: { gameId: "game-a" } });
    expect(itemUpdateMany).toHaveBeenCalled();
    expect(runUpdate).toHaveBeenCalled();
    const where = (itemUpdateMany.mock.calls[0][0] as { data: { gameId: string } }).data;
    expect(where.gameId).toBe("game-a");
  });

  it("rejects invalid role values and missing targets", async () => {
    expect(await rotateRecommendationRole({ runId: "run-1", role: "MAYBE", itemId: "i" })).toMatchObject({ success: false });
    expect(await rotateRecommendationRole({ role: "BEST_FIT_1", itemId: "i" })).toMatchObject({ success: false });
    expect(itemUpdateMany).not.toHaveBeenCalled();
  });
});

describe("startPlayingFromRecommendation", () => {
  it("no-ops when the entry is already in progress", async () => {
    libraryFindFirst.mockResolvedValue({ playState: "IN_PROGRESS" });

    const result = await startPlayingFromRecommendation({ gameId: "game-1" });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ started: true, needsMainDecision: false });
    expect(updatePlayState).not.toHaveBeenCalled();
  });

  it("returns needsMainDecision with the current in-progress game's name and leaves the entry untouched", async () => {
    libraryFindFirst
      .mockResolvedValueOnce({ playState: "NOT_STARTED" })
      .mockResolvedValueOnce({ game: { name: "Half-Life" } });

    const result = await startPlayingFromRecommendation({ gameId: "game-1" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ started: false, needsMainDecision: true, inProgressGame: "Half-Life" });
    expect(updatePlayState).not.toHaveBeenCalled();
  });

  it("clears the previous main when another game is in progress and makeMain is true", async () => {
    libraryFindFirst
      .mockResolvedValueOnce({ playState: "NOT_STARTED" })
      .mockResolvedValueOnce({ game: { name: "Half-Life" } });

    const result = await startPlayingFromRecommendation({ gameId: "game-1", makeMain: true });

    expect(result.success).toBe(true);
    expect(updatePlayState).toHaveBeenCalledWith("game-1", { playState: "IN_PROGRESS", isMainGame: true });
  });

  it("starts without a main when another game is in progress and makeMain is false", async () => {
    libraryFindFirst
      .mockResolvedValueOnce({ playState: "NOT_STARTED" })
      .mockResolvedValueOnce({ game: { name: "Half-Life" } });

    const result = await startPlayingFromRecommendation({ gameId: "game-1", makeMain: false });

    expect(result.success).toBe(true);
    expect(updatePlayState).toHaveBeenCalledWith("game-1", { playState: "IN_PROGRESS" });
  });

  it("becomes main automatically when nothing else is in progress, regardless of makeMain input", async () => {
    libraryFindFirst
      .mockResolvedValueOnce({ playState: "NOT_STARTED" })
      .mockResolvedValueOnce(null);

    const result = await startPlayingFromRecommendation({ gameId: "game-1" });

    expect(result.success).toBe(true);
    expect(updatePlayState).toHaveBeenCalledWith("game-1", { playState: "IN_PROGRESS", isMainGame: true });
  });

  it("fails clearly when the library entry is missing", async () => {
    libraryFindFirst.mockResolvedValue(null);

    const result = await startPlayingFromRecommendation({ gameId: "missing" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Library entry not found");
    expect(updatePlayState).not.toHaveBeenCalled();
  });

  it("rejects malformed input without touching the database", async () => {
    const missing = await startPlayingFromRecommendation({});
    const badType = await startPlayingFromRecommendation({ gameId: "game-1", makeMain: "yes" });

    expect(missing.success).toBe(false);
    expect(badType.success).toBe(false);
    expect(libraryFindFirst).not.toHaveBeenCalled();
    expect(updatePlayState).not.toHaveBeenCalled();
  });
});
