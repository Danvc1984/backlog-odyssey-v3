import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { normalizeName } from "@/lib/duplicate-utils";
import { prisma } from "@/lib/prisma";
import { detectDuplicates, dismissDuplicate } from "./duplicates";

describe("normalizeName", () => {
  it("folds case, removes punctuation, and collapses whitespace", () => {
    expect(normalizeName("  The Witcher: 3!!!  ")).toBe("the witcher 3");
  });
});

describe("detectDuplicates", () => {
  const mockFindManyGames = vi.fn();
  const mockFindManyDuplicates = vi.fn();
  const mockCreateMany = vi.fn();
  const mockFindUniqueDuplicate = vi.fn();
  const mockUpdateDuplicate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    (prisma as unknown as {
      game: { findMany: typeof mockFindManyGames };
      possibleDuplicate: {
        findMany: typeof mockFindManyDuplicates;
        createMany: typeof mockCreateMany;
        findUnique: typeof mockFindUniqueDuplicate;
        update: typeof mockUpdateDuplicate;
      };
    }).game = { findMany: mockFindManyGames };
    (prisma as unknown as {
      possibleDuplicate: {
        findMany: typeof mockFindManyDuplicates;
        createMany: typeof mockCreateMany;
        findUnique: typeof mockFindUniqueDuplicate;
        update: typeof mockUpdateDuplicate;
      };
    }).possibleDuplicate = {
      findMany: mockFindManyDuplicates,
      createMany: mockCreateMany,
      findUnique: mockFindUniqueDuplicate,
      update: mockUpdateDuplicate,
    };
    mockFindManyDuplicates.mockResolvedValue([]);
    mockCreateMany.mockResolvedValue({ count: 1 });
    mockUpdateDuplicate.mockResolvedValue({ id: "duplicate-1" });
  });

  it("dismisses an open duplicate and records the review time", async () => {
    mockFindUniqueDuplicate.mockResolvedValue({ id: "duplicate-1", status: "OPEN" });

    const result = await dismissDuplicate("duplicate-1");

    expect(result).toEqual({
      success: true,
      data: { id: "duplicate-1" },
      error: null,
    });
    expect(mockUpdateDuplicate).toHaveBeenCalledWith({
      where: { id: "duplicate-1" },
      data: { status: "DISMISSED", reviewedAt: expect.any(Date) },
    });
  });

  it("rejects a non-existent duplicate", async () => {
    mockFindUniqueDuplicate.mockResolvedValue(null);

    const result = await dismissDuplicate("duplicate-missing");

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Duplicate not found",
    });
    expect(mockUpdateDuplicate).not.toHaveBeenCalled();
  });

  it("rejects an already dismissed duplicate", async () => {
    mockFindUniqueDuplicate.mockResolvedValue({
      id: "duplicate-1",
      status: "DISMISSED",
    });

    const result = await dismissDuplicate("duplicate-1");

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Duplicate has already been dismissed",
    });
    expect(mockUpdateDuplicate).not.toHaveBeenCalled();
  });

  it("creates an ordered pair for identical normalized names", async () => {
    mockFindManyGames.mockResolvedValue([
      { id: "game-z", name: "Hades" },
      { id: "game-a", name: "hades!" },
    ]);

    const result = await detectDuplicates();

    expect(result).toEqual({
      success: true,
      data: { scanned: 2, duplicatesFound: 1 },
      error: null,
    });
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        {
          gameAId: "game-a",
          gameBId: "game-z",
          confidence: 1,
          evidence: { method: "name_match", normalizedName: "hades" },
        },
      ],
    });
  });

  it("does not create the same pair again on a rescan", async () => {
    mockFindManyGames.mockResolvedValue([
      { id: "game-a", name: "Hades" },
      { id: "game-b", name: "Hades" },
    ]);
    mockFindManyDuplicates.mockResolvedValue([
      { gameAId: "game-a", gameBId: "game-b" },
    ]);

    const result = await detectDuplicates();

    expect(result.data).toEqual({ scanned: 2, duplicatesFound: 0 });
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it("does not overwrite a dismissed pair", async () => {
    mockFindManyGames.mockResolvedValue([
      { id: "game-a", name: "Hades" },
      { id: "game-b", name: "Hades" },
    ]);
    mockFindManyDuplicates.mockResolvedValue([
      { gameAId: "game-a", gameBId: "game-b" },
    ]);

    await detectDuplicates();

    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it("does not pair games with different normalized names", async () => {
    mockFindManyGames.mockResolvedValue([
      { id: "game-a", name: "Hades" },
      { id: "game-b", name: "Dead Cells" },
    ]);

    const result = await detectDuplicates();

    expect(result.data).toEqual({ scanned: 2, duplicatesFound: 0 });
    expect(mockFindManyDuplicates).not.toHaveBeenCalled();
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it("leaves dismissed pairs alone by default", async () => {
    mockFindManyGames.mockResolvedValue([
      { id: "game-a", name: "Hades" },
      { id: "game-b", name: "Hades" },
    ]);
    mockFindManyDuplicates.mockResolvedValue([
      { id: "duplicate-1", gameAId: "game-a", gameBId: "game-b", status: "DISMISSED" },
    ]);

    const result = await detectDuplicates();

    expect(result.data).toEqual({ scanned: 2, duplicatesFound: 0 });
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(mockUpdateDuplicate).not.toHaveBeenCalled();
  });

  it("reopens a dismissed pair when includeDismissed is set", async () => {
    mockFindManyGames.mockResolvedValue([
      { id: "game-a", name: "Hades" },
      { id: "game-b", name: "Hades" },
    ]);
    mockFindManyDuplicates.mockResolvedValue([
      { id: "duplicate-1", gameAId: "game-a", gameBId: "game-b", status: "DISMISSED" },
    ]);

    const result = await detectDuplicates({ includeDismissed: true });

    expect(result.data).toEqual({ scanned: 2, duplicatesFound: 1 });
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(mockUpdateDuplicate).toHaveBeenCalledWith({
      where: { id: "duplicate-1" },
      data: {
        status: "OPEN",
        reviewedAt: null,
        confidence: 1,
        evidence: { method: "name_match", normalizedName: "hades" },
      },
    });
  });

  it("does not reopen an already open pair when includeDismissed is set", async () => {
    mockFindManyGames.mockResolvedValue([
      { id: "game-a", name: "Hades" },
      { id: "game-b", name: "Hades" },
    ]);
    mockFindManyDuplicates.mockResolvedValue([
      { id: "duplicate-1", gameAId: "game-a", gameBId: "game-b", status: "OPEN" },
    ]);

    const result = await detectDuplicates({ includeDismissed: true });

    expect(result.data).toEqual({ scanned: 2, duplicatesFound: 0 });
    expect(mockUpdateDuplicate).not.toHaveBeenCalled();
  });
});
