import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/igdb-job-runner", () => ({
  getIgdbJobStatus: vi.fn(),
  runIgdbEnrichmentJob: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { getIgdbJobStatus, runIgdbEnrichmentJob } from "@/lib/igdb-job-runner";
import { GET, POST } from "./route";

const jobResult = {
  success: true as const,
  data: {
    id: "job-1",
    status: "RUNNING" as const,
    stage: "MATCHING" as const,
    attempt: 1,
    maxAttempts: 3,
    progress: 25,
    nextAttemptAt: null,
    candidates: [],
    hasMoreCandidates: false,
    selectedIgdbId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  },
  error: null,
};

describe("IGDB enrichment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    vi.mocked(getIgdbJobStatus).mockResolvedValue(jobResult);
    vi.mocked(runIgdbEnrichmentJob).mockResolvedValue(jobResult);
  });

  it("returns authenticated status and advances a job", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(jobResult);
    expect(getIgdbJobStatus).toHaveBeenCalledWith("job-1");

    const postResponse = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ jobId: "job-1" }),
    });
    expect(postResponse.status).toBe(200);
    expect(runIgdbEnrichmentJob).toHaveBeenCalledWith("job-1");
  });

  it("rejects unauthenticated requests before accessing the runner", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

    await expect(GET(new Request("http://localhost"), {
      params: Promise.resolve({ jobId: "job-1" }),
    })).rejects.toThrow("Unauthorized");
    expect(getIgdbJobStatus).not.toHaveBeenCalled();
  });
});
