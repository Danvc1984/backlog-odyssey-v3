import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { prisma } from "@/lib/prisma";
import { queueRawgForImportedGames } from "./rawg-import-queue";

describe("queueRawgForImportedGames", () => {
  const findGames = vi.fn();
  const findActiveBatch = vi.fn();
  const createBatch = vi.fn();
  const upsertJob = vi.fn();
  const findBatchJobs = vi.fn();
  const updateBatch = vi.fn();
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callback) => callback({
      game: { findMany: findGames },
      syncRun: {
        findFirst: findActiveBatch,
        create: createBatch,
        update: updateBatch,
      },
      enrichmentJob: { upsert: upsertJob, findMany: findBatchJobs },
    }));
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
    findGames.mockResolvedValue([]);
    findActiveBatch.mockResolvedValue(null);
    createBatch.mockResolvedValue({ id: "batch-new" });
    findBatchJobs.mockResolvedValue([{ status: "QUEUED" }]);
    upsertJob.mockResolvedValue({});
    updateBatch.mockResolvedValue({});
  });

  it("does nothing for empty input", async () => {
    await expect(queueRawgForImportedGames([])).resolves.toEqual({
      batchId: null,
      queued: 0,
      skipped: 0,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("normalizes duplicate IDs and skips games with metadata or active work", async () => {
    findGames.mockResolvedValue([
      { id: "eligible", metadataSnapshots: [], enrichmentJobs: [{ status: "FAILED" }] },
      { id: "metadata", metadataSnapshots: [{ id: "snapshot" }], enrichmentJobs: [] },
      { id: "active", metadataSnapshots: [], enrichmentJobs: [{ status: "RUNNING" }] },
    ]);

    await expect(queueRawgForImportedGames(["eligible", "eligible", "metadata", "active"])).resolves.toEqual({
      batchId: "batch-new",
      queued: 1,
      skipped: 2,
    });
    expect(findGames).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ["eligible", "metadata", "active"] } }),
    }));
    expect(upsertJob).toHaveBeenCalledTimes(1);
    expect(upsertJob).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId_provider: { gameId: "eligible", provider: "RAWG" } },
      update: expect.objectContaining({ status: "QUEUED", syncRunId: "batch-new" }),
    }));
  });

  it("reuses the active RAWG batch and refreshes its counts", async () => {
    findGames.mockResolvedValue([
      { id: "eligible", metadataSnapshots: [], enrichmentJobs: [] },
    ]);
    findActiveBatch.mockResolvedValue({ id: "batch-active" });
    findBatchJobs.mockResolvedValue([
      { status: "SUCCEEDED" },
      { status: "QUEUED" },
    ]);

    await expect(queueRawgForImportedGames(["eligible"])).resolves.toEqual({
      batchId: "batch-active",
      queued: 1,
      skipped: 0,
    });
    expect(createBatch).not.toHaveBeenCalled();
    expect(updateBatch).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "batch-active" },
      data: expect.objectContaining({
        status: "RUNNING",
        counts: expect.objectContaining({ total: 2, queued: 1, succeeded: 1 }),
      }),
    }));
  });

  it("creates a batch only when it has eligible work", async () => {
    findGames.mockResolvedValue([
      { id: "metadata", metadataSnapshots: [{ id: "snapshot" }], enrichmentJobs: [] },
    ]);

    await expect(queueRawgForImportedGames(["metadata", "unknown"])).resolves.toEqual({
      batchId: null,
      queued: 0,
      skipped: 2,
    });
    expect(createBatch).not.toHaveBeenCalled();
    expect(upsertJob).not.toHaveBeenCalled();
  });
});
