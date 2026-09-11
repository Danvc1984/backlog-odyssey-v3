import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/igdb-api", () => ({ matchIgdbGame: vi.fn() }));
vi.mock("@/lib/igdb-enrichment", () => ({
  persistIgdbIdentity: vi.fn(),
  persistIgdbSnapshot: vi.fn(),
}));
vi.mock("@/lib/compat-queue", () => ({ queueCompatibilityForGame: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { queueCompatibilityForGame } from "@/lib/compat-queue";
import { matchIgdbGame } from "@/lib/igdb-api";
import { persistIgdbIdentity, persistIgdbSnapshot } from "@/lib/igdb-enrichment";
import { runIgdbEnrichmentJob } from "./igdb-job-runner";

const game = { id: 42, slug: "portal-2", name: "Portal 2", category: 0 };
const candidate = {
  id: 42,
  slug: "portal-2",
  name: "Portal 2",
  alternativeNames: [],
  category: 0,
  firstReleaseDate: "2011-04-18T00:00:00.000Z",
  coverUrl: null,
};

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    provider: "IGDB",
    status: "QUEUED",
    stage: "MATCHING",
    attempt: 1,
    maxAttempts: 3,
    progress: 25,
    nextAttemptAt: null,
    candidatePayload: null,
    selectedIgdbId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    game: {
      id: "game-1",
      name: "Portal 2",
      type: "BASE_GAME",
      availability: [{ steamAppId: "620" }],
    },
    ...overrides,
  };
}

describe("IGDB job runner", () => {
  const updateMany = vi.fn();
  const findFirst = vi.fn();
  const update = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as { enrichmentJob: unknown }).enrichmentJob = { updateMany, findFirst, update };
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue(job());
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => job({ ...data }));
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "NOT_FOUND" });
    vi.mocked(persistIgdbIdentity).mockResolvedValue({ success: true, data: { gameId: "game-1", igdbId: 42 }, error: null });
    vi.mocked(persistIgdbSnapshot).mockResolvedValue({ success: true, data: { gameId: "game-1", fetchedAt: new Date() }, error: null });
    vi.mocked(queueCompatibilityForGame).mockResolvedValue(null);
  });

  it("claims and passes Steam identity, selected ID, and catalog class to matching", async () => {
    await runIgdbEnrichmentJob("job-1");

    expect(matchIgdbGame).toHaveBeenCalledWith({
      title: "Portal 2",
      category: "MAIN_GAME",
      steamAppId: "620",
      selectedIgdbId: null,
    });
  });

  it("stores ambiguity for manual review", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "AMBIGUOUS", candidates: [candidate] });

    const result = await runIgdbEnrichmentJob("job-1");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: "AWAITING_MATCH",
      candidatePayload: { candidates: [candidate], nextPage: null },
    }) }));
    expect(result).toMatchObject({ success: true, data: { status: "AWAITING_MATCH", candidates: [candidate] } });
  });

  it("persists identity and snapshot before best-effort compatibility and succeeds", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });

    const result = await runIgdbEnrichmentJob("job-1");

    expect(persistIgdbIdentity).toHaveBeenCalledWith("game-1", expect.objectContaining({ outcome: "MATCHED" }));
    expect(persistIgdbSnapshot).toHaveBeenCalledWith("game-1", game, expect.any(Date));
    expect(queueCompatibilityForGame).toHaveBeenCalledWith("game-1");
    expect(result).toMatchObject({ success: true, data: { status: "SUCCEEDED", progress: 100 } });
  });

  it("does not hide an identity conflict behind a successful snapshot", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });
    vi.mocked(persistIgdbIdentity).mockResolvedValue({
      success: false,
      data: null,
      error: { code: "IGDB_ID_CONFLICT", message: "conflict" },
    });

    const result = await runIgdbEnrichmentJob("job-1");

    expect(persistIgdbSnapshot).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, data: { status: "FAILED", lastErrorCode: "IGDB_ID_CONFLICT" } });
  });

  it("keeps IGDB success when compatibility queue fails", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });
    vi.mocked(queueCompatibilityForGame).mockRejectedValueOnce(new Error("compat unavailable"));

    await expect(runIgdbEnrichmentJob("job-1")).resolves.toMatchObject({
      success: true,
      data: { status: "SUCCEEDED" },
    });
  });

  it("retries retryable provider failures and exhausts them terminally", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "UNAVAILABLE", error: { category: "NETWORK", message: "down" } });
    await expect(runIgdbEnrichmentJob("job-1")).resolves.toMatchObject({ success: true, data: { status: "RETRY_WAIT" } });

    findFirst.mockResolvedValue(job({ attempt: 3, status: "RETRY_WAIT" }));
    await expect(runIgdbEnrichmentJob("job-1")).resolves.toMatchObject({ success: true, data: { status: "FAILED", lastErrorCode: "NETWORK" } });
  });
});
