import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/rawg-batch-runner", () => ({
  getRawgBatchStatus: vi.fn(),
  runRawgCatalogBatch: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import {
  getRawgBatchStatus,
  runRawgCatalogBatch,
} from "@/lib/rawg-batch-runner";
import { GET, POST } from "./route";

const batchResult = {
  success: true as const,
  data: {
    id: "batch-1",
    status: "RUNNING" as const,
    counts: {
      total: 1,
      queued: 1,
      running: 0,
      retryWaiting: 0,
      awaitingMatch: 0,
      succeeded: 0,
      failed: 0,
    },
    progress: 0,
    isTerminal: false,
    finishedAt: null,
    awaitingMatchGames: [],
    failedGames: [],
  },
  error: null,
};

describe("RAWG catalog batch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    vi.mocked(getRawgBatchStatus).mockResolvedValue(batchResult);
    vi.mocked(runRawgCatalogBatch).mockResolvedValue(batchResult);
  });

  it("returns authenticated status for a RAWG batch", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ batchId: "batch-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(batchResult);
    expect(getRawgBatchStatus).toHaveBeenCalledWith("batch-1");
  });

  it("filters invalid and missing batch IDs", async () => {
    const invalidResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ batchId: "   " }),
    });
    expect(invalidResponse.status).toBe(400);

    vi.mocked(getRawgBatchStatus).mockResolvedValue(null);
    const missingResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ batchId: "missing" }),
    });
    expect(missingResponse.status).toBe(404);
  });

  it("runs at most one batch item through POST", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ batchId: "batch-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(batchResult);
    expect(runRawgCatalogBatch).toHaveBeenCalledWith("batch-1");
  });

  it("rejects unauthenticated requests before accessing the runner", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

    await expect(
      GET(new Request("http://localhost"), {
        params: Promise.resolve({ batchId: "batch-1" }),
      }),
    ).rejects.toThrow("Unauthorized");
    expect(getRawgBatchStatus).not.toHaveBeenCalled();
  });
});
