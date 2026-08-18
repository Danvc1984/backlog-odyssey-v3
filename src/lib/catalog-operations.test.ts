import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  CATALOG_OPERATION_TTL_MS,
  SNAPSHOT_VERSION,
  createSnapshotEnvelope,
  gameIdsOverlap,
  isOperationExpired,
  isTerminalState,
  isUndoable,
  operationExpiry,
  parseSnapshotEnvelope,
  resolveOperationUser,
  uniqueGameIds,
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
