import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  buildDeleteSnapshotPlan,
  buildMergeProposal,
  CATALOG_OPERATION_TTL_MS,
  createSnapshotEnvelope,
  parseSnapshotEnvelope,
  planExternalIdUnion,
  planMergeMutations,
  planOneToOneConflicts,
  resolveMergePlan,
  resolvePersonalFields,
  suggestSurvivor,
  type DeleteSnapshotPayload,
  type MergeGraphGame,
  type MergeSnapshotPayload,
  type MergeSourceGame,
  type MergeSourceLibraryEntry,
  type ResolvedMergePlan,
} from "@/lib/catalog-operations";
import {
  executeDelete,
  executeMerge,
  getActiveOperations,
  previewDelete,
  proposeMerge,
  undoOperation,
} from "./catalog-operations";

function makeSourceGame(overrides: Partial<MergeSourceGame> = {}): MergeSourceGame {
  return {
    id: "game-a",
    name: "Hades",
    origin: "MANUAL",
    libraryEntry: baseLibraryEntry(),
    externalIds: [],
    dlc: [],
    availability: [],
    collections: [],
    tags: [],
    metadataSnapshots: [],
    wishlistRowId: null,
    compatSnapshots: [],
    envCompat: [],
    ...overrides,
  };
}

function baseLibraryEntry(): MergeSourceLibraryEntry {
  return {
    playState: "NOT_STARTED",
    isMainGame: false,
    priority: "NONE",
    interest: null,
    rating: null,
    preferredEnvironment: null,
    compatOverrideStatus: null,
    compatOverrideReason: null,
    playSoon: false,
    replayCandidate: false,
    hidden: false,
    notes: null,
  };
}

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: "game-a",
    name: "Hades",
    origin: "MANUAL",
    type: "BASE_GAME",
    libraryEntry: baseLibraryEntry(),
    externalIds: [],
    dlcs: [],
    availability: [],
    collections: [],
    tags: [],
    metadataSnapshots: [],
    wishlistEntry: null,
    compatSnapshots: [],
    envCompat: [],
    ...overrides,
  };
}

describe("suggestSurvivor", () => {
  it("prefers the Steam-imported game", () => {
    expect(
      suggestSurvivor({ id: "a", origin: "MANUAL" }, { id: "b", origin: "STEAM_IMPORT" }),
    ).toBe("b");
    expect(
      suggestSurvivor({ id: "a", origin: "STEAM_IMPORT" }, { id: "b", origin: "MANUAL" }),
    ).toBe("a");
  });

  it("falls back to deterministic ID order for equal origins", () => {
    expect(
      suggestSurvivor({ id: "z", origin: "MANUAL" }, { id: "a", origin: "MANUAL" }),
    ).toBe("a");
    expect(
      suggestSurvivor({ id: "z", origin: "STEAM_IMPORT" }, { id: "a", origin: "STEAM_IMPORT" }),
    ).toBe("a");
  });
});

describe("resolvePersonalFields", () => {
  it("defaults to the value present on only one side", () => {
    const result = resolvePersonalFields(
      { ...baseLibraryEntry(), notes: "from A" },
      makeSourceGame().libraryEntry,
      "game-a",
      "game-b",
    );

    expect(result.conflicts).toEqual([]);
    expect(result.defaults.notes).toBe("from A");
    expect(result.defaults.priority).toBe("NONE");
  });

  it("keeps null defaults when both sides are null", () => {
    const result = resolvePersonalFields(
      makeSourceGame().libraryEntry,
      makeSourceGame().libraryEntry,
      "game-a",
      "game-b",
    );

    expect(result.conflicts).toEqual([]);
    expect(result.defaults.interest).toBeNull();
    expect(result.defaults.notes).toBeNull();
  });

  it("reports a conflict for differing non-null values", () => {
    const result = resolvePersonalFields(
      { ...baseLibraryEntry(), rating: 8, notes: "A notes" },
      { ...baseLibraryEntry(), rating: 6, notes: "B notes" },
      "game-a",
      "game-b",
    );

    expect(result.conflicts.map((c) => c.field)).toEqual(["rating", "notes"]);
    expect(result.conflicts[0]).toEqual({
      field: "rating",
      a: { gameId: "game-a", value: 8 },
      b: { gameId: "game-b", value: 6 },
    });
  });

  it("treats an equal value on both sides as a default, not a conflict", () => {
    const result = resolvePersonalFields(
      { ...baseLibraryEntry(), priority: "HIGH" },
      { ...baseLibraryEntry(), priority: "HIGH" },
      "game-a",
      "game-b",
    );

    expect(result.conflicts).toEqual([]);
    expect(result.defaults.priority).toBe("HIGH");
  });

  it("treats a missing library entry as all-null values", () => {
    const result = resolvePersonalFields(
      null,
      { ...baseLibraryEntry(), interest: 5, playSoon: true },
      "game-a",
      "game-b",
    );

    expect(result.conflicts).toEqual([]);
    expect(result.defaults.interest).toBe(5);
    expect(result.defaults.playSoon).toBe(true);
  });
});

describe("planExternalIdUnion", () => {
  it("unions namespaces present on only one side", () => {
    const result = planExternalIdUnion(
      [
        { id: "e1", namespace: "steam", externalId: "111", gameId: "game-a" },
        { id: "e2", namespace: "itad", externalId: "aaa", gameId: "game-a" },
      ],
      [{ id: "e3", namespace: "rawg", externalId: "777", gameId: "game-b" }],
    );

    expect(result.union.map((row) => row.namespace).sort()).toEqual(["itad", "rawg", "steam"]);
    expect(result.conflicts).toEqual([]);
  });

  it("blocks when the same namespace holds different IDs", () => {
    const result = planExternalIdUnion(
      [{ id: "e1", namespace: "steam", externalId: "111", gameId: "game-a" }],
      [{ id: "e2", namespace: "steam", externalId: "222", gameId: "game-b" }],
    );

    expect(result.union).toEqual([]);
    expect(result.conflicts).toEqual([
      {
        namespace: "steam",
        rows: [
          { id: "e1", externalId: "111", gameId: "game-a" },
          { id: "e2", externalId: "222", gameId: "game-b" },
        ],
      },
    ]);
  });

  it("deduplicates an identical external ID in one namespace", () => {
    const result = planExternalIdUnion(
      [{ id: "e1", namespace: "steam", externalId: "111", gameId: "game-a" }],
      [{ id: "e2", namespace: "steam", externalId: "111", gameId: "game-b" }],
    );

    expect(result.union).toEqual([
      { id: "e1", namespace: "steam", externalId: "111" },
    ]);
    expect(result.conflicts).toEqual([]);
  });
});

describe("planOneToOneConflicts", () => {
  it("reports a wishlist conflict when both games have an entry", () => {
    const result = planOneToOneConflicts(
      { gameId: "game-a", wishlistRowId: "w1", compatSnapshots: [], envCompat: [] },
      { gameId: "game-b", wishlistRowId: "w2", compatSnapshots: [], envCompat: [] },
    );

    expect(result).toEqual([
      {
        kind: "wishlist",
        key: "wishlist",
        a: { gameId: "game-a", rowId: "w1" },
        b: { gameId: "game-b", rowId: "w2" },
      },
    ]);
  });

  it("reports compatibility conflicts per shared provider", () => {
    const result = planOneToOneConflicts(
      {
        gameId: "game-a",
        wishlistRowId: null,
        compatSnapshots: [
          { id: "c1", provider: "PROTONDB" },
          { id: "c2", provider: "RAWG" },
        ],
        envCompat: [],
      },
      {
        gameId: "game-b",
        wishlistRowId: null,
        compatSnapshots: [{ id: "c3", provider: "PROTONDB" }],
        envCompat: [],
      },
    );

    expect(result).toEqual([
      {
        kind: "compatibility",
        key: "PROTONDB",
        a: { gameId: "game-a", rowId: "c1" },
        b: { gameId: "game-b", rowId: "c3" },
      },
    ]);
  });

  it("reports environment conflicts per shared environment", () => {
    const result = planOneToOneConflicts(
      {
        gameId: "game-a",
        wishlistRowId: null,
        compatSnapshots: [],
        envCompat: [{ id: "v1", environment: "BAZZITE" }],
      },
      {
        gameId: "game-b",
        wishlistRowId: null,
        compatSnapshots: [],
        envCompat: [{ id: "v2", environment: "BAZZITE" }],
      },
    );

    expect(result).toEqual([
      {
        kind: "environment",
        key: "BAZZITE",
        a: { gameId: "game-a", rowId: "v1" },
        b: { gameId: "game-b", rowId: "v2" },
      },
    ]);
  });

  it("ignores rows that exist on only one side", () => {
    const result = planOneToOneConflicts(
      {
        gameId: "game-a",
        wishlistRowId: "w1",
        compatSnapshots: [{ id: "c1", provider: "PROTONDB" }],
        envCompat: [{ id: "v1", environment: "BAZZITE" }],
      },
      {
        gameId: "game-b",
        wishlistRowId: null,
        compatSnapshots: [],
        envCompat: [],
      },
    );

    expect(result).toEqual([]);
  });
});

describe("buildMergeProposal", () => {
  it("assembles survivor, discarded game, final name, and counts", () => {
    const gameA = makeSourceGame({
      id: "game-a",
      name: "Hades (manual)",
      origin: "MANUAL",
      dlc: [{ id: "d1", name: "Hades OST" }],
      availability: [
        { id: "a1", source: "STEAM", steamAppId: "1145360" },
        { id: "a2", source: "ROM", steamAppId: null },
      ],
      collections: [{ collectionId: "col-1" }],
      tags: [{ tagId: "tag-1" }],
      metadataSnapshots: [{ id: "m1", provider: "RAWG" }],
    });
    const gameB = makeSourceGame({
      id: "game-b",
      name: "Hades",
      origin: "STEAM_IMPORT",
      libraryEntry: null,
      availability: [
        { id: "a3", source: "STEAM", steamAppId: "1145360" },
      ],
      collections: [{ collectionId: "col-2" }],
      metadataSnapshots: [{ id: "m2", provider: "RAWG" }],
      externalIds: [{ id: "e1", namespace: "steam", externalId: "1145360", gameId: "game-b" }],
    });

    const proposal = buildMergeProposal({ duplicateId: "dup-1", gameA, gameB });

    expect(proposal.survivorId).toBe("game-b");
    expect(proposal.discardedId).toBe("game-a");
    expect(proposal.finalName).toBe("Hades");
    expect(proposal.games[0]).toEqual({ id: "game-a", name: "Hades (manual)", origin: "MANUAL", dlcCount: 1 });
    expect(proposal.games[1]).toEqual({ id: "game-b", name: "Hades", origin: "STEAM_IMPORT", dlcCount: 0 });
    expect(proposal.relations).toEqual({
      availability: 2,
      collections: 2,
      tags: 1,
      metadataSnapshots: 1,
    });
    expect(proposal.externalIds.union).toEqual([
      { id: "e1", namespace: "steam", externalId: "1145360" },
    ]);
  });

  it("marks the proposal blocked when any conflict exists", () => {
    const gameA = makeSourceGame({
      libraryEntry: { ...baseLibraryEntry(), rating: 8 },
    });
    const gameB = makeSourceGame({
      id: "game-b",
      libraryEntry: { ...baseLibraryEntry(), rating: 6 },
    });

    const proposal = buildMergeProposal({ duplicateId: "dup-1", gameA, gameB });

    expect(proposal.blocked).toBe(true);
    expect(proposal.library.conflicts.length).toBe(1);
  });

  it("leaves the proposal unblocked when no conflicts exist", () => {
    const proposal = buildMergeProposal({
      duplicateId: "dup-1",
      gameA: makeSourceGame(),
      gameB: makeSourceGame({ id: "game-b" }),
    });

    expect(proposal.blocked).toBe(false);
    expect(proposal.library.conflicts).toEqual([]);
    expect(proposal.externalIds.conflicts).toEqual([]);
    expect(proposal.oneToOne).toEqual([]);
  });
});

describe("proposeMerge", () => {
  const mockFindUniqueDuplicate = vi.fn();
  const mockFindFirstOperation = vi.fn();
  const mockFindManyGames = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as {
      possibleDuplicate: { findUnique: typeof mockFindUniqueDuplicate };
      catalogOperation: { findFirst: typeof mockFindFirstOperation };
      game: { findMany: typeof mockFindManyGames };
    }).possibleDuplicate = { findUnique: mockFindUniqueDuplicate };
    (prisma as unknown as {
      catalogOperation: { findFirst: typeof mockFindFirstOperation };
    }).catalogOperation = { findFirst: mockFindFirstOperation };
    (prisma as unknown as {
      game: { findMany: typeof mockFindManyGames };
    }).game = { findMany: mockFindManyGames };

    mockFindUniqueDuplicate.mockResolvedValue({
      id: "dup-1",
      status: "OPEN",
      gameAId: "game-a",
      gameBId: "game-b",
    });
    mockFindFirstOperation.mockResolvedValue(null);
    mockFindManyGames.mockResolvedValue([makeGame(), makeGame({ id: "game-b", name: "Hades", origin: "STEAM_IMPORT" })]);
  });

  it("returns a valid proposal for an open duplicate", async () => {
    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.success).toBe(true);
    expect(mockFindFirstOperation).toHaveBeenCalledWith({
      where: { state: "PENDING", affectedGameIds: { hasSome: ["game-a", "game-b"] } },
      select: { id: true },
    });
    if (result.success) {
      expect(result.data.duplicateId).toBe("dup-1");
      expect(result.data.survivorId).toBe("game-b");
      expect(result.data.discardedId).toBe("game-a");
      expect(result.data.finalName).toBe("Hades");
    }
  });

  it("rejects an empty duplicate id", async () => {
    const result = await proposeMerge({ duplicateId: "" });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(mockFindUniqueDuplicate).not.toHaveBeenCalled();
  });

  it("rejects a missing duplicate", async () => {
    mockFindUniqueDuplicate.mockResolvedValue(null);

    const result = await proposeMerge({ duplicateId: "dup-missing" });

    expect(result.error).toBe("Duplicate not found");
    expect(mockFindManyGames).not.toHaveBeenCalled();
  });

  it("rejects a dismissed duplicate", async () => {
    mockFindUniqueDuplicate.mockResolvedValue({
      id: "dup-1",
      status: "DISMISSED",
      gameAId: "game-a",
      gameBId: "game-b",
    });

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.error).toBe("Duplicate has already been reviewed");
  });

  it("rejects a self-referencing duplicate pair", async () => {
    mockFindUniqueDuplicate.mockResolvedValue({
      id: "dup-1",
      status: "OPEN",
      gameAId: "game-a",
      gameBId: "game-a",
    });

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.error).toBe("Duplicate pair is invalid");
  });

  it("rejects a pair under a pending operation", async () => {
    mockFindFirstOperation.mockResolvedValue({ id: "op-1" });

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.error).toBe("A recent catalog operation still involves these games");
    expect(mockFindManyGames).not.toHaveBeenCalled();
  });

  it("rejects a pair where a game is missing", async () => {
    mockFindManyGames.mockResolvedValue([makeGame()]);

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.error).toBe("Duplicate references a missing game");
  });

  it("rejects a pair that references a non-base game", async () => {
    mockFindManyGames.mockResolvedValue([
      makeGame(),
      makeGame({ id: "game-b", type: "DLC" }),
    ]);

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.error).toBe("Duplicate references a non-base game");
  });

  it("reports personal-field conflicts through the proposal", async () => {
    mockFindManyGames.mockResolvedValue([
      makeGame({ libraryEntry: { ...makeGame().libraryEntry, rating: 8 } }),
      makeGame({
        id: "game-b",
        name: "Hades",
        origin: "STEAM_IMPORT",
        libraryEntry: { ...makeGame().libraryEntry, rating: 6 },
      }),
    ]);

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blocked).toBe(true);
      expect(result.data.library.conflicts).toEqual([
        {
          field: "rating",
          a: { gameId: "game-a", value: 8 },
          b: { gameId: "game-b", value: 6 },
        },
      ]);
    }
  });

  it("reports a same-namespace external ID conflict through the proposal", async () => {
    mockFindManyGames.mockResolvedValue([
      makeGame({
        externalIds: [{ id: "e1", namespace: "steam", externalId: "111", gameId: "game-a" }],
      }),
      makeGame({
        id: "game-b",
        name: "Hades",
        origin: "STEAM_IMPORT",
        externalIds: [{ id: "e2", namespace: "steam", externalId: "222", gameId: "game-b" }],
      }),
    ]);

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.externalIds.conflicts).toEqual([
        {
          namespace: "steam",
          rows: [
            { id: "e1", externalId: "111", gameId: "game-a" },
            { id: "e2", externalId: "222", gameId: "game-b" },
          ],
        },
      ]);
    }
  });

  it("reports a one-to-one wishlist conflict through the proposal", async () => {
    mockFindManyGames.mockResolvedValue([
      makeGame({ wishlistEntry: { id: "w1" } }),
      makeGame({
        id: "game-b",
        name: "Hades",
        origin: "STEAM_IMPORT",
        wishlistEntry: { id: "w2" },
      }),
    ]);

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.oneToOne).toEqual([
        {
          kind: "wishlist",
          key: "wishlist",
          a: { gameId: "game-a", rowId: "w1" },
          b: { gameId: "game-b", rowId: "w2" },
        },
      ]);
    }
  });

  it("defaults personal values when a library entry is missing", async () => {
    mockFindManyGames.mockResolvedValue([
      makeGame({ libraryEntry: null }),
      makeGame({
        id: "game-b",
        name: "Hades",
        origin: "STEAM_IMPORT",
        libraryEntry: { ...makeGame().libraryEntry, interest: 5, rating: 9 },
      }),
    ]);

    const result = await proposeMerge({ duplicateId: "dup-1" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.library.conflicts).toEqual([]);
      expect(result.data.library.defaults.interest).toBe(5);
      expect(result.data.library.defaults.rating).toBe(9);
    }
  });
});

function makeGraphGame(overrides: Record<string, unknown> = {}): MergeGraphGame {
  return {
    id: "game-a",
    name: "Hades",
    origin: "MANUAL",
    type: "BASE_GAME",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    importAt: new Date("2026-01-01T00:00:00.000Z"),
    baseGameId: null,
    libraryEntry: { ...(baseLibraryEntry() as NonNullable<MergeSourceLibraryEntry>), id: "le-a" },
    externalIds: [],
    dlcs: [],
    availability: [],
    collections: [],
    tags: [],
    metadataSnapshots: [],
    wishlistEntry: null,
    compatSnapshots: [],
    envCompat: [],
    duplicatesA: [],
    duplicatesB: [],
    ...overrides,
  } as MergeGraphGame;
}

function makeResolvedPlan(overrides: Partial<ResolvedMergePlan> = {}): ResolvedMergePlan {
  return {
    survivorId: "game-b",
    discardedId: "game-a",
    finalName: "Hades",
    personalValues: {
      playState: "NOT_STARTED",
      isMainGame: false,
      priority: "NONE",
      interest: null,
      rating: null,
      preferredEnvironment: null,
      compatOverrideStatus: null,
      compatOverrideReason: null,
      playSoon: false,
      replayCandidate: false,
      hidden: false,
      notes: null,
    },
    externalKeep: [],
    externalDeleteRowIds: [],
    oneToOneKeep: {},
    ...overrides,
  };
}

describe("resolveMergePlan", () => {
  const proposal = {
    duplicateId: "dup-1",
    games: [
      { id: "game-a", name: "Hades (manual)", origin: "MANUAL", dlcCount: 0 },
      { id: "game-b", name: "Hades", origin: "STEAM_IMPORT", dlcCount: 0 },
    ],
    survivorId: "game-b",
    discardedId: "game-a",
    finalName: "Hades",
    blocked: true,
    library: {
      defaults: { playState: "NOT_STARTED", isMainGame: false, priority: "NONE", notes: null },
      conflicts: [
        {
          field: "rating",
          a: { gameId: "game-a", value: 8 },
          b: { gameId: "game-b", value: 6 },
        },
      ],
    },
    externalIds: {
      union: [{ id: "e3", namespace: "itad", externalId: "aaa" }],
      conflicts: [
        {
          namespace: "steam",
          rows: [
            { id: "e1", externalId: "111", gameId: "game-a" },
            { id: "e2", externalId: "222", gameId: "game-b" },
          ],
        },
      ],
    },
    oneToOne: [
      {
        kind: "wishlist",
        key: "wishlist",
        a: { gameId: "game-a", rowId: "w1" },
        b: { gameId: "game-b", rowId: "w2" },
      },
    ],
    relations: { availability: 0, collections: 0, tags: 0, metadataSnapshots: 0 },
  } as Parameters<typeof resolveMergePlan>[0];

  it("resolves a complete valid set of choices", () => {
    const result = resolveMergePlan(proposal, {
      survivorId: "game-b",
      finalName: "Hades",
      personal: { rating: { side: "a" } },
      externalIds: { steam: { rowId: "e1" } },
      oneToOne: { wishlist: { side: "b" } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.survivorId).toBe("game-b");
      expect(result.plan.discardedId).toBe("game-a");
      expect(result.plan.personalValues.rating).toBe(8);
      expect(result.plan.externalKeep).toContainEqual({
        namespace: "steam",
        rowId: "e1",
      });
      expect(result.plan.externalDeleteRowIds).toContain("e2");
      expect(result.plan.externalKeep).toContainEqual({
        namespace: "itad",
        rowId: "e3",
      });
      expect(result.plan.oneToOneKeep.wishlist).toBe("b");
    }
  });

  it("rejects a custom personal value choice", () => {
    const result = resolveMergePlan(proposal, {
      survivorId: "game-b",
      finalName: "Hades",
      personal: { rating: { value: 7 } },
      externalIds: { steam: { rowId: "e1" } },
      oneToOne: { wishlist: { side: "a" } },
    });

    expect(result).toEqual({
      ok: true,
      plan: expect.objectContaining({ personalValues: expect.objectContaining({ rating: 7 }) }),
    });
  });

  it("rejects a survivor that is not part of the pair", () => {
    const result = resolveMergePlan(proposal, {
      survivorId: "game-zzz",
      finalName: "Hades",
      personal: { rating: { side: "a" } },
      externalIds: { steam: { rowId: "e1" } },
      oneToOne: { wishlist: { side: "a" } },
    });

    expect(result).toEqual({
      ok: false,
      message: "Chosen survivor is not part of this duplicate pair",
    });
  });

  it("rejects a blank final name", () => {
    const result = resolveMergePlan(proposal, {
      survivorId: "game-b",
      finalName: "   ",
      personal: { rating: { side: "a" } },
      externalIds: { steam: { rowId: "e1" } },
      oneToOne: { wishlist: { side: "a" } },
    });

    expect(result).toEqual({ ok: false, message: "Final name is required" });
  });

  it("blocks when a personal conflict has no choice", () => {
    const result = resolveMergePlan(proposal, {
      survivorId: "game-b",
      finalName: "Hades",
      personal: {},
      externalIds: { steam: { rowId: "e1" } },
      oneToOne: { wishlist: { side: "a" } },
    });

    expect(result).toEqual({ ok: false, message: 'Merge blocked: choose a value for "rating"' });
  });

  it("blocks a malformed personal choice", () => {
    const result = resolveMergePlan(proposal, {
      survivorId: "game-b",
      finalName: "Hades",
      personal: { rating: "garbage" } as never,
      externalIds: { steam: { rowId: "e1" } },
      oneToOne: { wishlist: { side: "a" } },
    });

    expect(result.ok).toBe(false);
  });

  it("blocks when the chosen external row is not part of the conflict", () => {
    const result = resolveMergePlan(proposal, {
      survivorId: "game-b",
      finalName: "Hades",
      personal: { rating: { side: "a" } },
      externalIds: { steam: { rowId: "e-other" } },
      oneToOne: { wishlist: { side: "a" } },
    });

    expect(result).toEqual({
      ok: false,
      message: 'Merge blocked: selected external ID is not valid for "steam"',
    });
  });

  it("rejects a missing one-to-one side choice", () => {
    const result = resolveMergePlan(proposal, {
      survivorId: "game-b",
      finalName: "Hades",
      personal: { rating: { side: "a" } },
      externalIds: { steam: { rowId: "e1" } },
      oneToOne: {},
    });

    expect(result).toEqual({
      ok: false,
      message: 'Merge blocked: choose a side for "wishlist"',
    });
  });
});

describe("planMergeMutations", () => {
  function run(
    gameA: MergeGraphGame,
    gameB: MergeGraphGame,
    plan: ResolvedMergePlan = makeResolvedPlan(),
  ) {
    return planMergeMutations({ gameA, gameB, plan });
  }

  it("moves discarded-owned external IDs to the survivor and deletes conflict losers", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      externalIds: [
        { id: "e1", gameId: "game-a", namespace: "steam", externalId: "111" },
        { id: "e2", gameId: "game-a", namespace: "itad", externalId: "aaa" },
      ],
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      externalIds: [{ id: "e3", gameId: "game-b", namespace: "steam", externalId: "222" }],
    });

    const plan = makeResolvedPlan({
      externalKeep: [
        { namespace: "steam", rowId: "e3" },
        { namespace: "itad", rowId: "e2" },
      ],
      externalDeleteRowIds: ["e1"],
    });

    const mutations = run(gameA, gameB, plan);

    expect(mutations.externalIdMoves.map((m) => m.id)).toEqual(["e2"]);
    expect(mutations.externalIdDeletes.map((m) => m.id)).toEqual(["e1"]);
  });

  it("merges a duplicate Steam availability row into the more informative survivor row", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      availability: [
        {
          id: "av-a",
          gameId: "game-a",
          source: "STEAM",
          steamAppId: "1145360",
          steamPlaytimeTotal: BigInt(10),
          steamLastPlayed: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      availability: [
        {
          id: "av-b",
          gameId: "game-b",
          source: "STEAM",
          steamAppId: "1145360",
          steamPlaytimeTotal: BigInt(3),
          steamLastPlayed: new Date("2025-01-01T00:00:00.000Z"),
        },
      ],
    });

    const mutations = run(gameA, gameB, makeResolvedPlan());

    expect(mutations.availabilityMoves).toEqual([]);
    expect(mutations.availabilityDeletes.map((m) => m.id)).toEqual(["av-a"]);
    expect(mutations.availabilityMerges).toEqual([
      {
        rowId: "av-b",
        original: expect.objectContaining({ id: "av-b" }),
        data: { steamPlaytimeTotal: BigInt(10), steamLastPlayed: new Date("2026-02-01T00:00:00.000Z") },
      },
    ]);
  });

  it("moves unique availability rows and deduplicates collections and tags", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      availability: [
        {
          id: "av-a",
          gameId: "game-a",
          source: "ROM",
          steamAppId: null,
          steamPlaytimeTotal: null,
          steamLastPlayed: null,
        },
      ],
      collections: [
        { collectionId: "col-1", gameId: "game-a" },
        { collectionId: "col-2", gameId: "game-a" },
      ],
      tags: [{ tagId: "tag-1", gameId: "game-a" }],
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      collections: [{ collectionId: "col-2", gameId: "game-b" }],
    });

    const mutations = run(gameA, gameB);

    expect(mutations.availabilityMoves.map((m) => m.id)).toEqual(["av-a"]);
    expect(mutations.collectionMoves).toEqual([
      { key: "col-1", row: { collectionId: "col-1", gameId: "game-a" } },
    ]);
    expect(mutations.collectionDeletes).toEqual([
      {
        key: "col-2",
        row: { collectionId: "col-2", gameId: "game-a" },
      },
    ]);
    expect(mutations.tagMoves.map((m) => m.key)).toEqual(["tag-1"]);
  });

  it("keeps the newest metadata snapshot per provider", () => {
    const newer = new Date("2026-02-01T00:00:00.000Z");
    const older = new Date("2025-01-01T00:00:00.000Z");
    const gameA = makeGraphGame({
      id: "game-a",
      metadataSnapshots: [{ id: "m-a", gameId: "game-a", provider: "RAWG", fetchedAt: newer }],
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      metadataSnapshots: [{ id: "m-b", gameId: "game-b", provider: "RAWG", fetchedAt: older }],
    });

    const mutations = run(gameA, gameB);

    expect(mutations.metadataMoves.map((m) => m.id)).toEqual(["m-a"]);
    expect(mutations.metadataDeletes.map((m) => m.id)).toEqual(["m-b"]);
  });

  it("removes the losing wishlist row when a side is chosen", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      wishlistEntry: { id: "w-a", gameId: "game-a" },
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      wishlistEntry: { id: "w-b", gameId: "game-b" },
    });

    const keepA = run(gameA, gameB, makeResolvedPlan({ oneToOneKeep: { wishlist: "a" } }));
    expect(keepA.wishlistMoves.map((m) => m.id)).toEqual(["w-a"]);
    expect(keepA.wishlistDeletes.map((m) => m.id)).toEqual(["w-b"]);

    const keepB = run(gameA, gameB, makeResolvedPlan({ oneToOneKeep: { wishlist: "b" } }));
    expect(keepB.wishlistMoves).toEqual([]);
    expect(keepB.wishlistDeletes.map((m) => m.id)).toEqual(["w-a"]);
  });

  it("moves a one-to-one row that only exists on the discarded side", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      compatSnapshots: [{ id: "c-a", gameId: "game-a", provider: "PROTONDB" }],
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      compatSnapshots: [],
    });

    const mutations = run(gameA, gameB);

    expect(mutations.compatMoves.map((m) => m.id)).toEqual(["c-a"]);
    expect(mutations.compatDeletes).toEqual([]);
  });

  it("applies the chosen side for an environment one-to-one conflict", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      envCompat: [{ id: "v-a", gameId: "game-a", environment: "BAZZITE" }],
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      envCompat: [{ id: "v-b", gameId: "game-b", environment: "BAZZITE" }],
    });

    const mutations = run(gameA, gameB, makeResolvedPlan({ oneToOneKeep: { BAZZITE: "b" } }));

    expect(mutations.envMoves).toEqual([]);
    expect(mutations.envDeletes.map((m) => m.id)).toEqual(["v-a"]);
  });

  it("reassigns all discarded DLC to the survivor", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      dlcs: [
        { id: "d1", name: "DLC 1", baseGameId: "game-a" },
        { id: "d2", name: "DLC 2", baseGameId: "game-a" },
      ],
    });
    const gameB = makeGraphGame({ id: "game-b", origin: "STEAM_IMPORT" });

    const mutations = run(gameA, gameB);

    expect(mutations.dlcMoves.map((m) => m.id)).toEqual(["d1", "d2"]);
    expect(mutations.affectedGameIds.sort()).toEqual(["d1", "d2", "game-a", "game-b"]);
  });

  it("remaps third-game duplicate pairs and drops confirmed or colliding pairs", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      duplicatesA: [
        { id: "dup-ab", gameBId: "game-b", status: "OPEN" },
        { id: "dup-ac", gameBId: "game-c", status: "OPEN" },
      ],
      duplicatesB: [{ id: "dup-ca", gameAId: "game-c", status: "DISMISSED" }],
    });
    const gameB = makeGraphGame({ id: "game-b", origin: "STEAM_IMPORT" });

    const mutations = run(gameA, gameB);

    expect(mutations.duplicateMoves.map((m) => m.id)).toEqual(["dup-ac"]);
    expect(mutations.duplicateDeletes.map((m) => m.id)).toEqual(["dup-ca"]);
    expect(mutations.duplicateMoves[0].row.gameBId).toBe("game-c");
  });

  it("deletes a third-game duplicate when the survivor already has that pair", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      duplicatesB: [{ id: "dup-ca", gameAId: "game-c", status: "OPEN" }],
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      duplicatesA: [{ id: "dup-bc", gameBId: "game-c", status: "OPEN" }],
    });

    const mutations = run(gameA, gameB);

    expect(mutations.duplicateMoves).toEqual([]);
    expect(mutations.duplicateDeletes.map((m) => m.id)).toEqual(["dup-ca"]);
  });

  it("captures an exact snapshot covering the discarded game and all changed rows", () => {
    const gameA = makeGraphGame({
      id: "game-a",
      dlcs: [{ id: "d1-a", name: "DLC", baseGameId: "game-a" }],
      externalIds: [{ id: "e1", gameId: "game-a", namespace: "itad", externalId: "aaa" }],
    });
    const gameB = makeGraphGame({
      id: "game-b",
      origin: "STEAM_IMPORT",
      libraryEntry: { ...(baseLibraryEntry() as NonNullable<MergeSourceLibraryEntry>), id: "le-b", rating: 9 },
    });

    const mutations = run(
      gameA,
      gameB,
      makeResolvedPlan({
        finalName: "Renamed",
        externalKeep: [{ namespace: "itad", rowId: "e1" }],
      }),
    );

    const snapshot = parseSnapshotEnvelope<MergeSnapshotPayload>(
      createSnapshotEnvelope(mutations.snapshot, "MERGE"),
    )?.payload;
    expect(snapshot?.survivorId).toBe("game-b");
    expect(snapshot?.discardedId).toBe("game-a");

    const gameDeletes = snapshot?.records.filter(
      (record) => record.model === "Game" && record.action === "delete",
    );
    expect(gameDeletes).toHaveLength(1);
    expect(gameDeletes?.[0].row.id).toBe("game-a");

    const gameUpdates = snapshot?.records.filter(
      (record) => record.model === "Game" && record.action === "update",
    );
    expect(gameUpdates).toHaveLength(2);

    const libraryUpdates = snapshot?.records.filter(
      (record) => record.model === "LibraryEntry" && record.action === "update",
    );
    expect(libraryUpdates).toHaveLength(1);
    expect(libraryUpdates?.[0].row.id).toBe("le-b");

    expect(
      snapshot?.records.some(
        (record) => record.model === "ExternalGameId" && record.row.gameId === "game-a",
      ),
    ).toBe(true);
  });
});

describe("executeMerge", () => {
  const tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { email: "owner@example.com" },
    });
    (prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } }).user = {
      findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "owner@example.com" }),
      create: vi.fn(),
    };
    transaction.mockImplementation(
      async (fn: (client: unknown) => unknown) => fn(tx),
    );
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;

    const methods = [
      "findUnique", "findFirst", "findMany", "update", "updateMany", "delete", "deleteMany", "create",
    ];
    const models = [
      "possibleDuplicate", "catalogOperation", "game", "libraryEntry", "externalGameId",
      "gameAvailability", "collectionMembership", "gameTag", "metadataSnapshot",
      "wishlistEntry", "compatibilitySnapshot", "environmentCompatibility",
    ];
    for (const model of models) {
      tx[model] = Object.fromEntries(methods.map((method) => [method, vi.fn()]));
    }
    (tx.catalogOperation as { create: ReturnType<typeof vi.fn> }).create.mockResolvedValue({
      id: "op-1",
      state: "PENDING",
      expiresAt: new Date("2026-08-18T12:00:15.000Z"),
    });
    (tx.game as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValue([
      makeGraphGame(),
      makeGraphGame({ id: "game-b", origin: "STEAM_IMPORT", libraryEntry: { ...(baseLibraryEntry() as NonNullable<MergeSourceLibraryEntry>), id: "le-b" } }),
    ]);
    (tx.possibleDuplicate as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({
      id: "dup-1",
      status: "OPEN",
      gameAId: "game-a",
      gameBId: "game-b",
    });
    (tx.catalogOperation as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue(null);
  });

  const validInput = {
    duplicateId: "dup-1",
    survivorId: "game-b",
    finalName: "Hades",
    personal: {},
    externalIds: {},
    oneToOne: {},
  };

  it("merges atomically and creates a PENDING undoable operation", async () => {
    const result = await executeMerge(validInput);

    expect(result.success).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    if (!result.success) return;

    expect(result.data.operationId).toBe("op-1");
    expect(result.data.survivorId).toBe("game-b");
    expect(result.data.discardedId).toBe("game-a");

    const createMock = tx.catalogOperation!.create as ReturnType<typeof vi.fn>;
    const createData = createMock.mock.calls[0][0].data;
    expect(createData.type).toBe("MERGE");
    expect(createData.state).toBe("PENDING");
    expect(createData.userId).toBe("user-1");
    expect(createData.affectedGameIds.sort()).toEqual(["game-a", "game-b"]);
    expect(createData.expiresAt.getTime() - Date.now()).toBeGreaterThan(0);
    expect(createData.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      CATALOG_OPERATION_TTL_MS,
    );
    const envelope = parseSnapshotEnvelope<{
      survivorId: string;
      discardedId: string;
      records: unknown[];
    }>(createData.snapshot);
    expect(envelope).not.toBeNull();
    expect(envelope?.type).toBe("MERGE");
    expect(envelope?.payload.discardedId).toBe("game-a");

    const updateCalls = (tx.game!.update as ReturnType<typeof vi.fn>).mock.calls;
    expect(updateCalls.some((call) => call[0].data.name === "Hades")).toBe(true);
    expect((tx.game!.delete as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      where: { id: "game-a" },
    });
    expect((tx.libraryEntry!.update as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it("rejects malformed input without touching the database", async () => {
    const result = await executeMerge({ ...validInput, finalName: "  " });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("reports a missing or dismissed duplicate inside the transaction", async () => {
    (tx.possibleDuplicate as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValueOnce(
      { id: "dup-1", status: "DISMISSED", gameAId: "game-a", gameBId: "game-b" },
    );

    const result = await executeMerge(validInput);

    expect(result.error).toBe("Duplicate has already been reviewed");
    expect((tx.game!.delete as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("blocks against a pending overlapping operation", async () => {
    (tx.catalogOperation as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue({
      id: "op-pending",
    });

    const result = await executeMerge(validInput);

    expect(result.error).toBe("A recent catalog operation still involves these games");
    expect((tx.game!.delete as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("makes no writes when a conflict lacks a choice", async () => {
    (tx.game! as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValue([
      makeGraphGame({ libraryEntry: { ...(baseLibraryEntry() as NonNullable<MergeSourceLibraryEntry>), id: "le-a", rating: 8 } }),
      makeGraphGame({ id: "game-b", origin: "STEAM_IMPORT", libraryEntry: { ...(baseLibraryEntry() as NonNullable<MergeSourceLibraryEntry>), id: "le-b", rating: 6 } }),
    ]);

    const result = await executeMerge({ ...validInput, personal: {} });

    expect(result.error).toBe('Merge blocked: choose a value for "rating"');
    expect((tx.game!.delete as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect((tx.libraryEntry!.update as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect((tx.catalogOperation!.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated operation owner", async () => {
    (prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn> } }).user.findUnique.mockResolvedValue(
      null,
    );
    (prisma as unknown as { user: { create: ReturnType<typeof vi.fn> } }).user.create.mockResolvedValue(
      null,
    );

    const result = await executeMerge(validInput);

    expect(result.error).toBe("Authentication required");
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("buildDeleteSnapshotPlan", () => {
  it("captures the base game, its DLC subtree, and every cascaded relation", () => {
    const base = makeGraphGame({
      id: "game-a",
      libraryEntry: { ...(baseLibraryEntry() as NonNullable<MergeSourceLibraryEntry>), id: "le-a" },
      externalIds: [{ id: "e1", gameId: "game-a", namespace: "steam", externalId: "111" }],
      availability: [
        {
          id: "av-a",
          gameId: "game-a",
          source: "STEAM",
          steamAppId: "1145360",
          steamPlaytimeTotal: BigInt(10),
          steamLastPlayed: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
      collections: [{ collectionId: "col-1", gameId: "game-a" }],
      tags: [{ tagId: "tag-1", gameId: "game-a" }],
      metadataSnapshots: [{ id: "m1", gameId: "game-a", provider: "RAWG", fetchedAt: new Date("2026-01-01") }],
      wishlistEntry: { id: "w1", gameId: "game-a" },
      compatSnapshots: [{ id: "c1", gameId: "game-a", provider: "PROTONDB" }],
      envCompat: [{ id: "v1", gameId: "game-a", environment: "BAZZITE" }],
      duplicatesA: [{ id: "dup-1", gameBId: "game-c", status: "OPEN" }],
    });
    const dlc = makeGraphGame({
      id: "game-d1",
      name: "DLC 1",
      baseGameId: "game-a",
      libraryEntry: { ...(baseLibraryEntry() as NonNullable<MergeSourceLibraryEntry>), id: "le-d1" },
      externalIds: [{ id: "e2", gameId: "game-d1", namespace: "itad", externalId: "bbb" }],
    });

    const plan = buildDeleteSnapshotPlan(base, [dlc]);

    expect(plan.affectedGameIds.sort()).toEqual(["game-a", "game-d1"]);

    const gameDeletes = plan.snapshot.records
      .filter((record) => record.model === "Game")
      .map((record) => record.row.id);
    expect(gameDeletes.sort()).toEqual(["game-a", "game-d1"]);

    const models = new Set(plan.snapshot.records.map((record) => record.model));
    expect(models).toContain("LibraryEntry");
    expect(models).toContain("ExternalGameId");
    expect(models).toContain("GameAvailability");
    expect(models).toContain("CollectionMembership");
    expect(models).toContain("GameTag");
    expect(models).toContain("MetadataSnapshot");
    expect(models).toContain("WishlistEntry");
    expect(models).toContain("CompatibilitySnapshot");
    expect(models).toContain("EnvironmentCompatibility");
    expect(models).toContain("PossibleDuplicate");

    expect(plan.snapshot.records.every((record) => record.action === "delete")).toBe(true);

    const availabilityRow = plan.snapshot.records.find(
      (record) => record.model === "GameAvailability",
    );
    expect(availabilityRow?.row.steamPlaytimeTotal).toBe("10");
  });

  it("limits an individual DLC deletion to that DLC's rows", () => {
    const dlc = makeGraphGame({
      id: "game-d1",
      name: "DLC 1",
      baseGameId: "game-a",
      libraryEntry: null,
    });

    const plan = buildDeleteSnapshotPlan(dlc, []);

    expect(plan.affectedGameIds).toEqual(["game-d1"]);
    expect(plan.snapshot.records).toEqual([
      expect.objectContaining({ model: "Game", action: "delete", row: expect.objectContaining({ id: "game-d1" }) }),
    ]);
  });
});

describe("previewDelete", () => {
  const mockFindUniqueGame = vi.fn();
  const mockFindFirstOperation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const prismaMock = prisma as unknown as {
      possibleDuplicate: { findUnique: ReturnType<typeof vi.fn> };
      catalogOperation: { findFirst: ReturnType<typeof vi.fn> };
      game: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    };
    prismaMock.catalogOperation = { findFirst: mockFindFirstOperation };
    prismaMock.game = { findUnique: mockFindUniqueGame, findMany: vi.fn() };

    mockFindUniqueGame.mockResolvedValue({
      id: "game-a",
      name: "Hades",
      type: "BASE_GAME",
      baseGameId: null,
      baseGame: null,
      dlcs: [
        { id: "game-d1", name: "Hades OST" },
        { id: "game-d2", name: "Hades Soundtrack" },
      ],
      wishlistEntry: null,
      _count: {
        externalIds: 1,
        availability: 2,
        collections: 3,
        tags: 1,
        metadataSnapshots: 1,
        compatSnapshots: 0,
        envCompat: 1,
      },
    });
    mockFindFirstOperation.mockResolvedValue(null);
  });

  it("returns DLC names and relation counts for a base game", async () => {
    const result = await previewDelete({ gameId: "game-a" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dlc).toEqual([
        { id: "game-d1", name: "Hades OST" },
        { id: "game-d2", name: "Hades Soundtrack" },
      ]);
      expect(result.data.relations).toEqual({
        externalIds: 1,
        availability: 2,
        collections: 3,
        tags: 1,
        metadataSnapshots: 1,
        compatSnapshots: 0,
        envCompat: 1,
        wishlist: false,
      });
    }
  });

  it("rejects a missing game", async () => {
    mockFindUniqueGame.mockResolvedValue(null);

    const result = await previewDelete({ gameId: "game-missing" });

    expect(result.error).toBe("Game not found");
  });

  it("blocks when a pending operation involves the game", async () => {
    mockFindFirstOperation.mockResolvedValue({ id: "op-1" });

    const result = await previewDelete({ gameId: "game-a" });

    expect(result.error).toBe("A recent catalog operation still involves this game");
  });

  it("rejects an invalid game id", async () => {
    const result = await previewDelete({ gameId: "" });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
  });
});

describe("executeDelete", () => {
  const tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { email: "owner@example.com" },
    });
    (prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } }).user = {
      findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "owner@example.com" }),
      create: vi.fn(),
    };
    transaction.mockImplementation(
      async (fn: (client: unknown) => unknown) => fn(tx),
    );
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;

    const methods = [
      "findUnique", "findFirst", "findMany", "update", "updateMany", "delete", "deleteMany", "create",
    ];
    const models = [
      "possibleDuplicate", "catalogOperation", "game", "libraryEntry", "externalGameId",
      "gameAvailability", "collectionMembership", "gameTag", "metadataSnapshot",
      "wishlistEntry", "compatibilitySnapshot", "environmentCompatibility",
    ];
    for (const model of models) {
      tx[model] = Object.fromEntries(methods.map((method) => [method, vi.fn()]));
    }
    (tx.catalogOperation as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue(null);
    (tx.catalogOperation as { create: ReturnType<typeof vi.fn> }).create.mockResolvedValue({
      id: "op-1",
      state: "PENDING",
      expiresAt: new Date("2026-08-18T12:00:15.000Z"),
    });
    (tx.game as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
      makeGraphGame(),
    );
    (tx.game as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValueOnce([]);
    (tx.game as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValueOnce([makeGraphGame()]);
  });

  it("deletes a game and records a PENDING DELETE operation", async () => {
    const result = await executeDelete({ gameId: "game-a" });

    expect(result.success).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    if (!result.success) return;

    expect(result.data.operationId).toBe("op-1");
    expect(result.data.gameId).toBe("game-a");

    expect((tx.game!.delete as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      where: { id: "game-a" },
    });

    const createMock = tx.catalogOperation!.create as ReturnType<typeof vi.fn>;
    const createData = createMock.mock.calls[0][0].data;
    expect(createData.type).toBe("DELETE");
    expect(createData.state).toBe("PENDING");
    expect(createData.affectedGameIds).toEqual(["game-a"]);
    const envelope = parseSnapshotEnvelope<DeleteSnapshotPayload>(createData.snapshot);
    expect(envelope?.type).toBe("DELETE");
    expect(envelope?.payload.gameId).toBe("game-a");
    expect(
      envelope?.payload.records.some(
        (record) => record.model === "Game" && record.row.id === "game-a",
      ),
    ).toBe(true);
  });

  it("deletes the full DLC subtree with a complete affected set", async () => {
    (tx.game as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
      makeGraphGame({ id: "game-a", dlcs: [{ id: "game-d1", name: "DLC", baseGameId: "game-a" }] }),
    );
    (tx.game as { findMany: ReturnType<typeof vi.fn> }).findMany
      .mockReset()
      .mockResolvedValueOnce([{ id: "game-d1" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeGraphGame({ id: "game-a", dlcs: [{ id: "game-d1", name: "DLC", baseGameId: "game-a" }] }),
        makeGraphGame({ id: "game-d1", name: "DLC", baseGameId: "game-a" }),
      ]);

    const result = await executeDelete({ gameId: "game-a" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const createData = (tx.catalogOperation!.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0].data;
    expect(createData.affectedGameIds.sort()).toEqual(["game-a", "game-d1"]);
    const envelope = parseSnapshotEnvelope<DeleteSnapshotPayload>(createData.snapshot as never);
    const gameDeletes = envelope?.payload.records
      .filter((record) => record.model === "Game")
      .map((record) => record.row.id);
    expect(gameDeletes?.sort()).toEqual(["game-a", "game-d1"]);
  });

  it("rejects a missing game without deleting", async () => {
    (tx.game!.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await executeDelete({ gameId: "game-missing" });

    expect(result.error).toBe("Game not found");
    expect((tx.game!.delete as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
    expect((tx.catalogOperation!.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("blocks against a pending overlapping operation", async () => {
    (tx.catalogOperation!.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "op-pending" });

    const result = await executeDelete({ gameId: "game-a" });

    expect(result.error).toBe("A recent catalog operation still involves this game");
    expect((tx.game!.delete as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("rejects invalid input without starting a transaction", async () => {
    const result = await executeDelete({ gameId: "" });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(transaction).not.toHaveBeenCalled();
  });
});

function makeMergeSnapshotEnvelope(
  overrides: Partial<MergeSnapshotPayload> = {},
): ReturnType<typeof createSnapshotEnvelope> {
  return createSnapshotEnvelope(
    {
      survivorId: "game-b",
      discardedId: "game-a",
      records: [
        {
          model: "Game",
          action: "update",
          row: {
            id: "game-b",
            name: "Hades",
            origin: "STEAM_IMPORT",
            type: "BASE_GAME",
            baseGameId: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            importAt: "2026-01-01T00:00:00.000Z",
          },
        },
        {
          model: "Game",
          action: "delete",
          row: {
            id: "game-a",
            name: "Hades (manual)",
            origin: "MANUAL",
            type: "BASE_GAME",
            baseGameId: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            importAt: "2026-01-01T00:00:00.000Z",
          },
        },
        {
          model: "LibraryEntry",
          action: "update",
          row: {
            id: "le-b",
            gameId: "game-b",
            playState: "NOT_STARTED",
            isMainGame: false,
            priority: "NONE",
            interest: null,
            rating: null,
            preferredEnvironment: null,
            compatOverrideStatus: null,
            compatOverrideReason: null,
            playSoon: false,
            replayCandidate: false,
            hidden: false,
            notes: null,
          },
        },
        {
          model: "ExternalGameId",
          action: "update",
          row: {
            id: "e2",
            gameId: "game-a",
            namespace: "itad",
            externalId: "aaa",
          },
        },
      ],
      ...overrides,
    },
    "MERGE",
  );
}

describe("undoOperation", () => {
  const tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const transaction = vi.fn();

  function pendingOperation(overrides: Record<string, unknown> = {}) {
    return {
      id: "op-1",
      userId: "user-1",
      type: "MERGE",
      state: "PENDING",
      affectedGameIds: ["game-a", "game-b"],
      expiresAt: new Date(Date.now() + 10_000),
      snapshot: makeMergeSnapshotEnvelope(),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { email: "owner@example.com" },
    });
    (prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } }).user = {
      findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "owner@example.com" }),
      create: vi.fn(),
    };
    transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;

    const methods = [
      "findUnique", "findFirst", "findMany", "update", "updateMany", "delete", "deleteMany", "create",
    ];
    const models = [
      "possibleDuplicate", "catalogOperation", "game", "libraryEntry", "externalGameId",
      "gameAvailability", "collectionMembership", "gameTag", "metadataSnapshot",
      "wishlistEntry", "dealOffer", "priceRefresh",
      "compatibilitySnapshot", "environmentCompatibility",
    ];
    for (const model of models) {
      tx[model] = Object.fromEntries(methods.map((method) => [method, vi.fn()]));
    }
    (tx.catalogOperation as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
      pendingOperation(),
    );
    (tx.catalogOperation as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue(null);
  });

  it("restores a merge in dependency order and marks it UNDONE", async () => {
    const result = await undoOperation({ operationId: "op-1" });

    expect(result.success).toBe(true);

    const gameCreateMock = tx.game?.create as ReturnType<typeof vi.fn>;
    expect(gameCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: "game-a" }),
      }),
    );

    const libraryUpdateMock = tx.libraryEntry?.update as ReturnType<typeof vi.fn>;
    expect(libraryUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "le-b" },
        data: expect.objectContaining({ rating: null, playState: "NOT_STARTED" }),
      }),
    );

    const externalUpdateMock = tx.externalGameId?.update as ReturnType<typeof vi.fn>;
    expect(externalUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e2" },
        data: expect.objectContaining({ gameId: "game-a" }),
      }),
    );

    expect(tx.catalogOperation?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "op-1" },
        data: expect.objectContaining({ state: "UNDONE" }),
      }),
    );
  });

  it("rejects a missing or foreign operation", async () => {
    (tx.catalogOperation as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(null);

    const result = await undoOperation({ operationId: "op-missing" });

    expect(result.error).toBe("Operation not found");
    expect(tx.catalogOperation?.update).not.toHaveBeenCalled();
  });

  it("rejects an already-finished operation", async () => {
    (tx.catalogOperation as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
      pendingOperation({ state: "UNDONE" }),
    );

    const result = await undoOperation({ operationId: "op-1" });

    expect(result.error).toBe("This operation has already finished");
    expect(tx.catalogOperation?.update).not.toHaveBeenCalled();
  });

  it("marks an expired operation EXPIRED, clears its snapshot, and rejects", async () => {
    (tx.catalogOperation as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
      pendingOperation({ expiresAt: new Date(Date.now() - 1_000) }),
    );

    const result = await undoOperation({ operationId: "op-1" });

    expect(result.error).toBe("The undo window has expired");
    expect(tx.catalogOperation?.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "op-1" },
        data: expect.objectContaining({ state: "EXPIRED" }),
      }),
    );
    expect(tx.game?.create).not.toHaveBeenCalled();
  });

  it("blocks on an overlapping pending operation", async () => {
    (tx.catalogOperation as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValue({
      id: "op-2",
    });

    const result = await undoOperation({ operationId: "op-1" });

    expect(result.error).toBe("A newer operation now involves these games");
    expect(tx.game?.create).not.toHaveBeenCalled();
    expect(tx.catalogOperation?.update).not.toHaveBeenCalled();
  });

  it("leaves the operation pending after a failed restore", async () => {
    (tx.game?.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("unique violation"),
    );

    const result = await undoOperation({ operationId: "op-1" });

    expect(result.success).toBe(false);
    expect(tx.catalogOperation?.update).not.toHaveBeenCalled();
  });

  it("undoes a delete by recreating the deleted game and its rows", async () => {
    (tx.catalogOperation as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue(
      pendingOperation({
        type: "DELETE",
        snapshot: createSnapshotEnvelope(
          {
            gameId: "game-a",
            records: [
              {
                model: "Game",
                action: "delete",
                row: {
                  id: "game-a",
                  name: "Hades",
                  origin: "STEAM_IMPORT",
                  type: "BASE_GAME",
                  baseGameId: null,
                  createdAt: "2026-01-01T00:00:00.000Z",
                  importAt: "2026-01-01T00:00:00.000Z",
                },
              },
              {
                model: "Game",
                action: "delete",
                row: {
                  id: "game-d1",
                  name: "Hades OST",
                  origin: "STEAM_IMPORT",
                  type: "DLC",
                  baseGameId: "game-a",
                  createdAt: "2026-01-01T00:00:00.000Z",
                  importAt: "2026-01-01T00:00:00.000Z",
                },
              },
              {
                model: "LibraryEntry",
                action: "delete",
                row: {
                  id: "le-a",
                  gameId: "game-a",
                  playState: "NOT_STARTED",
                  isMainGame: false,
                  priority: "NONE",
                  interest: null,
                  rating: null,
                  preferredEnvironment: null,
                  compatOverrideStatus: null,
                  compatOverrideReason: null,
                  playSoon: false,
                  replayCandidate: false,
                  hidden: false,
                  notes: null,
                },
              },
            ],
          },
          "DELETE",
        ),
      }),
    );

    const result = await undoOperation({ operationId: "op-1" });

    expect(result.success).toBe(true);
    const gameCreateMock = tx.game?.create as ReturnType<typeof vi.fn>;
    const createdGameIds = gameCreateMock.mock.calls.map((call) => call[0].data.id);
    expect(createdGameIds).toEqual(["game-a", "game-d1"]);
    expect((tx.libraryEntry?.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: "le-a", gameId: "game-a" }),
      }),
    );
    expect(tx.catalogOperation?.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "op-1" },
        data: expect.objectContaining({ state: "UNDONE" }),
      }),
    );
  });
});

describe("getActiveOperations", () => {
  const operationMock = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { email: "owner@example.com" },
    });
    (prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn> } }).user = {
      findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "owner@example.com" }),
    };
    (prisma as unknown as { catalogOperation: typeof operationMock }).catalogOperation = operationMock;
    operationMock.findMany.mockResolvedValue([
      { id: "op-1", type: "MERGE", expiresAt: new Date(Date.now() + 5_000) },
    ]);
    operationMock.updateMany.mockResolvedValue({ count: 0 });
  });

  it("returns the pending unexpired operations", async () => {
    const result = await getActiveOperations();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("op-1");
    }
  });

  it("completes expired pending operations and clears their snapshot", async () => {
    const result = await getActiveOperations();

    expect(result.success).toBe(true);
    expect(operationMock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ state: "PENDING" }),
        data: expect.objectContaining({ state: "COMPLETED" }),
      }),
    );
    expect(operationMock.findMany).toHaveBeenCalled();
  });
});

describe("disjoint and overlapping operations", () => {
  const tx: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { email: "owner@example.com" },
    });
    (prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } }).user = {
      findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "owner@example.com" }),
      create: vi.fn(),
    };
    transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;

    const methods = [
      "findUnique", "findFirst", "findMany", "update", "updateMany", "delete", "deleteMany", "create",
    ];
    const models = [
      "possibleDuplicate", "catalogOperation", "game", "libraryEntry", "externalGameId",
      "gameAvailability", "collectionMembership", "gameTag", "metadataSnapshot",
      "wishlistEntry", "compatibilitySnapshot", "environmentCompatibility",
    ];
    for (const model of models) {
      tx[model] = Object.fromEntries(methods.map((method) => [method, vi.fn()]));
    }
    (tx.catalogOperation as { create: ReturnType<typeof vi.fn> }).create.mockResolvedValue({
      id: "op-1",
      state: "PENDING",
      expiresAt: new Date("2026-08-18T12:00:15.000Z"),
    });
    (tx.possibleDuplicate as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValue({
      id: "dup-1",
      status: "OPEN",
      gameAId: "game-a",
      gameBId: "game-b",
    });
    (tx.game as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValue([
      makeGraphGame(),
      makeGraphGame({
        id: "game-b",
        origin: "STEAM_IMPORT",
        libraryEntry: { ...(baseLibraryEntry() as NonNullable<MergeSourceLibraryEntry>), id: "le-b" },
      }),
    ]);
  });

  it("allows a new merge when a pending operation touches disjoint games", async () => {
    (tx.catalogOperation as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockImplementation(
      ({ where }) => {
        const pending = { id: "op-other", affectedGameIds: ["game-x", "game-y"] };
        const requested = where.affectedGameIds.hasSome as string[];
        const overlaps = requested.some((id) => pending.affectedGameIds.includes(id));
        return Promise.resolve(overlaps ? pending : null);
      },
    );

    const result = await executeMerge({
      duplicateId: "dup-1",
      survivorId: "game-b",
      finalName: "Hades",
      personal: {},
      externalIds: {},
      oneToOne: {},
    });

    expect(result.success).toBe(true);
    expect((tx.catalogOperation!.create as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });
});
