import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/recommendations/run-pipeline", () => ({ runRecommendationPipeline: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { runRecommendationPipeline } from "@/lib/recommendations/run-pipeline";
import { updateOsSetup } from "./settings";

const transaction = vi.fn();
const settingsUpsert = vi.fn();
const gameFindMany = vi.fn();
const wishlistFindMany = vi.fn();
const environmentUpsert = vi.fn();
const wishlistEnvironmentUpsert = vi.fn();

const validSetup = {
  primaryOs: "LINUX" as const,
  hasWindowsFallback: true,
  handheldOs: "LINUX" as const,
  onboardingCompleted: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({} as never);
  settingsUpsert.mockResolvedValue({ id: 1, ...validSetup });
  gameFindMany.mockResolvedValue([
    {
      id: "game-1",
      name: "Portal 2",
      externalIds: [{ externalId: "620" }],
      compatSnapshots: [
        { provider: "PROTONDB", result: { confidence: "strong", tier: "gold" } },
        { provider: "ARE_WE_ANTICHEAT_YET", result: { status: "Denied", anticheats: [] } },
      ],
    },
    {
      id: "game-2",
      name: "Manual game",
      externalIds: [],
      compatSnapshots: [],
    },
  ]);
  wishlistFindMany.mockResolvedValue([
    {
      id: "wish-1",
      name: "Hades",
      steamAppId: "1145360",
      compatSnapshots: [],
    },
  ]);
  environmentUpsert.mockResolvedValue({});
  wishlistEnvironmentUpsert.mockResolvedValue({});
  vi.mocked(runRecommendationPipeline).mockResolvedValue({
    playNextRunId: "play-1",
    buyRunId: "buy-1",
    playNextItems: 0,
    playNextEligible: 0,
    buyItems: 0,
    buyEligible: 0,
    prunedRuns: 0,
    prunedEvents: 0,
    profile: { rebuiltAt: "2026-09-07T00:00:00.000Z", eventsConsidered: 0 },
  });

  const tx = {
    appSettings: { upsert: settingsUpsert },
    game: { findMany: gameFindMany },
    wishlistEntry: { findMany: wishlistFindMany },
    environmentCompatibility: { upsert: environmentUpsert },
    wishlistEnvironmentCompatibility: { upsert: wishlistEnvironmentUpsert },
  };
  transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
});

describe("updateOsSetup", () => {
  it("persists setup, re-derives catalog and wishlist rows, and regenerates runs", async () => {
    const result = await updateOsSetup(validSetup);

    expect(result.success).toBe(true);
    expect(settingsUpsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, ...validSetup },
      update: validSetup,
    });
    expect(environmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId_environment: { gameId: "game-1", environment: "LINUX" } },
      create: expect.objectContaining({ status: "READY" }),
    }));
    expect(environmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId_environment: { gameId: "game-1", environment: "WINDOWS" } },
      create: expect.objectContaining({ status: "REQUIRED" }),
    }));
    expect(environmentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { gameId_environment: { gameId: "game-2", environment: "LINUX" } },
      create: expect.objectContaining({ status: "UNKNOWN" }),
    }));
    expect(wishlistEnvironmentUpsert).toHaveBeenCalledTimes(2);
    expect(runRecommendationPipeline).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({ catalogGames: 2, wishlistEntries: 1 });
  });

  it("rejects invalid setup before opening a transaction", async () => {
    const result = await updateOsSetup({ ...validSetup, primaryOs: "WINDOWS", hasWindowsFallback: true });

    expect(result).toEqual({ success: false, data: null, error: "Invalid OS setup" });
    expect(transaction).not.toHaveBeenCalled();
  });
});
