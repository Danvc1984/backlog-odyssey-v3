import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/igdb-api", () => ({ fetchIgdbGameTimeToBeats: vi.fn(), fetchIgdbSteamAppId: vi.fn(), matchIgdbGame: vi.fn() }));
vi.mock("@/lib/steamspy-api", () => ({ fetchSteamSpyMedian: vi.fn() }));
vi.mock("@/lib/igdb-enrichment", () => ({
  persistIgdbIdentity: vi.fn(),
  persistDerivedSteamAppId: vi.fn(),
  persistPlaytimeEvidence: vi.fn(),
  persistIgdbSnapshot: vi.fn(),
}));
vi.mock("@/lib/compat-queue", () => ({ queueCompatibilityForGame: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { queueCompatibilityForGame } from "@/lib/compat-queue";
import { fetchIgdbGameTimeToBeats, fetchIgdbSteamAppId, matchIgdbGame } from "@/lib/igdb-api";
import { fetchSteamSpyMedian } from "@/lib/steamspy-api";
import { persistDerivedSteamAppId, persistIgdbIdentity, persistIgdbSnapshot, persistPlaytimeEvidence } from "@/lib/igdb-enrichment";
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
      externalIds: [],
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
    vi.mocked(fetchIgdbGameTimeToBeats).mockResolvedValue({ ok: true, data: null });
    vi.mocked(fetchIgdbSteamAppId).mockResolvedValue({ ok: true, data: null });
    vi.mocked(persistDerivedSteamAppId).mockResolvedValue({ applied: false, conflictName: null });
    vi.mocked(fetchSteamSpyMedian).mockResolvedValue({ ok: true, data: null });
    vi.mocked(persistPlaytimeEvidence).mockResolvedValue({ success: true, data: { gameId: "game-1", provider: "IGDB" }, error: null });
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

  it("derives a Steam identity for a manual Steam game before compatibility", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });
    findFirst.mockResolvedValue(job({ game: { ...job().game, availability: [{ steamAppId: null }], externalIds: [] } }));
    vi.mocked(fetchIgdbSteamAppId).mockResolvedValue({ ok: true, data: "620" });
    vi.mocked(persistDerivedSteamAppId).mockResolvedValue({ applied: true, conflictName: null });

    await runIgdbEnrichmentJob("job-1");

    expect(fetchIgdbSteamAppId).toHaveBeenCalledWith(42);
    expect(persistDerivedSteamAppId).toHaveBeenCalledWith("game-1", "620");
    expect(fetchSteamSpyMedian).toHaveBeenCalledWith("620");
    expect(queueCompatibilityForGame).toHaveBeenCalledWith("game-1");
  });

  it("does not derive a Steam identity for a non-Steam manual game", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });
    findFirst.mockResolvedValue(job({ game: { ...job().game, availability: [], externalIds: [] } }));

    await runIgdbEnrichmentJob("job-1");

    expect(fetchIgdbSteamAppId).not.toHaveBeenCalled();
    expect(persistDerivedSteamAppId).not.toHaveBeenCalled();
  });

  it("persists IGDB time-to-beats and does not call SteamSpy", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });
    vi.mocked(fetchIgdbGameTimeToBeats).mockResolvedValue({ ok: true, data: { count: 4, hastilySeconds: 3_600, normallySeconds: null, completelySeconds: null } });

    await runIgdbEnrichmentJob("job-1");

    expect(persistPlaytimeEvidence).toHaveBeenCalledWith("game-1", "IGDB", expect.objectContaining({ count: 4 }), "https://www.igdb.com/games/portal-2", expect.any(Date));
    expect(fetchSteamSpyMedian).not.toHaveBeenCalled();
  });

  it("falls back to SteamSpy only without usable IGDB time-to-beats and a confirmed app ID", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });
    vi.mocked(fetchSteamSpyMedian).mockResolvedValue({ ok: true, data: { medianForeverMinutes: 900 } });

    await runIgdbEnrichmentJob("job-1");

    expect(fetchSteamSpyMedian).toHaveBeenCalledWith("620");
    expect(persistPlaytimeEvidence).toHaveBeenCalledWith("game-1", "STEAMSPY", { appId: "620", medianForeverMinutes: 900 }, "https://steamspy.com/app/620", expect.any(Date));
  });

  it("does not call SteamSpy without a confirmed app ID", async () => {
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });
    findFirst.mockResolvedValue(job({ game: { ...job().game, availability: [], externalIds: [] } }));

    await runIgdbEnrichmentJob("job-1");

    expect(fetchSteamSpyMedian).not.toHaveBeenCalled();
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
