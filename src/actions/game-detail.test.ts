import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/recommendations/events", () => ({
  logRecommendationEvent: vi.fn(),
  playStateTransitionKind: vi.fn((previous: string, next: string) => {
    if (previous === next || next === "NOT_STARTED") return null;
    if (next === "IN_PROGRESS") return "START";
    if (next === "PLAYED_BEFORE") return "COMPLETION";
    if (next === "ABANDONED") return "ABANDONMENT";
    return null;
  }),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { logRecommendationEvent } from "@/lib/recommendations/events";
import {
  updatePersonalFields,
  addTagToGame,
  updatePlayState,
  updateGameName,
  updateGameAvailability,
  addGameAvailability,
  removeGameAvailability,
} from "./game-detail";

describe("game availability actions", () => {
  const findGame = vi.fn();
  const findDuplicate = vi.fn();
  const findSource = vi.fn();
  const createAvailability = vi.fn();
  const findAvailability = vi.fn();
  const deleteAvailability = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as {
      game: { findUnique: typeof findGame };
      gameAvailability: {
        findFirst: typeof findDuplicate;
        create: typeof createAvailability;
        findUnique: typeof findAvailability;
        delete: typeof deleteAvailability;
      };
      alternativeSource: { findUnique: typeof findSource };
    }).game = { findUnique: findGame };
    (prisma as unknown as { gameAvailability: Record<string, unknown> }).gameAvailability = {
      findFirst: findDuplicate,
      create: createAvailability,
      findUnique: findAvailability,
      delete: deleteAvailability,
    };
    (prisma as unknown as { alternativeSource: { findUnique: typeof findSource } }).alternativeSource = {
      findUnique: findSource,
    };
    findGame.mockResolvedValue({ id: "game-1" });
    findDuplicate.mockResolvedValue(null);
    findSource.mockResolvedValue({ id: "source-1", archivedAt: null });
    createAvailability.mockResolvedValue({ id: "availability-1" });
    findAvailability.mockResolvedValue({
      id: "availability-1",
      source: "ROM",
      steamAppId: null,
      steamPlaytimeTotal: null,
      steamLastPlayed: null,
    });
    deleteAvailability.mockResolvedValue({ id: "availability-1" });
  });

  it.each([
    ["STEAM", { source: "STEAM" }, { gameId: "game-1", source: "STEAM", alternativeSourceId: null }],
    ["ROM", { source: "ROM" }, { gameId: "game-1", source: "ROM", alternativeSourceId: null }],
    [
      "alternative",
      { source: "OTHER_PLATFORM", alternativeSourceId: "source-1" },
      { gameId: "game-1", source: "OTHER_PLATFORM", alternativeSourceId: "source-1" },
    ],
  ])("adds a %s availability row", async (_label, input, data) => {
    const result = await addGameAvailability("game-1", input as never);

    expect(result.success).toBe(true);
    expect(createAvailability).toHaveBeenCalledWith({ data });
  });

  it.each([
    ["STEAM", { source: "STEAM" }, "This game already has a Steam source"],
    ["ROM", { source: "ROM" }, "This game already has a ROM source"],
    [
      "alternative",
      { source: "OTHER_PLATFORM", alternativeSourceId: "source-1" },
      "This game already has that store source",
    ],
  ])("rejects a duplicate %s row", async (_label, input, error) => {
    findDuplicate.mockResolvedValue({ id: "existing" });

    const result = await addGameAvailability("game-1", input as never);

    expect(result).toEqual({ success: false, data: null, error });
    expect(createAvailability).not.toHaveBeenCalled();
  });

  it("rejects a missing or archived alternative source", async () => {
    findSource.mockResolvedValueOnce(null);
    const missing = await addGameAvailability("game-1", {
      source: "OTHER_PLATFORM",
      alternativeSourceId: "missing",
    });
    findSource.mockResolvedValueOnce({ id: "source-1", archivedAt: new Date() });
    const archived = await addGameAvailability("game-1", {
      source: "OTHER_PLATFORM",
      alternativeSourceId: "source-1",
    });

    expect(missing.error).toBe("Alternative source not found");
    expect(archived.error).toBe("This source is archived and cannot be selected");
    expect(createAvailability).not.toHaveBeenCalled();
  });

  it("protects Steam rows with synchronized statistics", async () => {
    findAvailability.mockResolvedValue({
      id: "availability-1",
      source: "STEAM",
      steamAppId: "730",
      steamPlaytimeTotal: null,
      steamLastPlayed: null,
    });

    const result = await removeGameAvailability("availability-1");

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Steam statistics are synchronized",
    });
    expect(deleteAvailability).not.toHaveBeenCalled();
  });

  it.each(["ROM", "OTHER_PLATFORM"])("removes a %s row", async (source) => {
    findAvailability.mockResolvedValue({
      id: "availability-1",
      source,
      steamAppId: null,
      steamPlaytimeTotal: null,
      steamLastPlayed: null,
    });

    const result = await removeGameAvailability("availability-1");

    expect(result).toEqual({
      success: true,
      data: { id: "availability-1" },
      error: null,
    });
    expect(deleteAvailability).toHaveBeenCalledWith({ where: { id: "availability-1" } });
  });
});

describe("updateGameName", () => {
  const mockUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as { game: { update: typeof mockUpdate } }).game = {
      update: mockUpdate,
    };
    mockUpdate.mockResolvedValue({ id: "game-1", name: "New name" });
  });

  it("trims and updates the game name", async () => {
    const result = await updateGameName("game-1", { name: "  New name  " });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "game-1" },
      data: { name: "New name" },
    });
  });

  it("rejects a blank name and malformed game id", async () => {
    const blank = await updateGameName("game-1", { name: "   " });
    const malformedId = await updateGameName("", { name: "New name" });

    expect(blank.success).toBe(false);
    expect(malformedId.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects unknown fields instead of accepting an unsafe payload", async () => {
    const result = await updateGameName("game-1", {
      name: "New name",
      origin: "MANUAL",
    } as never);

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("updateGameAvailability", () => {
  const mockFindUnique = vi.fn();
  const mockFindMany = vi.fn();
  const mockUpdate = vi.fn();
  const mockAltFind = vi.fn();
  const mockAltCreate = vi.fn();
  const mockTransaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as { $transaction: typeof mockTransaction }).$transaction =
      mockTransaction;
    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) =>
        fn({
          gameAvailability: {
            findUnique: mockFindUnique,
            findMany: mockFindMany,
            update: mockUpdate,
          },
          alternativeSource: {
            findUnique: mockAltFind,
            create: mockAltCreate,
          },
        }),
    );
    mockFindUnique.mockResolvedValue({
      id: "availability-1",
      gameId: "game-1",
      source: "OTHER_PLATFORM",
      alternativeSourceId: "source-1",
    });
    mockFindMany.mockResolvedValue([]);
    mockUpdate.mockResolvedValue({ id: "availability-1" });
    mockAltFind.mockResolvedValue(null);
    mockAltCreate.mockResolvedValue({ id: "unsource-1" });
  });

  it("updates source to ROM, clears the alternative source id, and guards the move", async () => {
    const result = await updateGameAvailability("availability-1", {
      source: "ROM",
      displayName: "Local copy",
    });

    expect(result.success).toBe(true);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      select: { id: true, source: true, alternativeSourceId: true },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "availability-1" },
      data: { source: "ROM", displayName: "Local copy", alternativeSourceId: null },
    });
  });

  it("attaches the unspecified source when moving a row onto OTHER_PLATFORM", async () => {
    mockFindUnique.mockResolvedValue({
      id: "availability-1",
      gameId: "game-1",
      source: "ROM",
    });

    const result = await updateGameAvailability("availability-1", {
      source: "OTHER_PLATFORM",
      displayName: "Steam library",
    });

    expect(result.success).toBe(true);
    expect(mockAltFind).toHaveBeenCalledWith({
      where: { normalizedName: "unspecified other source" },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "availability-1" },
      data: {
        source: "OTHER_PLATFORM",
        displayName: "Steam library",
        alternativeSourceId: "unsource-1",
      },
    });
  });

  it("rejects moving onto a Steam source the game already has", async () => {
    mockFindUnique.mockResolvedValue({
      id: "availability-1",
      gameId: "game-1",
      source: "ROM",
    });
    mockFindMany.mockResolvedValue([
      { id: "availability-2", source: "STEAM", alternativeSourceId: null },
    ]);

    const result = await updateGameAvailability("availability-1", {
      source: "STEAM",
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "This game already has a Steam source",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate alternative source for the same store", async () => {
    mockFindUnique.mockResolvedValue({
      id: "availability-1",
      gameId: "game-1",
      source: "STEAM",
    });
    mockFindMany.mockResolvedValue([
      {
        id: "availability-2",
        source: "OTHER_PLATFORM",
        alternativeSourceId: "unsource-1",
      },
    ]);

    const result = await updateGameAvailability("availability-1", {
      source: "OTHER_PLATFORM",
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "This game already has that store source",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("preserves the selected alternative source when only renaming the row", async () => {
    mockFindUnique.mockResolvedValue({
      id: "availability-1",
      gameId: "game-1",
      source: "OTHER_PLATFORM",
      alternativeSourceId: "source-1",
    });

    const result = await updateGameAvailability("availability-1", {
      displayName: "Renamed",
    });

    expect(result.success).toBe(true);
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "availability-1" },
      data: { displayName: "Renamed", alternativeSourceId: "source-1" },
    });
  });

  it("rejects technical-field payloads", async () => {
    mockFindUnique.mockResolvedValue({
      id: "availability-1",
      gameId: "game-1",
      source: "STEAM",
    });

    const technicalChange = await updateGameAvailability("availability-1", {
      displayName: "Steam library",
      steamAppId: "123",
      steamPlaytimeTotal: 60,
    } as never);

    expect(technicalChange.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an unknown availability row", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await updateGameAvailability("missing", {
      displayName: "Name",
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Availability not found",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("updatePersonalFields", () => {
  const mockUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as {
      libraryEntry: { update: typeof mockUpdate };
    }).libraryEntry = { update: mockUpdate };
    mockUpdate.mockResolvedValue({});
  });

  it("updates all provided fields", async () => {
    await updatePersonalFields("game-1", {
      priority: "HIGH",
      interest: 4,
      rating: 8,
      preferredEnvironment: "BAZZITE",
      gameExperience: "PC_GAMING",
      notes: "Great game",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: {
        priority: "HIGH",
        interest: 4,
        rating: 8,
        preferredEnvironment: "BAZZITE",
        gameExperience: "PC_GAMING",
        notes: "Great game",
      },
    });
  });

  it("ignores undefined fields (partial update)", async () => {
    await updatePersonalFields("game-1", { priority: "LOW" });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { priority: "LOW" },
    });
  });

  it("sets interest to null when explicitly null", async () => {
    await updatePersonalFields("game-1", { interest: null });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { interest: null },
    });
  });

  it("sets and clears game experience while omitted leaves it untouched", async () => {
    await updatePersonalFields("game-1", { gameExperience: "MULTIPLAYER_COOP" });
    expect(mockUpdate).toHaveBeenLastCalledWith({
      where: { gameId: "game-1" },
      data: { gameExperience: "MULTIPLAYER_COOP" },
    });

    await updatePersonalFields("game-1", { gameExperience: null });
    expect(mockUpdate).toHaveBeenLastCalledWith({
      where: { gameId: "game-1" },
      data: { gameExperience: null },
    });

    await updatePersonalFields("game-1", { priority: "LOW" });
    expect(mockUpdate).toHaveBeenLastCalledWith({
      where: { gameId: "game-1" },
      data: { priority: "LOW" },
    });
  });

  it("rejects an invalid game experience", async () => {
    const result = await updatePersonalFields("game-1", {
      gameExperience: "DESKTOP" as never,
    });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects interest out of range (0)", async () => {
    const result = await updatePersonalFields("game-1", { interest: 0 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid input");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects interest out of range (6)", async () => {
    const result = await updatePersonalFields("game-1", { interest: 6 });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects rating out of range (0)", async () => {
    const result = await updatePersonalFields("game-1", { rating: 0 });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects rating out of range (11)", async () => {
    const result = await updatePersonalFields("game-1", { rating: 11 });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects unknown priority value", async () => {
    const result = await updatePersonalFields("game-1", {
      priority: "URGENT" as never,
    });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("updatePlayState", () => {
  const mockUpdate = vi.fn();
  const mockUpdateMany = vi.fn();
  const mockTxUpdate = vi.fn();
  const mockTransaction = vi.fn();
  const mockFindUnique = vi.fn();
  const mockWallpaperUpsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as {
      libraryEntry: {
        update: typeof mockUpdate;
        updateMany: typeof mockUpdateMany;
        findUnique: typeof mockFindUnique;
      };
      $transaction: typeof mockTransaction;
    }).libraryEntry = {
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findUnique: mockFindUnique,
    };
    (prisma as unknown as { $transaction: typeof mockTransaction }).$transaction =
      mockTransaction;
    mockUpdate.mockResolvedValue({});
    mockFindUnique.mockResolvedValue({ playState: "NOT_STARTED", isMainGame: false });
    mockTransaction.mockImplementation(
      async (
        fn: (client: {
          libraryEntry: {
            updateMany: typeof mockUpdateMany;
            update: typeof mockTxUpdate;
          };
          wallpaperState: { upsert: typeof mockWallpaperUpsert };
        }) => unknown,
      ) => fn({
        libraryEntry: {
          updateMany: mockUpdateMany,
          update: mockTxUpdate,
        },
        wallpaperState: { upsert: mockWallpaperUpsert },
      }),
    );
    mockTxUpdate.mockResolvedValue({ gameId: "game-1", isMainGame: true });
  });

  it("updates play state", async () => {
    const result = await updatePlayState("game-1", {
      playState: "IN_PROGRESS",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { playState: "IN_PROGRESS" },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, { kind: "START", gameId: "game-1" });
  });

  it.each([
    ["IN_PROGRESS", "PLAYED_BEFORE", "COMPLETION"],
    ["IN_PROGRESS", "ABANDONED", "ABANDONMENT"],
  ])("logs %s -> %s as %s", async (previous, next, kind) => {
    mockFindUnique.mockResolvedValue({ playState: previous });
    await updatePlayState("game-1", { playState: next as never });
    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, { kind, gameId: "game-1" });
  });

  it("does not log unchanged, omitted, or reset-to-not-started states", async () => {
    await updatePlayState("game-1", { playState: "NOT_STARTED" });
    await updatePlayState("game-1", {});
    expect(logRecommendationEvent).not.toHaveBeenCalled();
  });

  it("keeps the update successful when event logging fails", async () => {
    vi.mocked(logRecommendationEvent).mockRejectedValueOnce(new Error("event unavailable"));
    const result = await updatePlayState("game-1", { playState: "IN_PROGRESS" });
    expect(result.success).toBe(true);
  });

  it("clears previous main game and sets the new one in a transaction", async () => {
    const result = await updatePlayState("game-1", { isMainGame: true });

    expect(result.success).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { isMainGame: true, gameId: { not: "game-1" } },
      data: { isMainGame: false },
    });
    expect(mockTxUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { isMainGame: true },
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockWallpaperUpsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: {
        id: 1,
        candidates: expect.anything(),
        selectedIdx: 0,
        renderTarget: expect.anything(),
        lastAttemptAt: null,
        lastError: null,
      },
      update: {
        candidates: expect.anything(),
        selectedIdx: 0,
        renderTarget: expect.anything(),
        lastAttemptAt: null,
        lastError: null,
      },
    });
  });

  it("does not clear the wallpaper pool when an already non-main game stays unset", async () => {
    await updatePlayState("game-1", { isMainGame: false });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { isMainGame: false },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockWallpaperUpsert).not.toHaveBeenCalled();
  });

  it("clears the wallpaper pool when unsetting the current main game", async () => {
    mockFindUnique.mockResolvedValue({ playState: "IN_PROGRESS", isMainGame: true });

    await updatePlayState("game-1", { isMainGame: false });

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTxUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { isMainGame: false },
    });
    expect(mockWallpaperUpsert).toHaveBeenCalledOnce();
  });

  it("does not clear the wallpaper pool when the current main game is selected again", async () => {
    mockFindUnique.mockResolvedValue({ playState: "IN_PROGRESS", isMainGame: true });

    await updatePlayState("game-1", { isMainGame: true });

    expect(mockWallpaperUpsert).not.toHaveBeenCalled();
  });

  it("toggles candidate flags", async () => {
    await updatePlayState("game-1", {
      playSoon: true,
      replayCandidate: true,
      hidden: true,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { playSoon: true, replayCandidate: true, hidden: true },
    });
  });

  it("rejects an invalid play state", async () => {
    const result = await updatePlayState("game-1", {
      playState: "PAUSED" as never,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid input");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects an empty gameId", async () => {
    const result = await updatePlayState("", { playState: "IN_PROGRESS" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid input");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("addTagToGame", () => {
  const mockUpsert = vi.fn();
  const mockCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as { personalTag: { upsert: typeof mockUpsert } }).personalTag = {
      upsert: mockUpsert,
    };
    (prisma as unknown as { gameTag: { create: typeof mockCreate } }).gameTag = {
      create: mockCreate,
    };
    mockUpsert.mockResolvedValue({ id: "tag-1", name: "RPG" });
    mockCreate.mockResolvedValue({});
  });

  it("upserts PersonalTag and creates GameTag", async () => {
    const result = await addTagToGame("game-1", { tagName: "RPG" });

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { name: "RPG" },
      create: { name: "RPG" },
      update: {},
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { gameId: "game-1", tagId: "tag-1" },
    });
  });

  it("rejects empty tag name", async () => {
    const result = await addTagToGame("game-1", { tagName: "" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid input");
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only tag name", async () => {
    const result = await addTagToGame("game-1", { tagName: "   " });

    expect(result.success).toBe(false);
  });

  it("handles idempotent re-add (P2002 on GameTag)", async () => {
    mockCreate.mockRejectedValue({ code: "P2002" });

    const result = await addTagToGame("game-1", { tagName: "RPG" });

    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("re-throws non-P2002 error on GameTag create", async () => {
    mockCreate.mockRejectedValue(new Error("DB connection lost"));

    const result = await addTagToGame("game-1", { tagName: "RPG" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to add tag");
  });
});
