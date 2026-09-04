import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rawg-api", () => ({ matchRawgGame: vi.fn() }));
vi.mock("@/lib/rawg-enrichment", () => ({ persistRawgMatch: vi.fn() }));
vi.mock("@/lib/compat-queue", () => ({ queueCompatibilityForGame: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { matchRawgGame } from "@/lib/rawg-api";
import { persistRawgMatch } from "@/lib/rawg-enrichment";
import { queueCompatibilityForGame } from "@/lib/compat-queue";
import { runRawgEnrichmentJob } from "./rawg-job-runner";

const matchedGame = {
  id: 123,
  slug: "portal-2",
  name: "Portal 2",
  description: null,
  released: "2011-04-18",
  backgroundImage: null,
  backgroundImageAdditional: null,
  genres: [],
  tags: [],
  developers: [],
  publishers: [],
  website: null,
  rating: null,
  metacritic: null,
  playtime: null,
  alternativeNames: [],
  rawgUpdatedAt: null,
  rawgUrl: "https://rawg.io/games/portal-2",
  stores: [],
  esrbRating: null,
  seriesGames: [],
  screenshots: [],
  palette: null,
};

const candidate = {
  id: 123,
  slug: "portal-2",
  name: "Portal 2",
  released: "2011-04-18",
  backgroundImage: null,
};

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    provider: "RAWG",
    status: "QUEUED",
    stage: "MATCHING",
    attempt: 1,
    maxAttempts: 3,
    progress: 25,
    nextAttemptAt: null,
    candidatePayload: null,
    selectedRawgId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    game: {
      id: "game-1",
      name: "Portal 2",
      availability: [{ steamAppId: "620" }],
    },
    ...overrides,
  };
}

describe("RAWG job runner", () => {
  const updateMany = vi.fn();
  const findFirst = vi.fn();
  const update = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as unknown as {
      enrichmentJob: {
        updateMany: typeof updateMany;
        findFirst: typeof findFirst;
        update: typeof update;
      };
    }).enrichmentJob = { updateMany, findFirst, update };
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue(job());
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      job({ ...data }),
    );
    vi.mocked(matchRawgGame).mockResolvedValue({ outcome: "NOT_FOUND" });
    vi.mocked(persistRawgMatch).mockResolvedValue({
      success: true,
      data: { gameId: "game-1", rawgId: 123, fetchedAt: new Date() },
      error: null,
    });
    vi.mocked(queueCompatibilityForGame).mockResolvedValue(null);
  });

  it("lets only the claimant run work when another claimant wins the race", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue(job({ status: "RUNNING", progress: 25 }));

    const result = await runRawgEnrichmentJob("job-1");

    expect(result).toMatchObject({ success: true, data: { status: "RUNNING" } });
    expect(matchRawgGame).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "job-1", provider: "RAWG" }),
      }),
    );
  });

  it("forwards the catalog title and selected match without a Steam App ID", async () => {
    findFirst.mockResolvedValue(
      job({ selectedRawgId: 456, game: { id: "game-1", name: "Portal 2", availability: [{ steamAppId: "620" }] } }),
    );
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "NOT_FOUND",
    });

    await runRawgEnrichmentJob("job-1");

    expect(matchRawgGame).toHaveBeenCalledWith({
      title: "Portal 2",
      selectedRawgId: 456,
    });
  });

  it("does not use Steam App IDs when resolving a match", async () => {
    findFirst.mockResolvedValue(
      job({
        game: {
          id: "game-1",
          name: "Portal 2",
          availability: [{ steamAppId: "not-a-number" }, { steamAppId: "620" }],
        },
      }),
    );

    await runRawgEnrichmentJob("job-1");

    expect(matchRawgGame).toHaveBeenCalledWith({ title: "Portal 2", selectedRawgId: null });
  });

  it("persists a matched game through the existing helper and completes the job", async () => {
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "MATCHED",
      matchMethod: "EXACT_STEAM_APP_ID",
      game: matchedGame,
    });

    const result = await runRawgEnrichmentJob("job-1");

    expect(persistRawgMatch).toHaveBeenCalledWith(
      "game-1",
      expect.objectContaining({ outcome: "MATCHED", game: matchedGame }),
      expect.any(Date),
    );
    expect(queueCompatibilityForGame).toHaveBeenCalledWith("game-1");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "SUCCEEDED", stage: "COMPLETE", progress: 100 }),
      }),
    );
    expect(result).toMatchObject({ success: true, data: { status: "SUCCEEDED", progress: 100 } });
  });

  it("keeps RAWG successful when compatibility queue skips the game", async () => {
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "MATCHED",
      matchMethod: "EXACT_STEAM_APP_ID",
      game: matchedGame,
    });
    vi.mocked(queueCompatibilityForGame).mockResolvedValue(null);

    const result = await runRawgEnrichmentJob("job-1");

    expect(queueCompatibilityForGame).toHaveBeenCalledWith("game-1");
    expect(result).toMatchObject({ success: true, data: { status: "SUCCEEDED" } });
  });

  it("keeps RAWG successful when compatibility queue fails", async () => {
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "MATCHED",
      matchMethod: "EXACT_STEAM_APP_ID",
      game: matchedGame,
    });
    vi.mocked(queueCompatibilityForGame).mockRejectedValueOnce(new Error("compat unavailable"));

    const result = await runRawgEnrichmentJob("job-1");

    expect(result).toMatchObject({ success: true, data: { status: "SUCCEEDED" } });
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCEEDED" }) }),
    );
  });

  it("stores ambiguous candidates without changing metadata", async () => {
    vi.mocked(matchRawgGame).mockResolvedValue({ outcome: "AMBIGUOUS", candidates: [candidate] });

    const result = await runRawgEnrichmentJob("job-1");

    expect(persistRawgMatch).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "AWAITING_MATCH",
          lastErrorCode: "AMBIGUOUS",
          candidatePayload: { candidates: [candidate], nextPage: 2 },
        }),
      }),
    );
    expect(result).toMatchObject({
      success: true,
      data: { status: "AWAITING_MATCH", candidates: [candidate], hasMoreCandidates: true },
    });
  });

  it("turns a no-match result into a terminal failure without persistence", async () => {
    const result = await runRawgEnrichmentJob("job-1");

    expect(persistRawgMatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      data: { status: "FAILED", lastErrorCode: "NOT_FOUND", lastErrorMessage: "No RAWG match was found" },
    });
  });

  it.each([
    ["NETWORK", undefined],
    ["HTTP", 429],
    ["HTTP", 503],
  ] as const)("schedules a retry for retryable %s failures", async (category, status) => {
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "UNAVAILABLE",
      error: { category, status, message: "provider detail" },
    });

    const result = await runRawgEnrichmentJob("job-1");
    const retryUpdate = update.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };

    expect(retryUpdate.data.status).toBe("RETRY_WAIT");
    expect(retryUpdate.data.stage).toBe("RETRYING");
    expect(retryUpdate.data.nextAttemptAt).toEqual(expect.any(Date));
    expect(result).toMatchObject({ success: true, data: { status: "RETRY_WAIT" } });
  });

  it.each([
    ["CONFIGURATION", undefined],
    ["MALFORMED_RESPONSE", 200],
    ["HTTP", 400],
  ] as const)("makes non-retryable %s failures terminal", async (category, status) => {
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "UNAVAILABLE",
      error: { category, status, message: "provider detail" },
    });

    const result = await runRawgEnrichmentJob("job-1");

    expect(result).toMatchObject({ success: true, data: { status: "FAILED", lastErrorCode: category } });
  });

  it("makes an exhausted retry terminal", async () => {
    findFirst.mockResolvedValue(job({ attempt: 3, status: "RETRY_WAIT", progress: 25 }));
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "UNAVAILABLE",
      error: { category: "NETWORK", message: "provider detail" },
    });

    const result = await runRawgEnrichmentJob("job-1");

    expect(result).toMatchObject({ success: true, data: { status: "FAILED", lastErrorCode: "NETWORK" } });
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("treats an identity conflict as terminal and leaves persistence to the transactional helper", async () => {
    vi.mocked(matchRawgGame).mockResolvedValue({
      outcome: "MATCHED",
      matchMethod: "MANUAL_RAWG_SEARCH",
      game: matchedGame,
    });
    vi.mocked(persistRawgMatch).mockResolvedValue({
      success: false,
      data: null,
      error: {
        code: "RAWG_ID_CONFLICT",
        message: "RAWG game identity is already attached to another catalog game",
      },
    });

    const result = await runRawgEnrichmentJob("job-1");

    expect(result).toMatchObject({
      success: true,
      data: { status: "FAILED", lastErrorCode: "RAWG_ID_CONFLICT" },
    });
    expect(persistRawgMatch).toHaveBeenCalledTimes(1);
  });
});
