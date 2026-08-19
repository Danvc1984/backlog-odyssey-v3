import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rawg-api", () => ({
  RAWG_SEARCH_PAGE_SIZE: 5,
  searchRawgCandidates: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { searchRawgCandidates } from "@/lib/rawg-api";
import {
  applyRawgTitle,
  cancelRawgEnrichment,
  loadMoreRawgCandidates,
  requestRawgEnrichment,
  selectRawgMatch,
} from "./rawg-enrichment";

const fetchedAt = new Date("2026-08-19T18:00:00.000Z");
const candidate = {
  id: 123,
  slug: "hollow-knight",
  name: "Hollow Knight",
  released: "2017-02-24",
  backgroundImage: "https://example.com/hollow.jpg",
};

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    provider: "RAWG",
    status: "FAILED",
    stage: "FAILED",
    attempt: 3,
    maxAttempts: 3,
    progress: 0,
    nextAttemptAt: null,
    candidatePayload: null,
    selectedRawgId: null,
    lastErrorCode: "NETWORK",
    lastErrorMessage: "RAWG could not be reached",
    ...overrides,
  };
}

describe("RAWG enrichment actions", () => {
  const findGame = vi.fn();
  const findJob = vi.fn();
  const createJob = vi.fn();
  const updateJob = vi.fn();
  const updateGame = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    (prisma as unknown as {
      game: { findUnique: typeof findGame; update: typeof updateGame };
      enrichmentJob: {
        findUnique: typeof findJob;
        create: typeof createJob;
        update: typeof updateJob;
      };
    }).game = { findUnique: findGame, update: updateGame };
    (prisma as unknown as {
      enrichmentJob: {
        findUnique: typeof findJob;
        create: typeof createJob;
        update: typeof updateJob;
      };
    }).enrichmentJob = { findUnique: findJob, create: createJob, update: updateJob };
    findGame.mockResolvedValue({ id: "game-1", metadataSnapshots: [] });
    findJob.mockResolvedValue(null);
    createJob.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      job({ ...data, id: "job-created" }),
    );
    updateJob.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      job({ ...data }),
    );
    updateGame.mockImplementation(async ({ data }: { data: { name: string } }) => ({
      id: "game-1",
      name: data.name,
    }));
    vi.mocked(searchRawgCandidates).mockResolvedValue([]);
  });

  it("rejects invalid input before reading the database", async () => {
    const result = await requestRawgEnrichment({ gameId: "" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Invalid input",
    });
    expect(findGame).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("Unauthorized"));

    const result = await requestRawgEnrichment({ gameId: "game-1" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Unauthorized",
    });
    expect(findGame).not.toHaveBeenCalled();
  });

  it("queues a new job for a game without a RAWG snapshot", async () => {
    const result = await requestRawgEnrichment({ gameId: "game-1" });

    expect(result).toMatchObject({
      success: true,
      data: { kind: "JOB", job: { id: "job-created", status: "QUEUED" } },
      error: null,
    });
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gameId: "game-1",
          provider: "RAWG",
          status: "QUEUED",
          attempt: 0,
          maxAttempts: 3,
        }),
      }),
    );
  });

  it("returns an overwrite warning without mutating an existing snapshot", async () => {
    findGame.mockResolvedValue({
      id: "game-1",
      metadataSnapshots: [{ fetchedAt }],
    });

    const result = await requestRawgEnrichment({ gameId: "game-1" });

    expect(result).toEqual({
      success: true,
      data: {
        kind: "OVERWRITE_REQUIRED",
        existingFetchedAt: fetchedAt.toISOString(),
      },
      error: null,
    });
    expect(createJob).not.toHaveBeenCalled();
    expect(updateJob).not.toHaveBeenCalled();
  });

  it("reuses an active job instead of creating duplicate work", async () => {
    findGame.mockResolvedValue({
      id: "game-1",
      metadataSnapshots: [{ fetchedAt }],
    });
    findJob.mockResolvedValue(job({
      status: "RUNNING",
      stage: "MATCHING",
      attempt: 1,
      progress: 25,
    }));

    const result = await requestRawgEnrichment({ gameId: "game-1" });

    expect(result).toMatchObject({
      success: true,
      data: { kind: "JOB", job: { id: "job-1", status: "RUNNING", progress: 25 } },
      error: null,
    });
    expect(createJob).not.toHaveBeenCalled();
    expect(updateJob).not.toHaveBeenCalled();
  });

  it("resets a failed job only after overwrite confirmation", async () => {
    findGame.mockResolvedValue({
      id: "game-1",
      metadataSnapshots: [{ fetchedAt }],
    });
    findJob.mockResolvedValue(job());

    const result = await requestRawgEnrichment({
      gameId: "game-1",
      confirmOverwrite: true,
    });

    expect(result).toMatchObject({
      success: true,
      data: { kind: "JOB", job: { status: "QUEUED", attempt: 0 } },
      error: null,
    });
    expect(updateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "QUEUED", attempt: 0 }),
      }),
    );
  });

  it("rejects a candidate that is not persisted on the awaiting job", async () => {
    findJob.mockResolvedValue(
      job({ status: "AWAITING_MATCH", stage: "MATCHING", candidatePayload: [candidate] }),
    );

    const result = await selectRawgMatch({ jobId: "job-1", rawgId: 999 });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "RAWG candidate is not available for this job",
    });
    expect(updateJob).not.toHaveBeenCalled();
  });

  it("selects a persisted candidate and returns the job to queued", async () => {
    findJob.mockResolvedValue(
      job({ status: "AWAITING_MATCH", stage: "MATCHING", candidatePayload: [candidate] }),
    );

    const result = await selectRawgMatch({ jobId: "job-1", rawgId: candidate.id });

    expect(result).toMatchObject({
      success: true,
      data: {
        kind: "JOB",
        job: { status: "QUEUED", selectedRawgId: candidate.id },
      },
      error: null,
    });
    expect(updateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: "QUEUED",
          selectedRawgId: candidate.id,
          attempt: 0,
        }),
      }),
    );
  });

  it("cancels an ambiguous match review without touching metadata", async () => {
    findJob.mockResolvedValue(
      job({ status: "AWAITING_MATCH", stage: "MATCHING", candidatePayload: [candidate] }),
    );

    const result = await cancelRawgEnrichment({ jobId: "job-1" });

    expect(result).toMatchObject({
      success: true,
      data: { kind: "JOB", job: { status: "FAILED", lastErrorCode: "CANCELLED" } },
    });
    expect(updateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: "FAILED",
          lastErrorCode: "CANCELLED",
          selectedRawgId: null,
        }),
      }),
    );
  });

  it("rejects cancellation for a job that is not awaiting review", async () => {
    findJob.mockResolvedValue(job({ status: "FAILED" }));

    await expect(cancelRawgEnrichment({ jobId: "job-1" })).resolves.toEqual({
      success: false,
      data: null,
      error: "RAWG job is not awaiting match selection",
    });
    expect(updateJob).not.toHaveBeenCalled();
  });

  it("persists a later RAWG candidate page for the same awaiting review", async () => {
    const laterCandidate = { ...candidate, id: 456, slug: "hollow-knight-silksong", name: "Hollow Knight: Silksong" };
    findJob.mockResolvedValue(
      job({
        status: "AWAITING_MATCH",
        stage: "MATCHING",
        candidatePayload: { candidates: [candidate], nextPage: 2 },
        game: { name: "Hollow Knight" },
      }),
    );
    vi.mocked(searchRawgCandidates).mockResolvedValue([laterCandidate]);

    const result = await loadMoreRawgCandidates({ jobId: "job-1" });

    expect(searchRawgCandidates).toHaveBeenCalledWith("Hollow Knight", 2);
    expect(updateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          candidatePayload: { candidates: [candidate, laterCandidate], nextPage: null },
        }),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      data: { kind: "JOB", job: { candidates: [candidate, laterCandidate], hasMoreCandidates: false } },
    });
  });

  it("applies a valid persisted RAWG title only after an explicit action", async () => {
    findGame.mockResolvedValue({
      id: "game-1",
      metadataSnapshots: [{ payload: { title: "Hollow Knight" } }],
    });

    await expect(applyRawgTitle({ gameId: "game-1" })).resolves.toEqual({
      success: true,
      data: { id: "game-1", name: "Hollow Knight" },
      error: null,
    });
    expect(updateGame).toHaveBeenCalledWith({
      where: { id: "game-1" },
      data: { name: "Hollow Knight" },
      select: { id: true, name: true },
    });
  });

  it("does not change the catalog name when the RAWG snapshot title is missing", async () => {
    findGame.mockResolvedValue({
      id: "game-1",
      metadataSnapshots: [{ payload: {} }],
    });

    await expect(applyRawgTitle({ gameId: "game-1" })).resolves.toEqual({
      success: false,
      data: null,
      error: "RAWG title is unavailable",
    });
    expect(updateGame).not.toHaveBeenCalled();
  });
});
