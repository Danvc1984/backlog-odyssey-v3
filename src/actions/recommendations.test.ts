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

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { RUN_RETENTION_DAYS } from "@/lib/recommendations/types";
import {
  dismissRecommendation,
  updateRecommendations,
} from "./recommendations";

const transaction = vi.fn();
const runCreate = vi.fn();
const runDeleteMany = vi.fn();
const gameFindMany = vi.fn();
const feedbackCreate = vi.fn();

function txFactory() {
  return {
    recommendationRun: { create: runCreate, deleteMany: runDeleteMany },
    recommendationFeedback: { create: feedbackCreate },
    game: { findMany: gameFindMany },
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
  runDeleteMany.mockResolvedValue({ count: 2 });
  runCreate.mockImplementation(async ({ data }: { data: { kind: string } }) => ({
    id: data.kind === "PLAY_NEXT" ? "run-play" : "run-buy",
  }));
  feedbackCreate.mockResolvedValue({ id: "feedback-1" });
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

  it("writes the locked context JSON and an empty BUY run", async () => {
    gameFindMany.mockResolvedValue([baseRow()]);

    await updateRecommendations();

    for (const call of runCreate.mock.calls as Array<[{ data: { context: unknown; kind: string } }]>) {
      expect(call[0].data.context).toEqual({
        eligible: { playNext: 1, buy: 0 },
        prunedRuns: 2,
      });
      if (call[0].data.kind === "BUY") {
        expect(call[0].data).not.toHaveProperty("items");
      }
    }
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
