import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rawg-job-runner", () => ({ runRawgEnrichmentJob: vi.fn() }));
vi.mock("@/lib/compat-job-runner", () => ({ runCompatJob: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { runRawgEnrichmentJob } from "@/lib/rawg-job-runner";
import { runCompatJob } from "@/lib/compat-job-runner";
import { retryEnrichmentJob } from "./enrichment-retry";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockRunnerResult = {
  success: true as const,
  data: {
    id: "job-1",
    status: "SUCCEEDED",
    stage: "COMPLETE",
    attempt: 1,
    maxAttempts: 3,
    progress: 100,
    nextAttemptAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    candidates: [],
    hasMoreCandidates: false,
    selectedRawgId: 123,
  },
  error: null,
} as Awaited<ReturnType<typeof runRawgEnrichmentJob>>;

function failedRawgJob() {
  return {
    id: "job-1",
    provider: "RAWG",
    status: "FAILED",
    stage: "FAILED",
    attempt: 3,
    maxAttempts: 3,
    nextAttemptAt: null,
    lastErrorCode: "HTTP",
    lastErrorMessage: "RAWG request failed",
    candidatePayload: { candidates: [] },
    selectedRawgId: 123,
    finishedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (prisma as unknown as { enrichmentJob: Record<string, ReturnType<typeof vi.fn>> }).enrichmentJob = {
    findUnique: mockFindUnique,
    update: mockUpdate,
  };
  mockFindUnique.mockResolvedValue(failedRawgJob());
  mockUpdate.mockResolvedValue({ id: "job-1" });
  vi.mocked(runRawgEnrichmentJob).mockResolvedValue(mockRunnerResult);
  vi.mocked(runCompatJob).mockResolvedValue(mockRunnerResult);
});

describe("retryEnrichmentJob", () => {
  it("requeues a FAILED RAWG job with a fresh budget and dispatches to the RAWG runner", async () => {
    const result = await retryEnrichmentJob({ jobId: "job-1" });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "QUEUED",
        attempt: 0,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      select: { id: true },
    });
    expect(runRawgEnrichmentJob).toHaveBeenCalledWith("job-1");
    expect(runCompatJob).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: mockRunnerResult, error: null });
  });

  it("dispatches FAILED PROTONDB and AWAY jobs to the compat runner", async () => {
    mockFindUnique.mockResolvedValue({ ...failedRawgJob(), provider: "PROTONDB" });
    await retryEnrichmentJob({ jobId: "job-1" });
    expect(runCompatJob).toHaveBeenCalledWith("job-1");
    expect(runRawgEnrichmentJob).not.toHaveBeenCalled();

    mockFindUnique.mockResolvedValue({ ...failedRawgJob(), provider: "ARE_WE_ANTICHEAT_YET" });
    await retryEnrichmentJob({ jobId: "job-1" });
    expect(runCompatJob).toHaveBeenCalledTimes(2);
  });

  it("rejects a non-FAILED job without any write", async () => {
    for (const status of ["QUEUED", "RUNNING", "RETRY_WAIT"]) {
      mockFindUnique.mockResolvedValue({ ...failedRawgJob(), status });
      const result = await retryEnrichmentJob({ jobId: "job-1" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Only failed jobs can be retried");
      mockUpdate.mockReset();
    }
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(runRawgEnrichmentJob).not.toHaveBeenCalled();
    expect(runCompatJob).not.toHaveBeenCalled();
  });

  it("rejects an unsupported provider without any write", async () => {
    mockFindUnique.mockResolvedValue({ ...failedRawgJob(), provider: "STEAM" });
    const result = await retryEnrichmentJob({ jobId: "job-1" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Retry is not available for this provider");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(runRawgEnrichmentJob).not.toHaveBeenCalled();
    expect(runCompatJob).not.toHaveBeenCalled();
  });

  it("flows through the auth guard", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("unauthorized"));
    const result = await retryEnrichmentJob({ jobId: "job-1" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to retry enrichment job");
    expect(prisma.enrichmentJob.findUnique).not.toHaveBeenCalled();
  });
});
