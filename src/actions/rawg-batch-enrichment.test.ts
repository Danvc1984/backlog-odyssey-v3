import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { startRawgCatalogEnrichment } from "./rawg-batch-enrichment";

describe("RAWG catalog batch action", () => {
  const findActiveBatch = vi.fn();
  const findEligibleGames = vi.fn();
  const createBatch = vi.fn();
  const upsertJob = vi.fn();
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    transaction.mockImplementation(async (callback) =>
      callback({
        syncRun: { findFirst: findActiveBatch, create: createBatch },
        game: { findMany: findEligibleGames },
        enrichmentJob: { upsert: upsertJob },
      }),
    );
    (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
    (prisma as unknown as { syncRun: { findFirst: typeof findActiveBatch } }).syncRun = {
      findFirst: findActiveBatch,
    };
    findActiveBatch.mockResolvedValue(null);
    findEligibleGames.mockResolvedValue([]);
    createBatch.mockImplementation(async ({ data }: { data: { status: string } }) => ({
      id: "batch-1",
      status: data.status,
    }));
    upsertJob.mockResolvedValue({});
  });

  it("rejects invalid input before querying catalog games", async () => {
    const result = await startRawgCatalogEnrichment({ unexpected: true });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(findEligibleGames).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

    await expect(startRawgCatalogEnrichment({})).resolves.toEqual({
      success: false,
      data: null,
      error: "Failed to queue RAWG catalog enrichment",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("reuses an active batch without creating duplicate work", async () => {
    findActiveBatch.mockResolvedValue({ id: "batch-active", status: "RUNNING" });

    await expect(startRawgCatalogEnrichment({})).resolves.toEqual({
      success: true,
      data: { kind: "ACTIVE_BATCH", batchId: "batch-active", status: "RUNNING" },
      error: null,
    });
    expect(findEligibleGames).not.toHaveBeenCalled();
    expect(createBatch).not.toHaveBeenCalled();
    expect(upsertJob).not.toHaveBeenCalled();
  });

  it("queues only base library games without metadata or active RAWG work", async () => {
    findEligibleGames.mockResolvedValue([
      { id: "game-eligible", metadataSnapshots: [], enrichmentJobs: [{ status: "FAILED" }] },
      { id: "game-metadata", metadataSnapshots: [{ id: "snapshot-1" }], enrichmentJobs: [] },
      { id: "game-active", metadataSnapshots: [], enrichmentJobs: [{ status: "RUNNING" }] },
    ]);

    await expect(startRawgCatalogEnrichment({})).resolves.toEqual({
      success: true,
      data: {
        kind: "BATCH",
        batchId: "batch-1",
        status: "RUNNING",
        counts: {
          eligible: 1,
          queued: 1,
          skippedExistingMetadata: 1,
          skippedActiveWork: 1,
        },
      },
      error: null,
    });
    expect(findEligibleGames).toHaveBeenCalledWith(expect.objectContaining({
      where: { type: "BASE_GAME", libraryEntry: { is: { hidden: false } } },
    }));
    expect(upsertJob).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId_provider: { gameId: "game-eligible", provider: "RAWG" } },
      update: expect.objectContaining({ status: "QUEUED", syncRunId: "batch-1" }),
    }));
  });
});
