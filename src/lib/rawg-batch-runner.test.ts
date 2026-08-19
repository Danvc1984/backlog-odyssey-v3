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
  const findJob = vi.fn();
  const updateBatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as {
      syncRun: { findFirst: typeof findBatch; update: typeof updateBatch };
      enrichmentJob: { findFirst: typeof findJob };
    }).syncRun = { findFirst: findBatch, update: updateBatch };
    (prisma as unknown as { enrichmentJob: { findFirst: typeof findJob } }).enrichmentJob = {
      findFirst: findJob,
    };
    findBatch.mockResolvedValue(batch());
    findJob.mockResolvedValue({ id: "job-1" });
    updateBatch.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      batch({ ...data }),
    );
    vi.mocked(runRawgEnrichmentJob).mockResolvedValue({
      success: true,
      data: {} as never,
      error: null,
    });
  });

  it("runs at most one queued job and refreshes its durable summary", async () => {
    const result = await runRawgCatalogBatch("batch-1");

    expect(runRawgEnrichmentJob).toHaveBeenCalledTimes(1);
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-1");
    expect(findJob).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ syncRunId: "batch-1", provider: "RAWG" }),
    }));
    expect(updateBatch).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "RUNNING", counts: expect.any(Object) }),
    }));
    expect(result).toMatchObject({ success: true, data: { status: "RUNNING" } });
  });

  it("does not run retry-wait work before it is due", async () => {
    findJob.mockResolvedValue(null);
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
    expect(findJob).toHaveBeenCalledWith(expect.objectContaining({
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
    findJob.mockResolvedValue(null);
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
    expect(findJob).not.toHaveBeenCalled();
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
        enrichmentJobs: { some: { provider: "RAWG", status: "AWAITING_MATCH" } },
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
        enrichmentJobs: { some: { provider: "RAWG", status: "FAILED" } },
      }),
    }));
    expect(findBatch).toHaveBeenCalledTimes(2);
  });
});
