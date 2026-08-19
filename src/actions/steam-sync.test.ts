import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/steam-api", () => ({ fetchOwnedGames: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchOwnedGames } from "@/lib/steam-api";
import { lastPlayedDate } from "@/lib/steam-utils";
import { syncSteamPlaytime } from "./steam-sync";

describe("syncSteamPlaytime", () => {
  const findUniqueConnection = vi.fn();
  const createSyncRun = vi.fn();
  const updateSyncRun = vi.fn();
  const findUniqueExternalId = vi.fn();
  const updateManyAvailability = vi.fn();
  const transaction = vi.fn();
  const tx = {
    syncRun: { create: createSyncRun, update: updateSyncRun },
    externalGameId: { findUnique: findUniqueExternalId },
    gameAvailability: { updateMany: updateManyAvailability },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STEAM_WEB_API_KEY = "test-key";
    vi.mocked(requireUser).mockResolvedValue({} as never);
    (prisma as unknown as Record<string, unknown>).steamConnection = {
      findUnique: findUniqueConnection,
    };
    (prisma as unknown as Record<string, unknown>).syncRun = {
      create: createSyncRun,
      update: updateSyncRun,
    };
    (prisma as unknown as Record<string, unknown>).$transaction = transaction;
    transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    findUniqueConnection.mockResolvedValue({ id: 1, steamId64: "76561198000000000" });
    createSyncRun.mockResolvedValue({ id: "sync-1" });
    updateSyncRun.mockResolvedValue({});
    findUniqueExternalId.mockResolvedValue({ gameId: "game-1" });
    updateManyAvailability.mockResolvedValue({ count: 1 });
  });

  it("updates existing Steam availability and logs success", async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 10, name: "Portal", playtimeForever: 240, rtimeLastPlayed: 1700000100 },
    ]);

    const result = await syncSteamPlaytime();

    expect(result).toEqual({
      success: true,
      data: { synced: 1, skipped: 0, failed: 0 },
      error: null,
    });
    expect(updateManyAvailability).toHaveBeenCalledWith({
      where: { gameId: "game-1", source: "STEAM" },
      data: {
        steamPlaytimeTotal: BigInt(240),
        steamLastPlayed: new Date(1700000100000),
      },
    });
    expect(updateSyncRun).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sync-1" },
      data: expect.objectContaining({ status: "SUCCESS", counts: { synced: 1, skipped: 0, failed: 0 } }),
    }));
  });

  it("skips an app that has not been imported", async () => {
    findUniqueExternalId.mockResolvedValue(null);
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 10, name: "Portal", playtimeForever: 240, rtimeLastPlayed: 0 },
    ]);

    const result = await syncSteamPlaytime();

    expect(result.data).toEqual({ synced: 0, skipped: 1, failed: 0 });
    expect(updateManyAvailability).not.toHaveBeenCalled();
    expect(updateSyncRun).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUCCESS" }),
    }));
  });

  it("returns a failed result when Steam returns no games", async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([]);

    const result = await syncSteamPlaytime();

    expect(result).toEqual({
      success: false,
      data: { synced: 0, skipped: 0, failed: 1 },
      error: "Steam API returned no owned games",
    });
    expect(updateSyncRun).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED" }),
    }));
    expect(transaction).toHaveBeenCalled();
  });

  it("preserves the transaction error when failed-run recovery cannot find the run", async () => {
    const transactionError = new Error("availability update failed");
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 10, name: "Portal", playtimeForever: 240, rtimeLastPlayed: 0 },
    ]);
    updateManyAvailability.mockRejectedValueOnce(transactionError);
    updateSyncRun.mockRejectedValueOnce(new Error("SyncRun not found"));

    const result = await syncSteamPlaytime();

    expect(result).toEqual({
      success: false,
      data: null,
      error: "availability update failed",
    });
  });

  it("returns an error without creating a run when Steam is disconnected", async () => {
    findUniqueConnection.mockResolvedValue(null);

    const result = await syncSteamPlaytime();

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Steam account is not connected",
    });
    expect(createSyncRun).not.toHaveBeenCalled();
  });

  it("returns an error without creating a run when the API key is missing", async () => {
    delete process.env.STEAM_WEB_API_KEY;

    const result = await syncSteamPlaytime();

    expect(result).toEqual({
      success: false,
      data: null,
      error: "STEAM_WEB_API_KEY is not configured",
    });
    expect(createSyncRun).not.toHaveBeenCalled();
    expect(fetchOwnedGames).not.toHaveBeenCalled();
  });

  it("converts last-played timestamps and clears zero timestamps", () => {
    expect(lastPlayedDate(1700000000)).toEqual(new Date(1700000000000));
    expect(lastPlayedDate(0)).toBeNull();
  });
});
