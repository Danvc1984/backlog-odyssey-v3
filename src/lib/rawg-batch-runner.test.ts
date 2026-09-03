import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rawg-job-runner", () => ({ runRawgEnrichmentJob: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { runRawgEnrichmentJob } from "@/lib/rawg-job-runner";
import {
  getLatestRawgBatchStatus,
  getRawgBatchStatus,
  runRawgCatalogBatch,
} from "./rawg-batch-runner";

function batch(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    provider: "RAWG",
    status: "RUNNING",
    counts: null,
    finishedAt: null,
    enrichmentJobs: [{
      id: "job-1",
      status: "QUEUED",
      nextAttemptAt: null,
      game: { id: "game-1", name: "Portal 2" },
    }],
    ...overrides,
  };
}

describe("RAWG catalog batch runner", () => {
  const findBatch = vi.fn();
  const findPendingBatches = vi.fn();
  const findJobs = vi.fn();
  const updateBatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as {
      syncRun: { findFirst: typeof findBatch; findMany: typeof findPendingBatches; update: typeof updateBatch };
      enrichmentJob: { findMany: typeof findJobs };
    }).syncRun = { findFirst: findBatch, findMany: findPendingBatches, update: updateBatch };
    (prisma as unknown as { enrichmentJob: { findMany: typeof findJobs } }).enrichmentJob = {
      findMany: findJobs,
    };
    findBatch.mockResolvedValue(batch());
    findPendingBatches.mockResolvedValue([]);
    findJobs.mockResolvedValue([{ id: "job-1" }]);
    updateBatch.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      batch({ ...data }),
    );
    vi.mocked(runRawgEnrichmentJob).mockResolvedValue({
      success: true,
      data: {} as never,
      error: null,
    });
  });

  it("runs up to five queued jobs concurrently and refreshes after they settle", async () => {
    let releaseJobs: (() => void) | undefined;
    const jobsStarted = new Promise<void>((resolve) => {
      releaseJobs = resolve;
    });
    findJobs.mockResolvedValue([
      { id: "job-1" },
      { id: "job-2" },
      { id: "job-3" },
      { id: "job-4" },
      { id: "job-5" },
    ]);
    vi.mocked(runRawgEnrichmentJob).mockImplementation(async () => {
      await jobsStarted;
      return { success: true, data: {} as never, error: null };
    });

    const batchRun = runRawgCatalogBatch("batch-1");
    await vi.waitFor(() => expect(runRawgEnrichmentJob).toHaveBeenCalledTimes(5));

    expect(updateBatch).not.toHaveBeenCalled();
    releaseJobs?.();
    const result = await batchRun;

    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-1");
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-2");
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-3");
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-4");
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-5");
    expect(findJobs).toHaveBeenCalledWith(expect.objectContaining({
      take: 5,
      where: expect.objectContaining({ syncRunId: "batch-1", provider: "RAWG" }),
    }));
    expect(updateBatch).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "RUNNING", counts: expect.any(Object) }),
    }));
    expect(result).toMatchObject({ success: true, data: { status: "RUNNING" } });
  });

  it("runs fewer ready jobs without duplicating them", async () => {
    findJobs.mockResolvedValue([{ id: "job-1" }, { id: "job-2" }]);

    await runRawgCatalogBatch("batch-1");

    expect(runRawgEnrichmentJob).toHaveBeenCalledTimes(2);
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-1");
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-2");
    expect(new Set(vi.mocked(runRawgEnrichmentJob).mock.calls.map(([jobId]) => jobId)).size).toBe(2);
  });

  it("leaves the sixth ready job for a later five-job advance", async () => {
    const readyJobs = Array.from({ length: 6 }, (_, index) => ({
      id: `job-${index + 1}`,
      status: "QUEUED" as const,
      nextAttemptAt: null,
      game: { id: `game-${index + 1}`, name: `Game ${index + 1}` },
    }));
    findBatch.mockResolvedValue(batch({ enrichmentJobs: readyJobs }));
    findJobs.mockResolvedValue([
      { id: "job-1" },
      { id: "job-2" },
      { id: "job-3" },
      { id: "job-4" },
      { id: "job-5" },
    ]);

    await runRawgCatalogBatch("batch-1");

    expect(findJobs).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(runRawgEnrichmentJob).toHaveBeenCalledTimes(5);
    expect(runRawgEnrichmentJob).not.toHaveBeenCalledWith("job-6");
    expect(new Set(vi.mocked(runRawgEnrichmentJob).mock.calls.map(([jobId]) => jobId)).size).toBe(5);
  });

  it("keeps rate-limited retries and terminal failures observable after a concurrent group", async () => {
    const initialJobs = [
      { id: "job-retry", status: "QUEUED" as const, nextAttemptAt: null, game: { id: "game-retry", name: "Hades" } },
      { id: "job-failed", status: "QUEUED" as const, nextAttemptAt: null, game: { id: "game-failed", name: "Portal" } },
    ];
    const settledJobs = [
      {
        id: "job-retry",
        status: "RETRY_WAIT" as const,
        nextAttemptAt: new Date(Date.now() + 1_000),
        game: { id: "game-retry", name: "Hades" },
      },
      { id: "job-failed", status: "FAILED" as const, nextAttemptAt: null, game: { id: "game-failed", name: "Portal" } },
    ];
    findJobs.mockResolvedValue([{ id: "job-retry" }, { id: "job-failed" }]);
    findBatch
      .mockResolvedValueOnce(batch({ enrichmentJobs: initialJobs }))
      .mockResolvedValueOnce(batch({ enrichmentJobs: settledJobs }));
    updateBatch.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      batch({ ...data, enrichmentJobs: settledJobs }),
    );
    vi.mocked(runRawgEnrichmentJob)
      .mockResolvedValueOnce({ success: true, data: { status: "RETRY_WAIT" } as never, error: null })
      .mockResolvedValueOnce({ success: true, data: { status: "FAILED" } as never, error: null });

    const result = await runRawgCatalogBatch("batch-1");

    expect(runRawgEnrichmentJob).toHaveBeenCalledTimes(2);
    expect(updateBatch).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "RUNNING", counts: expect.objectContaining({ retryWaiting: 1, failed: 1 }) }),
    }));
    expect(result).toMatchObject({
      success: true,
      data: {
        status: "RUNNING",
        counts: { retryWaiting: 1, failed: 1 },
        failedGames: [{ id: "game-failed", name: "Portal" }],
      },
    });
  });

  it("does not run retry-wait work before it is due", async () => {
    findJobs.mockResolvedValue([]);
    findBatch
      .mockResolvedValueOnce(batch({
        enrichmentJobs: [{
          id: "job-1",
          status: "RETRY_WAIT",
          nextAttemptAt: new Date(Date.now() + 60_000),
          game: { id: "game-1", name: "Portal 2" },
        }],
      }))
      .mockResolvedValueOnce(batch({
        enrichmentJobs: [{
          id: "job-1",
          status: "RETRY_WAIT",
          nextAttemptAt: new Date(Date.now() + 60_000),
          game: { id: "game-1", name: "Portal 2" },
        }],
      }));

    await runRawgCatalogBatch("batch-1");

    expect(runRawgEnrichmentJob).not.toHaveBeenCalled();
    expect(findJobs).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ status: "RETRY_WAIT", nextAttemptAt: { lte: expect.any(Date) } }),
        ]),
      }),
    }));
  });

  it("finishes mixed failed and awaiting-match work as a partial batch", async () => {
    const settledJobs = [
      {
        id: "job-success",
        status: "SUCCEEDED" as const,
        nextAttemptAt: null,
        game: { id: "game-success", name: "Portal 2" },
      },
      {
        id: "job-failed",
        status: "FAILED" as const,
        nextAttemptAt: null,
        game: { id: "game-failed", name: "Half-Life 2" },
      },
      {
        id: "job-review",
        status: "AWAITING_MATCH" as const,
        nextAttemptAt: null,
        game: { id: "game-review", name: "Hades" },
      },
    ];
    findJobs.mockResolvedValue([]);
    findBatch
      .mockResolvedValueOnce(batch({
        enrichmentJobs: settledJobs,
      }))
      .mockResolvedValueOnce(batch({
        enrichmentJobs: settledJobs,
      }));
    updateBatch.mockResolvedValue(
      batch({
        status: "PARTIAL",
        finishedAt: new Date(),
        enrichmentJobs: settledJobs,
      }),
    );

    const result = await runRawgCatalogBatch("batch-1");

    expect(runRawgEnrichmentJob).not.toHaveBeenCalled();
    expect(updateBatch).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PARTIAL", finishedAt: expect.any(Date) }),
    }));
    expect(result).toMatchObject({
      success: true,
      data: {
        status: "PARTIAL",
        progress: 100,
        isTerminal: true,
        awaitingMatchGames: [{ id: "game-review", name: "Hades" }],
        failedGames: [{ id: "game-failed", name: "Half-Life 2" }],
      },
    });
  });

  it("returns a batch status without invoking the runner", async () => {
    const result = await getRawgBatchStatus("batch-1");

    expect(result).toMatchObject({ success: true, data: { id: "batch-1" } });
    expect(result?.data?.pendingAwaitingMatchGames).toEqual([]);
    expect(result?.data?.pendingFailedGames).toEqual([]);
    expect(findPendingBatches).not.toHaveBeenCalled();
    expect(findJobs).not.toHaveBeenCalled();
    expect(runRawgEnrichmentJob).not.toHaveBeenCalled();
  });

  it("keeps a terminal batch's persisted counts after later job changes", async () => {
    findBatch.mockResolvedValue(batch({
      status: "SUCCESS",
      finishedAt: new Date("2026-08-19T22:00:00.000Z"),
      counts: {
        total: 2,
        queued: 0,
        running: 0,
        retryWaiting: 0,
        awaitingMatch: 0,
        succeeded: 2,
        failed: 0,
      },
      enrichmentJobs: [{
        id: "job-1",
        status: "FAILED",
        nextAttemptAt: null,
        game: { id: "game-1", name: "Portal 2" },
      }],
    }));

    await expect(getRawgBatchStatus("batch-1")).resolves.toMatchObject({
      success: true,
      data: {
        status: "SUCCESS",
        counts: { total: 2, succeeded: 2, failed: 0 },
        progress: 100,
        failedGames: [{ id: "game-1", name: "Portal 2" }],
      },
    });
  });

  it("excludes hidden games from batch counts and follow-ups", async () => {
    findBatch.mockResolvedValue(batch({
      status: "PARTIAL",
      enrichmentJobs: [
        {
          id: "job-visible",
          status: "AWAITING_MATCH",
          nextAttemptAt: null,
          game: { id: "game-visible", name: "Portal 2", libraryEntry: { hidden: false } },
        },
        {
          id: "job-hidden",
          status: "FAILED",
          nextAttemptAt: null,
          game: { id: "game-hidden", name: "Hidden Game", libraryEntry: { hidden: true } },
        },
      ],
    }));

    await expect(getRawgBatchStatus("batch-1")).resolves.toMatchObject({
      data: {
        counts: { total: 1, awaitingMatch: 1, failed: 0 },
        awaitingMatchGames: [{ id: "game-visible" }],
        failedGames: [],
      },
    });
  });

  it("prefers a batch with pending match review over a newer empty batch", async () => {
    const reviewBatch = batch({
      id: "batch-review",
      status: "PARTIAL",
      counts: {
        total: 1,
        queued: 0,
        running: 0,
        retryWaiting: 0,
        awaitingMatch: 1,
        succeeded: 0,
        failed: 0,
      },
      enrichmentJobs: [{
        id: "job-review",
        status: "AWAITING_MATCH",
        nextAttemptAt: null,
        game: { id: "game-review", name: "Hades" },
      }],
    });
    findBatch.mockResolvedValue(reviewBatch);

    await expect(getLatestRawgBatchStatus()).resolves.toMatchObject({
      success: true,
      data: { id: "batch-review", awaitingMatchGames: [{ id: "game-review" }] },
    });
    expect(findBatch).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "PARTIAL",
        enrichmentJobs: {
          some: {
            provider: "RAWG",
            status: "AWAITING_MATCH",
            game: { libraryEntry: { is: { hidden: false } } },
          },
        },
      }),
    }));
    expect(findBatch).toHaveBeenCalledTimes(1);
  });

  it("prefers a terminal failed batch over a newer empty batch", async () => {
    const failedBatch = batch({
      id: "batch-failed",
      status: "FAILED",
      finishedAt: new Date("2026-08-19T22:00:00.000Z"),
      counts: {
        total: 2,
        queued: 0,
        running: 0,
        retryWaiting: 0,
        awaitingMatch: 0,
        succeeded: 0,
        failed: 2,
      },
      enrichmentJobs: [
        {
          id: "job-failed-1",
          status: "FAILED",
          nextAttemptAt: null,
          game: { id: "game-failed-1", name: "Half-Life 2" },
        },
        {
          id: "job-failed-2",
          status: "FAILED",
          nextAttemptAt: null,
          game: { id: "game-failed-2", name: "Portal" },
        },
      ],
    });
    findBatch.mockResolvedValueOnce(null).mockResolvedValueOnce(failedBatch);

    await expect(getLatestRawgBatchStatus()).resolves.toMatchObject({
      success: true,
      data: {
        id: "batch-failed",
        status: "FAILED",
        isTerminal: true,
        failedGames: [
          { id: "game-failed-1", name: "Half-Life 2" },
          { id: "game-failed-2", name: "Portal" },
        ],
      },
    });
    expect(findBatch).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: ["PARTIAL", "FAILED"] },
        enrichmentJobs: {
          some: {
            provider: "RAWG",
            status: "FAILED",
            game: { libraryEntry: { is: { hidden: false } } },
          },
        },
      }),
    }));
    expect(findBatch).toHaveBeenCalledTimes(2);
  });

  it("combines pending games from older and newer RAWG batches without duplicates", async () => {
    findBatch.mockResolvedValue(batch({ id: "batch-new", status: "PARTIAL" }));
    findPendingBatches.mockResolvedValue([
      {
          enrichmentJobs: [
            { status: "AWAITING_MATCH", game: { id: "game-import", name: "Imported Game" } },
            { status: "FAILED", game: { id: "game-hidden", name: "Hidden Game", libraryEntry: { hidden: true } } },
            { status: "FAILED", game: { id: "game-failed", name: "Failed Game" } },
        ],
      },
      {
        enrichmentJobs: [
          { status: "AWAITING_MATCH", game: { id: "game-import", name: "Imported Game" } },
          { status: "AWAITING_MATCH", game: { id: "game-manual", name: "Manual Game" } },
        ],
      },
    ]);

    await expect(getLatestRawgBatchStatus()).resolves.toMatchObject({
      success: true,
      data: {
        id: "batch-new",
        pendingAwaitingMatchGames: [
          { id: "game-import", name: "Imported Game" },
          { id: "game-manual", name: "Manual Game" },
        ],
        pendingFailedGames: [{ id: "game-failed", name: "Failed Game" }],
      },
    });
  });
});
