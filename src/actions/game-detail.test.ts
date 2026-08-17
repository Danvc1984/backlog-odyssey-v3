import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { updatePersonalFields, addTagToGame, updatePlayState } from "./game-detail";

describe("updatePersonalFields", () => {
  const mockUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as any).libraryEntry = { update: mockUpdate };
    mockUpdate.mockResolvedValue({});
  });

  it("updates all provided fields", async () => {
    await updatePersonalFields("game-1", {
      priority: "HIGH",
      interest: 4,
      rating: 8,
      preferredEnvironment: "BAZZITE",
      notes: "Great game",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      data: {
        priority: "HIGH",
        interest: 4,
        rating: 8,
        preferredEnvironment: "BAZZITE",
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
    (prisma as any).libraryEntry = {
      update: mockUpdate,
      updateMany: mockUpdateMany,
    };
    (prisma as any).$transaction = mockTransaction;
    mockUpdate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
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
    (prisma as any).personalTag = { upsert: mockUpsert };
    (prisma as any).gameTag = { create: mockCreate };
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