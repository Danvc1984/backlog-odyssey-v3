import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./wishlist-compatibility-runner", () => ({
  runWishlistCompatibilityRefresh: vi.fn(),
}));

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { runWishlistCompatibilityRefresh } from "./wishlist-compatibility-runner";
import {
  classifyWishlistCompatEntry,
  emptySweepCounts,
  processWishlistCompatSweepEntries,
  startWishlistCompatSweep,
  runWishlistCompatSweep,
  sweepStatusFromCounts,
  type WishlistCompatSweepCounts,
} from "./wishlist-compat-sweep";

const now = new Date("2026-08-26T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const baseEntry = {
  id: "wish-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  type: "BASE_GAME",
  steamAppId: "620",
  steamAppIdProvenance: "USER",
};

describe("classifyWishlistCompatEntry", () => {
  it("skips DLC wishes", () => {
    expect(classifyWishlistCompatEntry({ ...baseEntry, type: "DLC" }, [], now)).toEqual({
      kind: "skip",
      reason: "DLC",
    });
  });

  it("skips wishes without a confirmed identity", () => {
    expect(classifyWishlistCompatEntry({ ...baseEntry, steamAppId: null }, [], now)).toEqual({
      kind: "skip",
      reason: "STEAM_ID_REQUIRED",
    });
    expect(
      classifyWishlistCompatEntry({ ...baseEntry, steamAppIdProvenance: null }, [], now),
    ).toEqual({ kind: "skip", reason: "STEAM_ID_PROVENANCE_REQUIRED" });
  });

  it("refreshes when there is no evidence at all", () => {
    expect(classifyWishlistCompatEntry(baseEntry, [], now)).toEqual({ kind: "refresh" });
  });

  it("refreshes when every snapshot is older than the 180-day window", () => {
    const stale = new Date(now.getTime() - 180 * DAY_MS - 1);
    expect(classifyWishlistCompatEntry(baseEntry, [stale], now)).toEqual({ kind: "refresh" });
  });

  it("treats evidence fetched exactly at the 180-day boundary as up to date", () => {
    const boundary = new Date(now.getTime() - 180 * DAY_MS);
    expect(classifyWishlistCompatEntry(baseEntry, [boundary], now)).toEqual({ kind: "upToDate" });
  });

  it("treats evidence fetched within the window as up to date", () => {
    const fresh = new Date(now.getTime() - 10 * DAY_MS);
    expect(classifyWishlistCompatEntry(baseEntry, [fresh], now)).toEqual({ kind: "upToDate" });
  });

  it("treats an entry with any fresh snapshot as up to date", () => {
    const fresh = new Date(now.getTime() - 5 * DAY_MS);
    const stale = new Date(now.getTime() - 200 * DAY_MS);
    expect(classifyWishlistCompatEntry(baseEntry, [stale, fresh], now)).toEqual({
      kind: "upToDate",
    });
  });
});

describe("sweepStatusFromCounts", () => {
  const counts = (overrides: Partial<WishlistCompatSweepCounts>): WishlistCompatSweepCounts => ({
    total: 0,
    refreshed: 0,
    upToDate: 0,
    failed: 0,
    ...overrides,
  });

  it("reports SUCCESS when every attempted entry refreshed", () => {
    expect(sweepStatusFromCounts(counts({ total: 3, refreshed: 3 }))).toBe("SUCCESS");
  });

  it("reports SUCCESS with zeros when nothing needed a refresh", () => {
    expect(sweepStatusFromCounts(counts({ total: 0 }))).toBe("SUCCESS");
    expect(sweepStatusFromCounts(counts({ total: 4, upToDate: 4 }))).toBe("SUCCESS");
  });

  it("reports PARTIAL when at least one entry failed but others succeeded", () => {
    expect(sweepStatusFromCounts(counts({ total: 3, refreshed: 2, failed: 1 }))).toBe("PARTIAL");
  });

  it("reports FAILED when attempts happened but none succeeded", () => {
    expect(sweepStatusFromCounts(counts({ total: 2, failed: 2 }))).toBe("FAILED");
  });
});

const mockRecoveryFindFirst = vi.fn();
const mockActiveFindFirst = vi.fn();
const mockSweepFindFirst = vi.fn();
const mockSweepCreate = vi.fn();
const mockSweepUpdate = vi.fn();
const mockSweepUpdateMany = vi.fn();
const mockEntryFindMany = vi.fn();
const mockSnapshotFindMany = vi.fn();

function configurePrisma() {
  mockSweepFindFirst.mockImplementation(
    (args: { where: { requestedAt?: unknown } }) =>
      args.where.requestedAt !== undefined ? mockRecoveryFindFirst() : mockActiveFindFirst(),
  );
  (prisma as unknown as Record<string, unknown>).wishlistCompatSweep = {
    findFirst: mockSweepFindFirst,
    create: mockSweepCreate,
    update: mockSweepUpdate,
    updateMany: mockSweepUpdateMany,
  };
  (prisma as unknown as Record<string, unknown>).wishlistEntry = { findMany: mockEntryFindMany };
  (prisma as unknown as Record<string, unknown>).wishlistCompatibilitySnapshot = {
    findMany: mockSnapshotFindMany,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  configurePrisma();
  mockRecoveryFindFirst.mockResolvedValue(null);
  mockActiveFindFirst.mockResolvedValue({ id: "sweep-active" });
  mockSweepCreate.mockResolvedValue({ id: "sweep-run-1" });
  mockSweepUpdateMany.mockResolvedValue({ count: 0 });
  mockSweepUpdate.mockResolvedValue({ id: "sweep-run-1" });
  mockEntryFindMany.mockResolvedValue([]);
  mockSnapshotFindMany.mockResolvedValue([]);
  vi.mocked(runWishlistCompatibilityRefresh).mockResolvedValue({
    success: true,
    data: { fetchedAt: now.toISOString(), snapshotCount: 2, environmentCount: 3 },
    error: null,
  });
});

const sweepEntry = (
  id: string,
  overrides: Partial<{ type: string; steamAppId: string | null; steamAppIdProvenance: string | null }> = {},
) => ({
  id,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  type: "BASE_GAME",
  steamAppId: "620",
  steamAppIdProvenance: "USER",
  ...overrides,
});

describe("startWishlistCompatSweep", () => {
  it("recovers an abandoned run before claiming", async () => {
    mockRecoveryFindFirst.mockResolvedValue({ id: "sweep-stale" });

    await startWishlistCompatSweep(now);

    expect(mockSweepUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sweep-stale", status: "RUNNING" },
        data: { status: "FAILED", finishedAt: now },
      }),
    );
  });

  it("only treats runs older than the 15-minute window as abandoned", async () => {
    const younger = new Date(now.getTime() - 60 * 1000);

    await startWishlistCompatSweep(younger);

    expect(mockRecoveryFindFirst).toHaveBeenCalledTimes(1);
    const call = mockSweepFindFirst.mock.calls[0][0] as {
      where: { requestedAt: { lt: Date } };
    };
    expect(call.where.requestedAt.lt.getTime()).toBe(younger.getTime() - 15 * 60 * 1000);
    expect(mockSweepUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses with the active run when one is RUNNING", async () => {
    mockEntryFindMany.mockResolvedValue([sweepEntry("w1")]);
    mockSweepCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );

    const result = await startWishlistCompatSweep(now);

    expect(result).toEqual({ ok: false, reason: "already-running", runId: "sweep-active" });
  });

  it("claims the run and stages only stale or evidence-less entries for refresh", async () => {
    const fresh = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    mockEntryFindMany.mockResolvedValue([
      sweepEntry("w-stale"),
      sweepEntry("w-fresh"),
      sweepEntry("w-dlc", { type: "DLC" }),
    ]);
    mockSnapshotFindMany.mockResolvedValue([{ wishlistEntryId: "w-fresh", fetchedAt: fresh }]);

    const result = await startWishlistCompatSweep(now);

    expect(result).toEqual({
      ok: true,
      runId: "sweep-run-1",
      total: 3,
      upToDate: 1,
      refreshIds: ["w-stale"],
    });
    expect(mockSnapshotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { wishlistEntryId: { in: ["w-stale", "w-fresh", "w-dlc"] } },
      }),
    );
    expect(mockSweepCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "RUNNING", counts: emptySweepCounts(3, 1) },
      }),
    );
  });

  it("stages an empty refresh list when there are no eligible wishes", async () => {
    const result = await startWishlistCompatSweep(now);

    expect(result).toEqual({
      ok: true,
      runId: "sweep-run-1",
      total: 0,
      upToDate: 0,
      refreshIds: [],
    });
    expect(mockSnapshotFindMany).not.toHaveBeenCalled();
  });
});

describe("runWishlistCompatSweep", () => {
  it("finishes a zero-eligible run as SUCCESS with zero counts and no fetches", async () => {
    const result = await runWishlistCompatSweep();

    expect(result).toEqual({ ok: true, runId: "sweep-run-1" });
    expect(runWishlistCompatibilityRefresh).not.toHaveBeenCalled();
    expect(mockSweepUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sweep-run-1" },
        data: expect.objectContaining({
          status: "SUCCESS",
          counts: { total: 0, refreshed: 0, upToDate: 0, failed: 0 },
          finishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("isolates per-entry failures while refreshing in selection order", async () => {
    const calls: string[] = [];
    mockEntryFindMany.mockResolvedValue([sweepEntry("w1"), sweepEntry("w2"), sweepEntry("w3")]);
    vi.mocked(runWishlistCompatibilityRefresh).mockImplementation(async (id: string) => {
      calls.push(id);
      if (id === "w2") throw new Error("provider exploded");
      if (id === "w3") return { success: false, data: null, error: "provider unavailable" };
      return { success: true, data: null, error: null };
    });

    await runWishlistCompatSweep();

    expect(calls).toEqual(["w1", "w2", "w3"]);
    expect(mockSweepUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sweep-run-1" },
        data: expect.objectContaining({
          status: "PARTIAL",
          counts: { total: 3, refreshed: 1, upToDate: 0, failed: 2 },
        }),
      }),
    );
  });

  it("maps a run where every attempt failed to FAILED", async () => {
    mockEntryFindMany.mockResolvedValue([sweepEntry("w1"), sweepEntry("w2")]);
    vi.mocked(runWishlistCompatibilityRefresh).mockResolvedValue({
      success: false,
      data: null,
      error: "provider unavailable",
    });

    await runWishlistCompatSweep();

    expect(mockSweepUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sweep-run-1" },
        data: expect.objectContaining({
          status: "FAILED",
          counts: { total: 2, refreshed: 0, upToDate: 0, failed: 2 },
        }),
      }),
    );
  });

  it("keeps already-up-to-date entries out of the fetch loop but in the counts", async () => {
    const fresh = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    mockEntryFindMany.mockResolvedValue([sweepEntry("w1"), sweepEntry("w2")]);
    mockSnapshotFindMany.mockResolvedValue([
      { wishlistEntryId: "w2", fetchedAt: fresh },
      { wishlistEntryId: "w2", fetchedAt: new Date("2020-01-01T00:00:00.000Z") },
    ]);
    let attempted = 0;
    vi.mocked(runWishlistCompatibilityRefresh).mockImplementation(async () => {
      attempted += 1;
      return { success: true, data: null, error: null };
    });

    await runWishlistCompatSweep();

    expect(attempted).toBe(1);
    expect(vi.mocked(runWishlistCompatibilityRefresh)).toHaveBeenCalledWith("w1");
    expect(mockSweepUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sweep-run-1" },
        data: expect.objectContaining({
          status: "SUCCESS",
          counts: { total: 2, refreshed: 1, upToDate: 1, failed: 0 },
        }),
      }),
    );
  });

  it("propagates an overlapping start as already-running", async () => {
    mockEntryFindMany.mockResolvedValue([sweepEntry("w1")]);
    mockSweepCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );

    const result = await runWishlistCompatSweep();

    expect(result).toEqual({ ok: false, reason: "already-running", runId: "sweep-active" });
    expect(runWishlistCompatibilityRefresh).not.toHaveBeenCalled();
  });

  it("runs at most five refreshes at once before starting the next chunk", async () => {
    let releaseFirstChunk: (() => void) | undefined;
    const firstChunk = new Promise<void>((resolve) => {
      releaseFirstChunk = resolve;
    });
    const calls: string[] = [];
    vi.mocked(runWishlistCompatibilityRefresh).mockImplementation(async (id: string) => {
      calls.push(id);
      if (id === "w1") await firstChunk;
      return { success: true, data: null, error: null };
    });

    const processing = processWishlistCompatSweepEntries(["w1", "w2", "w3", "w4", "w5", "w6"]);
    await vi.waitFor(() => expect(calls).toHaveLength(5));
    expect(calls).not.toContain("w6");

    releaseFirstChunk?.();
    await expect(processing).resolves.toEqual({ refreshed: 6, failed: 0 });
    expect(calls).toEqual(["w1", "w2", "w3", "w4", "w5", "w6"]);
  });
});
