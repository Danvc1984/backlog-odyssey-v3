import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { startCompatibilitySweep } from "./compat-batch-enrichment";

describe("compatibility sweep action", () => {
  const findActiveBatch = vi.fn();
  const findGames = vi.fn();
  const createBatch = vi.fn();
  const upsertJob = vi.fn();
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    transaction.mockImplementation(async (callback) => callback({
      syncRun: { findFirst: findActiveBatch, create: createBatch },
      game: { findMany: findGames },
      enrichmentJob: { upsert: upsertJob },
    }));
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
    (prisma as unknown as { syncRun: { findFirst: typeof findActiveBatch } }).syncRun = {
      findFirst: findActiveBatch,
    };
    findActiveBatch.mockResolvedValue(null);
    findGames.mockResolvedValue([]);
    createBatch.mockResolvedValue({ id: "batch-1", status: "RUNNING" });
    upsertJob.mockResolvedValue({});
  });

  it("rejects invalid input before opening a transaction", async () => {
    await expect(startCompatibilitySweep({ unexpected: true })).resolves.toEqual({
      success: false,
      data: null,
      error: "Invalid input",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns the active batch without creating duplicate work", async () => {
    findActiveBatch.mockResolvedValue({ id: "batch-active", status: "RUNNING" });

    await expect(startCompatibilitySweep({})).resolves.toEqual({
      success: true,
      data: { kind: "ACTIVE_BATCH", batchId: "batch-active", status: "RUNNING" },
      error: null,
    });
    expect(findGames).not.toHaveBeenCalled();
    expect(createBatch).not.toHaveBeenCalled();
  });

  it("queues eligible games and reports active and ineligible skips", async () => {
    findGames.mockResolvedValue([
      {
        id: "game-eligible",
        libraryEntry: { id: "library-1" },
        externalIds: [{ namespace: "STEAM_APP" }],
        availability: [{ source: "STEAM" }],
        enrichmentJobs: [{ status: "SUCCEEDED" }],
      },
      {
        id: "game-active",
        libraryEntry: { id: "library-2" },
        externalIds: [{ namespace: "STEAM_APP" }],
        availability: [{ source: "STEAM" }],
        enrichmentJobs: [{ status: "RUNNING" }],
      },
      {
        id: "game-rom",
        libraryEntry: { id: "library-3" },
        externalIds: [{ namespace: "STEAM_APP" }],
        availability: [{ source: "ROM" }],
        enrichmentJobs: [],
      },
      {
        id: "game-hidden",
        libraryEntry: { id: "library-hidden", hidden: true },
        externalIds: [{ namespace: "STEAM_APP" }],
        availability: [{ source: "STEAM" }],
        enrichmentJobs: [],
      },
    ]);

    await expect(startCompatibilitySweep({})).resolves.toMatchObject({
      success: true,
      data: {
        kind: "BATCH",
        batchId: "batch-1",
        counts: { eligible: 1, queued: 1, skippedActiveWork: 1, skippedIneligible: 1 },
      },
    });
    expect(upsertJob).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId_provider: { gameId: "game-eligible", provider: "PROTONDB" } },
      create: expect.objectContaining({ syncRunId: "batch-1", status: "QUEUED" }),
    }));
    expect(findGames).toHaveBeenCalledWith(expect.objectContaining({
      where: { type: "BASE_GAME", libraryEntry: { is: { hidden: false } } },
    }));
  });

  it("returns no-eligible without creating an empty batch", async () => {
    await expect(startCompatibilitySweep({})).resolves.toMatchObject({
      data: {
        kind: "NO_ELIGIBLE",
        counts: { eligible: 0, queued: 0, skippedActiveWork: 0, skippedIneligible: 0 },
      },
    });
    expect(createBatch).not.toHaveBeenCalled();
    expect(upsertJob).not.toHaveBeenCalled();
  });
});
