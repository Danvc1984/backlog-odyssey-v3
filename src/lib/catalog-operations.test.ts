import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  CATALOG_OPERATION_TTL_MS,
  SNAPSHOT_VERSION,
  availabilityRowKey,
  createSnapshotEnvelope,
  gameIdsOverlap,
  isOperationExpired,
  isTerminalState,
  isUndoable,
  operationExpiry,
  parseSnapshotEnvelope,
  planMergeMutations,
  buildMergeProposal,
  planExternalIdUnion,
  planOneToOneConflicts,
  resolveOperationUser,
  resolvePersonalFields,
  suggestSurvivor,
  uniqueGameIds,
  type MergeGraphGame,
  type MergeSourceGame,
  type MergeSourceLibraryEntry,
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
  it("does not treat wishlist DLC relations as one-to-one conflicts", () => {
    const result = planOneToOneConflicts(
      { gameId: "game-a", compatSnapshots: [], envCompat: [] },
      { gameId: "game-b", compatSnapshots: [], envCompat: [] },
    );

    expect(result).toEqual([]);
  });

  it("reports compatibility conflicts per shared provider", () => {
    const result = planOneToOneConflicts(
      {
        gameId: "game-a",
        compatSnapshots: [
          { id: "c1", provider: "PROTONDB" },
          { id: "c2", provider: "RAWG" },
        ],
        envCompat: [],
      },
      {
        gameId: "game-b",
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
        compatSnapshots: [],
        envCompat: [{ id: "v1", environment: "BAZZITE" }],
      },
      {
        gameId: "game-b",
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
        compatSnapshots: [{ id: "c1", provider: "PROTONDB" }],
        envCompat: [{ id: "v1", environment: "BAZZITE" }],
      },
      {
        gameId: "game-b",
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
        { id: "a1", source: "STEAM", steamAppId: "1145360", alternativeSourceId: null },
        { id: "a2", source: "ROM", steamAppId: null, alternativeSourceId: null },
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
        { id: "a3", source: "STEAM", steamAppId: "1145360", alternativeSourceId: null },
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

describe("snapshot envelopes", () => {
  it("creates a versioned envelope with an ISO timestamp", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const envelope = createSnapshotEnvelope({ rows: [] }, "MERGE", now);

    expect(envelope).toEqual({
      version: SNAPSHOT_VERSION,
      createdAt: "2026-08-18T12:00:00.000Z",
      type: "MERGE",
      payload: { rows: [] },
    });
  });

  it("round-trips through parse", () => {
    const envelope = createSnapshotEnvelope({ gameId: "g1" }, "DELETE");

    expect(parseSnapshotEnvelope(envelope)).toEqual(envelope);
  });

  it("rejects non-object values", () => {
    expect(parseSnapshotEnvelope(null)).toBeNull();
    expect(parseSnapshotEnvelope("nope")).toBeNull();
    expect(parseSnapshotEnvelope(42)).toBeNull();
  });

  it("rejects an unknown envelope version", () => {
    expect(
      parseSnapshotEnvelope({ version: 2, createdAt: "x", type: "MERGE", payload: {} }),
    ).toBeNull();
  });

  it("rejects an unknown operation type", () => {
    expect(
      parseSnapshotEnvelope({
        version: SNAPSHOT_VERSION,
        createdAt: "x",
        type: "ROLLBACK",
        payload: {},
      }),
    ).toBeNull();
  });

  it("rejects a missing timestamp or payload", () => {
    expect(
      parseSnapshotEnvelope({ version: SNAPSHOT_VERSION, type: "MERGE", payload: {} }),
    ).toBeNull();
    expect(
      parseSnapshotEnvelope({ version: SNAPSHOT_VERSION, createdAt: "x", type: "MERGE" }),
    ).toBeNull();
  });
});

describe("expiry helpers", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("computes expiry as now plus the undo window", () => {
    expect(operationExpiry(now).getTime()).toBe(now.getTime() + CATALOG_OPERATION_TTL_MS);
    expect(operationExpiry(now, 5_000).getTime()).toBe(now.getTime() + 5_000);
  });

  it("treats an operation as expired at and after expiresAt", () => {
    const expiresAt = operationExpiry(now);
    expect(isOperationExpired(expiresAt, now)).toBe(false);
    expect(isOperationExpired(expiresAt, expiresAt)).toBe(true);
    expect(
      isOperationExpired(expiresAt, new Date(expiresAt.getTime() + 1)),
    ).toBe(true);
  });
});

describe("operation states", () => {
  const now = new Date("2026-08-18T12:00:00.000Z");

  it("classifies terminal states", () => {
    expect(isTerminalState("PENDING")).toBe(false);
    expect(isTerminalState("UNDONE")).toBe(true);
    expect(isTerminalState("EXPIRED")).toBe(true);
    expect(isTerminalState("COMPLETED")).toBe(true);
  });

  it("only allows undo while PENDING and before expiry", () => {
    const pending = {
      state: "PENDING" as const,
      expiresAt: new Date(now.getTime() + 10_000),
    };
    expect(isUndoable(pending, now)).toBe(true);

    const expired = {
      state: "PENDING" as const,
      expiresAt: now,
    };
    expect(isUndoable(expired, now)).toBe(false);

    expect(isUndoable({ state: "UNDONE", expiresAt: pending.expiresAt }, now)).toBe(false);
    expect(isUndoable({ state: "EXPIRED", expiresAt: pending.expiresAt }, now)).toBe(false);
    expect(isUndoable({ state: "COMPLETED", expiresAt: pending.expiresAt }, now)).toBe(false);
  });
});

describe("overlap detection", () => {
  it("detects a shared affected game", () => {
    expect(gameIdsOverlap(["g1", "g2"], ["g2", "g3"])).toBe(true);
    expect(gameIdsOverlap(["g1"], ["g1"])).toBe(true);
  });

  it("allows disjoint operations", () => {
    expect(gameIdsOverlap(["g1", "g2"], ["g3", "g4"])).toBe(false);
  });

  it("treats empty sides as non-overlapping", () => {
    expect(gameIdsOverlap([], ["g1"])).toBe(false);
    expect(gameIdsOverlap(["g1"], [])).toBe(false);
    expect(gameIdsOverlap([], [])).toBe(false);
  });

  it("deduplicates affected game ids", () => {
    expect(uniqueGameIds(["g1", "g2", "g1"])).toEqual(["g1", "g2"]);
    expect(uniqueGameIds([])).toEqual([]);
  });
});

describe("operation user lookup", () => {
  const findUnique = vi.fn();
  const create = vi.fn();
  const client = { user: { findUnique, create } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the existing user by email", async () => {
    findUnique.mockResolvedValue({ id: "user-1", email: "owner@example.com" });

    const result = await resolveOperationUser("owner@example.com", client);

    expect(result).toEqual({ id: "user-1" });
    expect(findUnique).toHaveBeenCalledWith({ where: { email: "owner@example.com" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the user when no row exists", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "user-2" });

    const result = await resolveOperationUser("owner@example.com", client);

    expect(result).toEqual({ id: "user-2" });
    expect(create).toHaveBeenCalledWith({ data: { email: "owner@example.com" } });
  });

  it("returns null and performs no database access for a missing email", async () => {
    const result = await resolveOperationUser(undefined, client);

    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("returns null and performs no database access for a blank email", async () => {
    const result = await resolveOperationUser("   ", client);

    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("availabilityRowKey", () => {
  const row = (overrides: Partial<MergeGraphGame["availability"][number]> = {}) => ({
    id: "a1",
    source: "OTHER_PLATFORM",
    steamAppId: null,
    alternativeSourceId: "as-1",
    displayName: null,
    steamPlaytimeTotal: null,
    steamLastPlayed: null,
    ...overrides,
  });

  it("keys Steam rows by app id and collapses missing app ids", () => {
    expect(availabilityRowKey(row({ source: "STEAM", steamAppId: "620" }))).toBe("steam:620");
    expect(availabilityRowKey(row({ source: "STEAM", steamAppId: "620" }))).toBe(
      availabilityRowKey(row({ source: "STEAM", steamAppId: "620" })),
    );
    expect(availabilityRowKey(row({ source: "STEAM", steamAppId: null }))).toBe("steam:");
    expect(availabilityRowKey(row({ source: "STEAM", steamAppId: null }))).toBe(
      availabilityRowKey(row({ source: "STEAM", steamAppId: null })),
    );
    expect(availabilityRowKey(row({ source: "STEAM", steamAppId: "620" }))).not.toBe(
      availabilityRowKey(row({ source: "STEAM", steamAppId: null })),
    );
  });

  it("keys ROM rows by source and OTHER_PLATFORM rows by source id", () => {
    expect(availabilityRowKey(row({ source: "ROM" }))).toBe("builtin:ROM");
    expect(availabilityRowKey(row())).toBe("other:as-1");
    expect(availabilityRowKey(row({ alternativeSourceId: "as-2" }))).toBe("other:as-2");
    expect(availabilityRowKey(row({ alternativeSourceId: "as-1" }))).toBe(
      availabilityRowKey(row()),
    );
    expect(availabilityRowKey(row({ source: "ROM" }))).not.toBe(
      availabilityRowKey(row({ source: "STEAM" })),
    );
  });
});

describe("planMergeMutations availability union", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const at = (day: number) => new Date(now.getTime() + day * 24 * 60 * 60 * 1000);

  const makeGame = (
    id: string,
    availability: MergeGraphGame["availability"],
  ): MergeGraphGame => ({
    id,
    name: `Game ${id}`,
    origin: "MANUAL",
    type: "BASE_GAME",
    createdAt: at(0),
    updatedAt: at(0),
    importAt: at(0),
    baseGameId: null,
    libraryEntry: null,
    externalIds: [],
    dlcs: [],
    availability,
    collections: [],
    tags: [],
    metadataSnapshots: [],
    wishlistDlcs: [],
    compatSnapshots: [],
    envCompat: [],
    duplicatesA: [],
    duplicatesB: [],
  });

  const availabilityRow = (
    overrides: Partial<MergeGraphGame["availability"][number]> & { id: string; source: string },
  ): MergeGraphGame["availability"][number] => ({
    gameId: "survivor",
    steamAppId: null,
    alternativeSourceId: null,
    displayName: null,
    steamPlaytimeTotal: null,
    steamLastPlayed: null,
    ...overrides,
  });

  const plan = {
    survivorId: "survivor",
    discardedId: "discarded",
    finalName: "Merged",
    personalValues: {},
    externalKeep: [],
    externalDeleteRowIds: [],
    oneToOneKeep: {},
  };

  const snapshotFor = (records: { row: Record<string, unknown> }[], id: string) =>
    records.find((record) => record.row.id === id);

  it("folds a duplicate ROM row into the survivor without a display-name change", () => {
    const gameA = makeGame("survivor", [
      availabilityRow({ id: "r1", source: "ROM", displayName: "My ROM" }),
    ]);
    const gameB = makeGame("discarded", [
      availabilityRow({ id: "r2", source: "ROM", displayName: null }),
    ]);

    const result = planMergeMutations({ gameA, gameB, plan });

    expect(result.availabilityMoves).toEqual([]);
    expect(result.availabilityDeletes.map((d) => d.id)).toEqual(["r2"]);
    expect(result.availabilityMerges).toEqual([]);
    expect(snapshotFor(result.snapshot.records, "r2")).toMatchObject({
      model: "GameAvailability",
      action: "delete",
    });
    expect(snapshotFor(result.snapshot.records, "r1")).toBeUndefined();
  });

  it("folds an OTHER_PLATFORM duplicate and fills the survivor display name", () => {
    const gameA = makeGame("survivor", [
      availabilityRow({
        id: "o1",
        source: "OTHER_PLATFORM",
        alternativeSourceId: "as-1",
        displayName: null,
      }),
    ]);
    const gameB = makeGame("discarded", [
      availabilityRow({
        id: "o2",
        source: "OTHER_PLATFORM",
        alternativeSourceId: "as-1",
        displayName: "GOG version",
      }),
    ]);

    const result = planMergeMutations({ gameA, gameB, plan });

    expect(result.availabilityMoves).toEqual([]);
    expect(result.availabilityDeletes.map((d) => d.id)).toEqual(["o2"]);
    expect(result.availabilityMerges).toMatchObject([
      { rowId: "o1", data: { displayName: "GOG version" } },
    ]);
    expect(snapshotFor(result.snapshot.records, "o1")).toMatchObject({
      model: "GameAvailability",
      action: "update",
      row: { displayName: null },
    });
    expect(snapshotFor(result.snapshot.records, "o2")).toMatchObject({
      model: "GameAvailability",
      action: "delete",
    });
  });

  it("folds an OTHER_PLATFORM duplicate but keeps the survivor name", () => {
    const gameA = makeGame("survivor", [
      availabilityRow({
        id: "o1",
        source: "OTHER_PLATFORM",
        alternativeSourceId: "as-1",
        displayName: "Existing name",
      }),
    ]);
    const gameB = makeGame("discarded", [
      availabilityRow({
        id: "o2",
        source: "OTHER_PLATFORM",
        alternativeSourceId: "as-1",
        displayName: "Other name",
      }),
    ]);

    const result = planMergeMutations({ gameA, gameB, plan });

    expect(result.availabilityMoves).toEqual([]);
    expect(result.availabilityDeletes.map((d) => d.id)).toEqual(["o2"]);
    expect(result.availabilityMerges).toEqual([]);
    expect(snapshotFor(result.snapshot.records, "o1")).toBeUndefined();
    expect(snapshotFor(result.snapshot.records, "o2")).toMatchObject({
      model: "GameAvailability",
      action: "delete",
    });
  });

  it("unions distinct sources normally", () => {
    const gameA = makeGame("survivor", [
      availabilityRow({ id: "s1", source: "STEAM", steamAppId: "620" }),
      availabilityRow({ id: "o1", source: "OTHER_PLATFORM", alternativeSourceId: "as-1" }),
    ]);
    const gameB = makeGame("discarded", [
      availabilityRow({ id: "r1", source: "ROM" }),
      availabilityRow({ id: "o2", source: "OTHER_PLATFORM", alternativeSourceId: "as-2" }),
    ]);

    const result = planMergeMutations({ gameA, gameB, plan });

    expect(result.availabilityDeletes).toEqual([]);
    expect(result.availabilityMerges).toEqual([]);
    expect(result.availabilityMoves.map((m) => m.id)).toEqual(["r1", "o2"]);
    expect(snapshotFor(result.snapshot.records, "r1")).toMatchObject({
      model: "GameAvailability",
      action: "update",
    });
    expect(snapshotFor(result.snapshot.records, "o2")).toMatchObject({
      model: "GameAvailability",
      action: "update",
    });
  });

  it("still merges Steam duplicates by app id", () => {
    const low = availabilityRow({
      id: "s1",
      source: "STEAM",
      steamAppId: "620",
      steamPlaytimeTotal: BigInt(10),
      steamLastPlayed: at(1),
    });
    const high = availabilityRow({
      id: "s2",
      source: "STEAM",
      steamAppId: "620",
      steamPlaytimeTotal: BigInt(40),
      steamLastPlayed: at(2),
    });

    const result = planMergeMutations({
      gameA: makeGame("survivor", [low]),
      gameB: makeGame("discarded", [high]),
      plan,
    });

    expect(result.availabilityDeletes.map((d) => d.id)).toEqual(["s2"]);
    expect(result.availabilityMerges).toMatchObject([
      { rowId: "s1", data: { steamPlaytimeTotal: BigInt(40) } },
    ]);
    expect(snapshotFor(result.snapshot.records, "s2")).toMatchObject({
      model: "GameAvailability",
      action: "delete",
    });
  });
});
