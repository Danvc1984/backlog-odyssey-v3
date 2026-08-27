import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  updatePersonalFields,
  addTagToGame,
  updatePlayState,
  updateGameName,
  updateGameAvailability,
} from "./game-detail";

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
  const mockUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as {
      gameAvailability: {
        findUnique: typeof mockFindUnique;
        update: typeof mockUpdate;
      };
    }).gameAvailability = { findUnique: mockFindUnique, update: mockUpdate };
    mockFindUnique.mockResolvedValue({ source: "OTHER_PLATFORM" });
    mockUpdate.mockResolvedValue({ id: "availability-1" });
  });

  it("updates a manual source and display name", async () => {
    const result = await updateGameAvailability("availability-1", {
      source: "ROM",
      displayName: "Local copy",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "availability-1" },
      data: { source: "ROM", displayName: "Local copy" },
    });
  });

  it("allows Steam source and display-name edits without exposing technical fields", async () => {
    mockFindUnique.mockResolvedValue({ source: "STEAM" });

    const result = await updateGameAvailability("availability-1", {
      source: "OTHER_PLATFORM",
      displayName: "Steam library",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "availability-1" },
      data: { source: "OTHER_PLATFORM", displayName: "Steam library" },
    });
  });

  it("rejects technical-field payloads", async () => {
    mockFindUnique.mockResolvedValue({ source: "STEAM" });

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

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as {
      libraryEntry: {
        update: typeof mockUpdate;
        updateMany: typeof mockUpdateMany;
      };
      $transaction: typeof mockTransaction;
    }).libraryEntry = {
      update: mockUpdate,
      updateMany: mockUpdateMany,
    };
    (prisma as unknown as { $transaction: typeof mockTransaction }).$transaction =
      mockTransaction;
    mockUpdate.mockResolvedValue({});
    mockTransaction.mockImplementation(
      async (
        fn: (client: {
          libraryEntry: {
            updateMany: typeof mockUpdateMany;
            update: typeof mockTxUpdate;
          };
        }) => unknown,
      ) => fn({
        libraryEntry: {
          updateMany: mockUpdateMany,
          update: mockTxUpdate,
        },
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
  });

  it("sets isMainGame false without a transaction", async () => {
    await updatePlayState("game-1", { isMainGame: false });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: { isMainGame: false },
    });
    expect(mockTransaction).not.toHaveBeenCalled();
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
    expect(result.error).toBe("DB connection lost");
  });
});
