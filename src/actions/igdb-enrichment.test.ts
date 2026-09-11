import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/igdb-api", () => ({
  IGDB_SEARCH_PAGE_SIZE: 10,
  searchIgdbCandidates: vi.fn(),
  searchIgdbCandidatePage: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { searchIgdbCandidatePage } from "@/lib/igdb-api";
import { prisma } from "@/lib/prisma";
import {
  applyIgdbTitle,
  cancelIgdbEnrichment,
  loadMoreIgdbCandidates,
  requestIgdbEnrichment,
  requestIgdbMatchReview,
  selectIgdbMatch,
} from "./igdb-enrichment";

const candidate = {
  id: 42,
  slug: "portal-2",
  name: "Portal 2",
  alternativeNames: [],
  category: 0,
  firstReleaseDate: "2011-04-18T00:00:00.000Z",
  coverUrl: "https://images.example/portal.jpg",
};

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    provider: "IGDB",
    status: "AWAITING_MATCH",
    stage: "MATCHING",
    attempt: 0,
    maxAttempts: 3,
    progress: 25,
    nextAttemptAt: null,
    candidatePayload: { candidates: [candidate], nextPage: 10 },
    selectedIgdbId: null,
    lastErrorCode: "AMBIGUOUS",
    lastErrorMessage: "Select an IGDB match to continue",
    ...overrides,
  };
}

describe("IGDB enrichment actions", () => {
  const findGame = vi.fn();
  const findJob = vi.fn();
  const createJob = vi.fn();
  const updateJob = vi.fn();
  const updateGame = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    (prisma as unknown as { game: unknown; enrichmentJob: unknown }).game = {
      findUnique: findGame,
      update: updateGame,
    };
    (prisma as unknown as { enrichmentJob: unknown }).enrichmentJob = {
      findUnique: findJob,
      create: createJob,
      update: updateJob,
    };
    findGame.mockResolvedValue({ id: "game-1", name: "Portal 2", libraryEntry: null, metadataSnapshots: [] });
    findJob.mockResolvedValue(null);
    createJob.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => job({ ...data, id: "job-created" }));
    updateJob.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => job({ ...data }));
    updateGame.mockImplementation(async ({ data }: { data: { name: string } }) => ({ id: "game-1", name: data.name }));
    vi.mocked(searchIgdbCandidatePage).mockResolvedValue({ ok: true, data: [], searchTerm: "Portal" });
  });

  it("rejects invalid input before reading the database", async () => {
    await expect(requestIgdbEnrichment({ gameId: "" })).resolves.toEqual({
      success: false,
      data: null,
      error: "Invalid input",
    });
    expect(findGame).not.toHaveBeenCalled();
  });

  it("rejects hidden games", async () => {
    findGame.mockResolvedValue({ id: "game-1", libraryEntry: { hidden: true }, metadataSnapshots: [] });

    await expect(requestIgdbEnrichment({ gameId: "game-1" })).resolves.toMatchObject({
      success: false,
      error: "Hidden games are not eligible for IGDB enrichment",
    });
    expect(createJob).not.toHaveBeenCalled();
  });

  it("returns the active job and guards an existing snapshot", async () => {
    findJob.mockResolvedValue(job({ status: "RUNNING" }));
    await expect(requestIgdbEnrichment({ gameId: "game-1" })).resolves.toMatchObject({
      success: true,
      data: { kind: "JOB", job: { status: "RUNNING" } },
    });

    findJob.mockResolvedValue(null);
    findGame.mockResolvedValue({
      id: "game-1",
      libraryEntry: null,
      metadataSnapshots: [{ fetchedAt: new Date("2026-09-01T00:00:00.000Z") }],
    });
    await expect(requestIgdbEnrichment({ gameId: "game-1" })).resolves.toEqual({
      success: true,
      data: { kind: "OVERWRITE_REQUIRED", existingFetchedAt: "2026-09-01T00:00:00.000Z" },
      error: null,
    });
  });

  it("queues new work and searches the catalog name for manual review", async () => {
    await expect(requestIgdbEnrichment({ gameId: "game-1", confirmOverwrite: true })).resolves.toMatchObject({
      success: true,
      data: { kind: "JOB", job: { status: "QUEUED" } },
    });
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provider: "IGDB", selectedIgdbId: null }) }));

    vi.mocked(searchIgdbCandidatePage).mockResolvedValue({ ok: true, data: [candidate], searchTerm: "Portal" });
    await expect(requestIgdbMatchReview({ gameId: "game-1" })).resolves.toMatchObject({
      success: true,
      data: { job: { status: "AWAITING_MATCH", candidates: [candidate] } },
    });
    expect(searchIgdbCandidatePage).toHaveBeenCalledWith("Portal 2", { offset: 0 });
  });

  it("validates selection and resets a valid job for the runner", async () => {
    findJob.mockResolvedValue(job());
    await expect(selectIgdbMatch({ jobId: "job-1", igdbId: 99 })).resolves.toMatchObject({
      success: false,
      error: "IGDB candidate is not available for this job",
    });
    expect(updateJob).not.toHaveBeenCalled();

    await expect(selectIgdbMatch({ jobId: "job-1", igdbId: 42 })).resolves.toMatchObject({
      success: true,
      data: { job: { status: "QUEUED", selectedIgdbId: 42, attempt: 0 } },
    });
    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ selectedIgdbId: 42, attempt: 0 }) }));
  });

  it("cancels only a job awaiting manual match", async () => {
    findJob.mockResolvedValue(job());
    await expect(cancelIgdbEnrichment({ jobId: "job-1" })).resolves.toMatchObject({
      success: true,
      data: { job: { status: "FAILED", lastErrorCode: "CANCELLED" } },
    });
    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ candidatePayload: expect.anything() }) }));
  });

  it("loads, deduplicates, and advances candidate pages by the search limit", async () => {
    findJob.mockResolvedValue({ ...job(), game: { name: "Portal 2" } });
    vi.mocked(searchIgdbCandidatePage).mockResolvedValue({ ok: true, data: [candidate, { ...candidate, id: 43, name: "Portal" }], searchTerm: null });

    await expect(loadMoreIgdbCandidates({ jobId: "job-1" })).resolves.toMatchObject({ success: true });
    expect(searchIgdbCandidatePage).toHaveBeenCalledWith("Portal 2", { offset: 10, searchTerm: undefined });
    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      candidatePayload: { candidates: [candidate, { ...candidate, id: 43, name: "Portal" }], nextPage: null },
    }) }));
  });

  it("applies the matched IGDB name", async () => {
    findGame.mockResolvedValue({
      id: "game-1",
      libraryEntry: null,
      metadataSnapshots: [{ payload: { name: "Portal 2: Still Alive" } }],
    });

    await expect(applyIgdbTitle({ gameId: "game-1" })).resolves.toEqual({
      success: true,
      data: { id: "game-1", name: "Portal 2: Still Alive" },
      error: null,
    });
    expect(updateGame).toHaveBeenCalledWith(expect.objectContaining({ data: { name: "Portal 2: Still Alive" } }));
  });
});
