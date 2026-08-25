import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/compat-job-runner", () => ({ runCompatJob: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { runCompatJob } from "@/lib/compat-job-runner";
import {
  getCompatBatchStatus,
  getLatestCompatBatchStatus,
  runCompatBatch,
} from "./compat-batch-runner";

function batch(overrides: Record<string, unknown> = {}) {
  return {
    id: "batch-1",
    provider: "PROTONDB",
    status: "RUNNING",
    counts: null,
    finishedAt: null,
    enrichmentJobs: [
      {
        id: "job-1",
        status: "QUEUED",
        nextAttemptAt: null,
        game: { id: "game-1", name: "Portal 2", libraryEntry: null },
      },
    ],
    ...overrides,
  };
}

describe("compatibility batch runner", () => {
  const findFirst = vi.fn();
  const findMany = vi.fn();
  const update = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(prisma, {
      syncRun: { findFirst, update },
      enrichmentJob: { findMany },
    });
    vi.mocked(runCompatJob).mockResolvedValue(null);
    findMany.mockResolvedValue([]);
    update.mockResolvedValue(batch({ status: "SUCCESS" }));
  });

  it("reads a batch and exposes failed games", async () => {
    findFirst.mockResolvedValue(batch({
      status: "PARTIAL",
      enrichmentJobs: [{
        id: "job-1",
        status: "FAILED",
        nextAttemptAt: null,
        game: { id: "game-1", name: "Portal 2", libraryEntry: null },
      }],
    }));

    await expect(getCompatBatchStatus("batch-1")).resolves.toMatchObject({
      data: {
        status: "PARTIAL",
        counts: { total: 1, failed: 1 },
        progress: 100,
        failedGames: [{ id: "game-1", name: "Portal 2" }],
      },
    });
  });

  it("runs ready jobs and refreshes the persisted summary", async () => {
    findFirst
      .mockResolvedValueOnce(batch())
      .mockResolvedValueOnce(batch({
        status: "SUCCESS",
        enrichmentJobs: [{
          id: "job-1",
          status: "SUCCEEDED",
          nextAttemptAt: null,
          game: { id: "game-1", name: "Portal 2", libraryEntry: null },
        }],
      }));
    findMany.mockResolvedValue([{ id: "job-1" }]);

    await runCompatBatch("batch-1");

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        syncRunId: "batch-1",
        provider: "PROTONDB",
      }),
      take: 5,
    }));
    expect(runCompatJob).toHaveBeenCalledWith("job-1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "batch-1" },
      data: expect.objectContaining({ status: "SUCCESS", finishedAt: expect.any(Date) }),
    }));
  });

  it("uses active, failed partial, then latest batch fallback order", async () => {
    const active = batch({ id: "active", status: "RUNNING" });
    const failed = batch({ id: "failed", status: "PARTIAL" });
    const latest = batch({ id: "latest", status: "SUCCESS" });
    findFirst
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(latest);

    await expect(getLatestCompatBatchStatus()).resolves.toMatchObject({ data: { id: "active" } });
    expect(findFirst).toHaveBeenCalledTimes(1);

    findFirst.mockReset();
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(latest);
    await expect(getLatestCompatBatchStatus()).resolves.toMatchObject({ data: { id: "failed" } });

    findFirst.mockReset();
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(latest);
    await expect(getLatestCompatBatchStatus()).resolves.toMatchObject({ data: { id: "latest" } });
  });

  it("omits failed games with a saved compatibility override", async () => {
    findFirst.mockResolvedValue(batch({
      status: "PARTIAL",
      enrichmentJobs: [{
        id: "job-1",
        status: "FAILED",
        nextAttemptAt: null,
        game: {
          id: "game-1",
          name: "Portal 2",
          libraryEntry: { compatOverrideStatus: "READY" },
        },
      }],
    }));

    await expect(getCompatBatchStatus("batch-1")).resolves.toMatchObject({
      data: { failedGames: [] },
    });
  });

  it("ignores an empty persisted batch when loading the latest status", async () => {
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(batch({ id: "empty", status: "FAILED", enrichmentJobs: [] }))
      .mockResolvedValueOnce(batch({ id: "latest", status: "SUCCESS" }));

    await expect(getLatestCompatBatchStatus()).resolves.toMatchObject({
      data: { id: "latest" },
    });
  });
});
