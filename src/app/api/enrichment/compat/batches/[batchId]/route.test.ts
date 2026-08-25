import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/compat-batch-runner", () => ({
  getCompatBatchStatus: vi.fn(),
  runCompatBatch: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import {
  getCompatBatchStatus,
  runCompatBatch,
} from "@/lib/compat-batch-runner";
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
      succeeded: 0,
      failed: 0,
    },
    progress: 0,
    isTerminal: false,
    finishedAt: null,
    failedGames: [],
  },
  error: null,
};

describe("compatibility batch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    vi.mocked(getCompatBatchStatus).mockResolvedValue(batchResult);
    vi.mocked(runCompatBatch).mockResolvedValue(batchResult);
  });

  it("returns authenticated status and runs a batch", async () => {
    const getResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ batchId: "batch-1" }),
    });
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual(batchResult);
    expect(getCompatBatchStatus).toHaveBeenCalledWith("batch-1");

    const postResponse = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ batchId: "batch-1" }),
    });
    expect(postResponse.status).toBe(200);
    expect(runCompatBatch).toHaveBeenCalledWith("batch-1");
  });

  it("returns 404 for a missing batch and rejects invalid IDs", async () => {
    vi.mocked(getCompatBatchStatus).mockResolvedValue(null);
    const missingResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ batchId: "missing" }),
    });
    expect(missingResponse.status).toBe(404);

    const invalidResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ batchId: "   " }),
    });
    expect(invalidResponse.status).toBe(400);
  });

  it("authenticates before accessing the runner", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

    await expect(GET(new Request("http://localhost"), {
      params: Promise.resolve({ batchId: "batch-1" }),
    })).rejects.toThrow("Unauthorized");
    expect(getCompatBatchStatus).not.toHaveBeenCalled();
  });
});
