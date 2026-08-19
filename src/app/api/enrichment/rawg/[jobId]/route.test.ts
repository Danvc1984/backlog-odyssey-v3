import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/rawg-job-runner", () => ({
  getRawgJobStatus: vi.fn(),
  runRawgEnrichmentJob: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import {
  getRawgJobStatus,
  runRawgEnrichmentJob,
} from "@/lib/rawg-job-runner";
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
    selectedRawgId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  },
  error: null,
};

describe("RAWG enrichment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    vi.mocked(getRawgJobStatus).mockResolvedValue(jobResult);
    vi.mocked(runRawgEnrichmentJob).mockResolvedValue(jobResult);
  });

  it("returns authenticated status for a RAWG job", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(jobResult);
    expect(getRawgJobStatus).toHaveBeenCalledWith("job-1");
  });

  it("filters invalid and missing jobs with HTTP status codes", async () => {
    const invalidResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ jobId: "   " }),
    });
    expect(invalidResponse.status).toBe(400);

    vi.mocked(getRawgJobStatus).mockResolvedValue(null);
    const missingResponse = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ jobId: "missing" }),
    });
    expect(missingResponse.status).toBe(404);
  });

  it("runs one bounded attempt through POST", async () => {
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ jobId: "job-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(jobResult);
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-1");
  });

  it("rejects unauthenticated requests before accessing the runner", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

    await expect(
      GET(new Request("http://localhost"), {
        params: Promise.resolve({ jobId: "job-1" }),
      }),
    ).rejects.toThrow("Unauthorized");
    expect(getRawgJobStatus).not.toHaveBeenCalled();
  });
});
