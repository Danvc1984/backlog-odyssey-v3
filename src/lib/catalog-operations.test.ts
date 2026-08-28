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
  resolveOperationUser,
  uniqueGameIds,
  type MergeGraphGame,
} from "./catalog-operations";

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
