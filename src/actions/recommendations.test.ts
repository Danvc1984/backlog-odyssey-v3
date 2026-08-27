import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/protondb-api", () => ({
  parseProtonDbSummary: vi.fn((_appId: string, payload: unknown) => {
    const candidate = payload as { status?: string; tier?: string; confidence?: string } | null;
    if (!candidate?.status) return null;
    return {
      appId: _appId,
      status: candidate.status,
      tier: candidate.tier ?? "borked",
      confidence: candidate.confidence ?? "weak",
      raw: candidate,
    };
  }),
}));
vi.mock("@/lib/recommendations/events", () => ({
  logRecommendationEvent: vi.fn(),
  pruneRecommendationEvents: vi.fn().mockResolvedValue(0),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RUN_RETENTION_DAYS } from "@/lib/recommendations/types";
import { logRecommendationEvent } from "@/lib/recommendations/events";
import {
  dismissRecommendation,
  recordRunExposure,
  restartRecommendations,
  updateRecommendations,
} from "./recommendations";

const transaction = vi.fn();
const runCreate = vi.fn();
const runDeleteMany = vi.fn();
const gameFindMany = vi.fn();
const wishlistFindMany = vi.fn();
const feedbackCreate = vi.fn();
const eventCreate = vi.fn();
const eventCreateMany = vi.fn();
const eventDeleteMany = vi.fn();
const feedbackDeleteMany = vi.fn();

function txFactory() {
  return {
    recommendationRun: { create: runCreate, deleteMany: runDeleteMany },
    recommendationFeedback: { create: feedbackCreate, deleteMany: feedbackDeleteMany },
    recommendationEvent: { create: eventCreate, createMany: eventCreateMany, deleteMany: eventDeleteMany },
    game: { findMany: gameFindMany },
    wishlistEntry: { findMany: wishlistFindMany },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({} as never);
  transaction.mockImplementation(async (callback: (tx: ReturnType<typeof txFactory>) => unknown) =>
    callback(txFactory()),
  );
  const prismaMock = prisma as unknown as Record<string, unknown>;
  prismaMock.$transaction = transaction;
  prismaMock.recommendationFeedback = { create: feedbackCreate };
  prismaMock.recommendationEvent = { create: eventCreate, createMany: eventCreateMany, deleteMany: eventDeleteMany };
  runDeleteMany.mockResolvedValue({ count: 2 });
  runCreate.mockImplementation(async ({ data }: { data: { kind: string } }) => ({
    id: data.kind === "PLAY_NEXT" ? "run-play" : "run-buy",
  }));
  feedbackCreate.mockResolvedValue({ id: "feedback-1" });
  eventCreateMany.mockResolvedValue({ count: 0 });
  eventDeleteMany.mockResolvedValue({ count: 0 });
  feedbackDeleteMany.mockResolvedValue({ count: 0 });
  gameFindMany.mockResolvedValue([]);
  wishlistFindMany.mockResolvedValue([]);
});

interface CandidateRowShape {
  id: string;
  name: string;
  type: "BASE_GAME";
  libraryEntry: {
    playState: "NOT_STARTED" | "IN_PROGRESS" | "PLAYED_BEFORE" | "ABANDONED";
    priority: "NONE" | "LOW" | "MEDIUM" | "HIGH";
    interest: number | null;
    playSoon: boolean;
    replayCandidate: boolean;
    hidden: boolean;
    isMainGame: boolean;
  };
  externalIds: { externalId: string }[];
  availability: { source: "STEAM" | "OTHER_PLATFORM" | "ROM" }[];
  compatSnapshots: { provider: string; result: unknown; fetchedAt: Date }[];
}

function libraryEntry(
  overrides: Partial<CandidateRowShape["libraryEntry"]> = {},
): CandidateRowShape["libraryEntry"] {
  return {
    playState: "NOT_STARTED",
    priority: "NONE",
    interest: null,
    playSoon: false,
    replayCandidate: false,
    hidden: false,
    isMainGame: false,
    ...overrides,
  };
}

function baseRow(): CandidateRowShape {
  return {
    id: "game-1",
    name: "Portal 2",
    type: "BASE_GAME",
    libraryEntry: libraryEntry(),
    externalIds: [{ externalId: "620" }],
    availability: [{ source: "STEAM" }],
    compatSnapshots: [
      {
        provider: "PROTONDB",
        result: { status: "READY", tier: "gold", confidence: "strong" },
        fetchedAt: new Date("2026-08-01T00:00:00.000Z"),
      },
      {
        provider: "ARE_WE_ANTICHEAT_YET",
        result: { status: "Denied", anticheats: ["Easy Anti-Cheat"] },
        fetchedAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ],
  };
}

interface BuyRowShape {
  id: string;
  name: string;
  type: "BASE_GAME" | "DLC";
  interest: number | null;
  targetPriceMxn: string | null;
  updatedAt: Date;
  baseGameId: string | null;
  offers: Array<{
    price: string | null;
    currency: string;
    discount: number | null;
    historicalLow: string | null;
    sourceHistoricalLow: string | null;
    expiresAt: Date | null;
    fetchedAt: Date;
    itadFlag: string | null;
  }>;
}

const NOW = new Date("2026-08-26T12:00:00.000Z");

function buyOffer(overrides: Partial<BuyRowShape["offers"][number]> = {}): BuyRowShape["offers"][number] {
  return {
    price: "299.00",
    currency: "MXN",
    discount: null,
    historicalLow: null,
    sourceHistoricalLow: null,
    expiresAt: null,
    fetchedAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
    itadFlag: null,
    ...overrides,
  };
}

function buyRow(overrides: Partial<BuyRowShape> = {}): BuyRowShape {
  return {
    id: "wish-1",
    name: "Portal 2",
    type: "BASE_GAME",
    interest: 2,
    targetPriceMxn: null,
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    baseGameId: null,
    offers: [buyOffer()],
    ...overrides,
  };
}

describe("updateRecommendations", () => {
  it("requires authentication before touching the database", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await updateRecommendations();

    expect(result).toEqual({ success: false, data: null, error: "Unauthorized" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("creates both runs in one transaction with items capped at three and full explanations", async () => {
    const rows: CandidateRowShape[] = [
      { ...baseRow(), libraryEntry: libraryEntry({ interest: 5 }) },
    ];
    for (let index = 1; index <= 4; index += 1) {
      rows.push({
        ...baseRow(),
        id: `game-${index}`,
        name: `Game ${index}`,
        libraryEntry: libraryEntry({ interest: index }),
      });
    }
    gameFindMany.mockResolvedValue(rows);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      playNextItems: 3,
      playNextEligible: 5,
      prunedRuns: 2,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(runCreate).toHaveBeenCalledTimes(2);

    const playNextCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT",
    )!;
    const items = playNextCall[0].data.items.create;
    expect(items).toHaveLength(3);
    expect(items.map((item: { rank: number }) => item.rank)).toEqual([1, 2, 3]);
    expect(items[0]).toMatchObject({
      gameId: "game-1",
      score: 50,
    });
    expect(items[0].positive).toEqual([
      { factor: "interest", label: "Interest 5", points: 50 },
      { factor: "compat_bazzite", label: "Runs well on Bazzite", points: 0 },
    ]);
    expect(items[0].caveats).toEqual([{ factor: "anticheat", label: "Anti-cheat blocks Linux" }]);
  });

  it("writes the locked context JSON with buy counts and empty-BUY fallback", async () => {
    gameFindMany.mockResolvedValue([baseRow()]);

    const result = await updateRecommendations();

    for (const call of runCreate.mock.calls as Array<[{ data: { context: unknown; kind: string; items?: { create: unknown[] } } }]>) {
      expect(call[0].data.context).toEqual({
        eligible: { playNext: 1, buy: 0 },
        prunedRuns: 2,
        prunedEvents: 0,
      });
      if (call[0].data.kind === "BUY") {
        expect(call[0].data.items?.create).toEqual([]);
      }
    }
    expect(result.data).toMatchObject({ buyItems: 0, buyEligible: 0 });
  });

  it("persists BUY items with ranks, scores, factors, and caveats from persisted offers", async () => {
    wishlistFindMany.mockResolvedValue([
      {
        ...buyRow(),
        interest: 3,
        offers: [buyOffer({ discount: 50 })],
      },
      {
        ...buyRow(),
        id: "wish-2",
        name: "Expansion",
        type: "DLC" as const,
        baseGameId: "game-1",
        interest: null,
        targetPriceMxn: "350.00",
        updatedAt: new Date("2026-08-21T00:00:00.000Z"),
        offers: [buyOffer()],
      },
    ]);
    gameFindMany
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() =>
        Promise.resolve([
          {
            id: "game-1",
            availability: [{ source: "STEAM" }],
            libraryEntry: { rating: 5, playState: "PLAYED_BEFORE", replayCandidate: false },
          },
        ]),
      );

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ buyItems: 2, buyEligible: 2 });
    const buyCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "BUY",
    )!;
    const items = buyCall[0].data.items.create;
    expect(items.map((item: { rank: number }) => item.rank)).toEqual([1, 2]);
    expect(items[0]).toMatchObject({
      wishlistEntryId: "wish-1",
      score: 35,
    });
    expect(items[0].positive).toContainEqual({ factor: "offer_discount", label: "50% off", points: 5 });
    expect(items[1]).toMatchObject({
      wishlistEntryId: "wish-2",
      score: 8 + 6,
    });
    expect(items[1].positive).toContainEqual({ factor: "target_hit", label: "At or below target $350", points: 8 });
    expect(items[1].positive).toContainEqual({ factor: "dlc_affinity", label: "Owned base game you enjoyed", points: 6 });
  });

  it("prunes runs older than the 12-month cutoff only", async () => {
    const before = Date.now();
    gameFindMany.mockResolvedValue([baseRow()]);

    await updateRecommendations();

    const after = Date.now();
    expect(runDeleteMany).toHaveBeenCalledTimes(1);
    const call = runDeleteMany.mock.calls[0][0] as {
      where: { createdAt: { lt: Date } };
    };
    const expectedLow = before - RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expectedHigh = after - RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(call.where.createdAt.lt.getTime()).toBeGreaterThanOrEqual(expectedLow);
    expect(call.where.createdAt.lt.getTime()).toBeLessThanOrEqual(expectedHigh);
  });

  it("creates a successful empty run when nothing is eligible", async () => {
    gameFindMany.mockResolvedValue([
      { ...baseRow(), libraryEntry: libraryEntry({ playState: "IN_PROGRESS" }) },
    ]);

    const result = await updateRecommendations();

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ playNextItems: 0, playNextEligible: 0 });
    const playNextCall = runCreate.mock.calls.find(
      (call) => (call[0] as { data: { kind: string } }).data.kind === "PLAY_NEXT",
    )!;
    expect(playNextCall[0].data.items.create).toEqual([]);
  });
});

describe("dismissRecommendation", () => {
  it("inserts one log row with the given target and kind", async () => {
    const result = await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT" });

    expect(result.success).toBe(true);
    expect(feedbackCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { gameId: "game-1", wishlistEntryId: null, kind: "PLAY_NEXT" },
      }),
    );
  });

  it("logs a dismissal event with its reason and run", async () => {
    const result = await dismissRecommendation({
      gameId: "game-1",
      kind: "PLAY_NEXT",
      runId: "run-1",
      reason: "Already playing something else",
    });

    expect(result.success).toBe(true);
    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, {
      kind: "DISMISSAL",
      gameId: "game-1",
      wishlistEntryId: undefined,
      runId: "run-1",
      reason: "Already playing something else",
    });
  });

  it("keeps the dismissal successful when event logging fails", async () => {
    vi.mocked(logRecommendationEvent).mockRejectedValueOnce(new Error("event unavailable"));

    const result = await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT" });

    expect(result).toEqual({ success: true, data: { id: "feedback-1" }, error: null });
  });

  it("trims reasons and rejects reasons over 500 characters", async () => {
    await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT", reason: "  Not now  " });
    expect(logRecommendationEvent).toHaveBeenCalledWith(prisma, expect.objectContaining({ reason: "Not now" }));

    const invalid = await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT", reason: "x".repeat(501) });
    expect(invalid.success).toBe(false);
  });

  it("rejects input without exactly one target", async () => {
    const none = await dismissRecommendation({ kind: "PLAY_NEXT" });
    const both = await dismissRecommendation({
      gameId: "game-1",
      wishlistEntryId: "wish-1",
      kind: "PLAY_NEXT",
    });

    expect(none).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(both).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("rejects unknown kinds and extra fields", async () => {
    const badKind = await dismissRecommendation({ gameId: "game-1", kind: "MAYBE" });
    const extraField = await dismissRecommendation({ gameId: "game-1", note: "x", kind: "BUY" });

    expect(badKind.error).toBe("Invalid input");
    expect(extraField.error).toBe("Invalid input");
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("returns auth failures in the standard shape", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await dismissRecommendation({ gameId: "game-1", kind: "PLAY_NEXT" });

    expect(result).toEqual({ success: false, data: null, error: "Unauthorized" });
    expect(feedbackCreate).not.toHaveBeenCalled();
  });
});

describe("recordRunExposure", () => {
  it("creates one exposure event per valid item", async () => {
    eventCreateMany.mockResolvedValue({ count: 2 });

    const result = await recordRunExposure({
      runId: "run-1",
      items: [{ gameId: "game-1" }, { wishlistEntryId: "wish-1" }],
    });

    expect(result).toEqual({ success: true, data: { count: 2 }, error: null });
    expect(eventCreateMany).toHaveBeenCalledWith({
      data: [
        { runId: "run-1", kind: "EXPOSURE", gameId: "game-1", wishlistEntryId: null },
        { runId: "run-1", kind: "EXPOSURE", gameId: null, wishlistEntryId: "wish-1" },
      ],
    });
  });

  it("treats an empty item list as a no-op and rejects malformed targets", async () => {
    const empty = await recordRunExposure({ runId: "run-1", items: [] });
    const invalid = await recordRunExposure({ runId: "run-1", items: [{ gameId: "game-1", wishlistEntryId: "wish-1" }] });

    expect(empty).toEqual({ success: true, data: { count: 0 }, error: null });
    expect(invalid.success).toBe(false);
    expect(eventCreateMany).not.toHaveBeenCalled();
  });
});

describe("restartRecommendations", () => {
  it("deletes recommendation-owned tables and returns counts", async () => {
    const tx = txFactory();
    tx.recommendationEvent.deleteMany.mockResolvedValue({ count: 4 });
    tx.recommendationFeedback.deleteMany.mockResolvedValue({ count: 2 });
    tx.recommendationRun.deleteMany.mockResolvedValue({ count: 3 });
    transaction.mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await restartRecommendations();

    expect(result).toEqual({
      success: true,
      data: { recommendationEvent: 4, recommendationFeedback: 2, recommendationRun: 3 },
      error: null,
    });
    expect(tx.recommendationEvent.deleteMany).toHaveBeenCalledWith({});
    expect(tx.recommendationFeedback.deleteMany).toHaveBeenCalledWith({});
    expect(tx.recommendationRun.deleteMany).toHaveBeenCalledWith({});
  });

  it("succeeds with zero counts when no recommendation data exists", async () => {
    runDeleteMany.mockResolvedValueOnce({ count: 0 });
    const result = await restartRecommendations();
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ recommendationEvent: 0, recommendationFeedback: 0, recommendationRun: 0 });
  });
});
