import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/enrichment-batch-summary", () => ({
  batchSummary: vi.fn((jobs: Array<{ status: string }>) => ({
    status: "RUNNING",
    counts: { queued: jobs.length },
  })),
}));
vi.mock("@/lib/igdb-job", () => ({
  initialIgdbJobState: vi.fn(() => ({
    status: "QUEUED",
    stage: "MATCHING",
    attempt: 0,
    maxAttempts: 3,
    progress: 0,
    nextAttemptAt: null,
  })),
  isActiveIgdbJobStatus: (status: string) =>
    ["QUEUED", "RUNNING", "RETRY_WAIT", "AWAITING_MATCH"].includes(status),
}));

import { prisma } from "@/lib/prisma";
import {
  queueIgdbForDlcGames,
  queueIgdbForImportedGames,
} from "@/lib/igdb-import-queue";

describe("IGDB import queue", () => {
  const findManyGames = vi.fn();
  const findFirstSyncRun = vi.fn();
  const createSyncRun = vi.fn();
  const upsertJob = vi.fn();
  const findManyJobs = vi.fn();
  const updateSyncRun = vi.fn();
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      game: { findMany: findManyGames },
      syncRun: {
        findFirst: findFirstSyncRun,
        create: createSyncRun,
        update: updateSyncRun,
      },
      enrichmentJob: { upsert: upsertJob, findMany: findManyJobs },
    };
    transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    prisma.$transaction = transaction;
    findFirstSyncRun.mockResolvedValue({ id: "batch-1" });
    findManyJobs.mockResolvedValue([{ status: "QUEUED" }]);
  });

  it("preserves the base-game library visibility predicate", async () => {
    findManyGames.mockResolvedValue([{ id: "base-1", metadataSnapshots: [], enrichmentJobs: [] }]);

    const result = await queueIgdbForImportedGames(["base-1"]);

    expect(result).toEqual({ batchId: "batch-1", queued: 1, skipped: 0 });
    expect(findManyGames).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["base-1"] },
          type: "BASE_GAME",
          libraryEntry: { is: { hidden: false } },
        },
      }),
    );
  });

  it("queues DLCs without requiring a library entry", async () => {
    findManyGames.mockResolvedValue([{ id: "dlc-1", metadataSnapshots: [], enrichmentJobs: [] }]);

    const result = await queueIgdbForDlcGames(["dlc-1"]);

    expect(result).toEqual({ batchId: "batch-1", queued: 1, skipped: 0 });
    expect(findManyGames).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["dlc-1"] }, type: "DLC" },
      }),
    );
    expect(upsertJob).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { gameId_provider: { gameId: "dlc-1", provider: "IGDB" } },
      }),
    );
  });

  it("counts games with metadata or active work as skipped", async () => {
    findManyGames.mockResolvedValue([
      { id: "complete", metadataSnapshots: [{ id: "snapshot" }], enrichmentJobs: [] },
      { id: "active", metadataSnapshots: [], enrichmentJobs: [{ status: "RUNNING" }] },
    ]);

    await expect(queueIgdbForDlcGames(["complete", "active"])).resolves.toEqual({
      batchId: null,
      queued: 0,
      skipped: 2,
    });
  });
});
