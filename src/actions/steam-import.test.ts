import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/steam-api", () => ({ fetchOwnedGames: vi.fn() }));
vi.mock("@/lib/rawg-import-queue", () => ({ queueRawgForImportedGames: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchOwnedGames } from "@/lib/steam-api";
import { queueRawgForImportedGames } from "@/lib/rawg-import-queue";
import { importSteamGames } from "./steam-import";

describe("importSteamGames", () => {
  const findUniqueConnection = vi.fn();
  const findUniqueExternalId = vi.fn();
  const updateManyAvailability = vi.fn();
  const upsertLibraryEntry = vi.fn();
  const createGame = vi.fn();
  const updateConnection = vi.fn();
  const upsertUnresolvedDlc = vi.fn();
  const transaction = vi.fn();
  const tx = {
    externalGameId: { findUnique: findUniqueExternalId },
    game: { create: createGame },
    gameAvailability: { updateMany: updateManyAvailability },
    libraryEntry: { upsert: upsertLibraryEntry },
    steamConnection: { update: updateConnection },
    unresolvedSteamDlc: { upsert: upsertUnresolvedDlc },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STEAM_WEB_API_KEY = "test-key";
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma as unknown as { steamConnection: unknown }).steamConnection = {
      findUnique: findUniqueConnection,
    };
    (prisma as unknown as { $transaction: typeof transaction }).$transaction =
      transaction;
    transaction.mockImplementation(
      async (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    findUniqueConnection.mockResolvedValue({
      id: 1,
      steamId64: "76561198000000000",
    });
    findUniqueExternalId.mockResolvedValue(null);
    updateManyAvailability.mockResolvedValue({ count: 1 });
    upsertLibraryEntry.mockResolvedValue({});
    createGame.mockResolvedValue({ id: "game-new" });
    updateConnection.mockResolvedValue({});
    upsertUnresolvedDlc.mockResolvedValue({});
    vi.mocked(queueRawgForImportedGames).mockResolvedValue({
      batchId: "batch-1",
      queued: 1,
      skipped: 0,
    });
  });

  it("creates new games, external IDs, and Steam availability", async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      {
        appid: 10,
        name: "Portal",
        playtimeForever: 120,
        rtimeLastPlayed: 1700000000,
      },
    ]);

    const result = await importSteamGames();

    expect(result).toEqual({
      success: true,
      data: {
        imported: 1,
        updated: 0,
        rawgQueue: { status: "QUEUED", batchId: "batch-1", queued: 1, skipped: 0 },
      },
      error: null,
    });
    expect(fetchOwnedGames).toHaveBeenCalledWith(
      "76561198000000000",
      "test-key",
    );
    expect(createGame).toHaveBeenCalledWith({
      data: {
        type: "BASE_GAME",
        origin: "STEAM_IMPORT",
        name: "Portal",
        libraryEntry: { create: {} },
        externalIds: {
          create: {
            namespaceId: "10",
            namespace: "STEAM_APP",
            externalId: "10",
            matchMethod: "EXACT_STEAM_APP_ID",
          },
        },
        availability: {
          create: {
            source: "STEAM",
            steamAppId: "10",
            steamPlaytimeTotal: BigInt(120),
            steamLastPlayed: new Date(1700000000000),
          },
        },
      },
      select: { id: true },
    });
    expect(queueRawgForImportedGames).toHaveBeenCalledWith(["game-new"]);
    expect(updateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ counts: { imported: 1, updated: 0 } }),
      }),
    );
  });

  it("updates playtime and last played for an existing Steam game", async () => {
    findUniqueExternalId.mockResolvedValue({ gameId: "game-1" });
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      {
        appid: 10,
        name: "Portal",
        playtimeForever: 240,
        rtimeLastPlayed: 1700000100,
      },
    ]);

    const result = await importSteamGames();

    expect(result.data).toEqual({
      imported: 0,
      updated: 1,
      rawgQueue: { status: "QUEUED", batchId: null, queued: 0, skipped: 0 },
    });
    expect(updateManyAvailability).toHaveBeenCalledWith({
      where: { gameId: "game-1", source: "STEAM" },
      data: {
        source: "STEAM",
        steamAppId: "10",
        steamPlaytimeTotal: BigInt(240),
        steamLastPlayed: new Date(1700000100000),
      },
    });
    expect(createGame).not.toHaveBeenCalled();
    expect(upsertLibraryEntry).toHaveBeenCalledWith({
      where: { gameId: "game-1" },
      create: { gameId: "game-1" },
      update: {},
    });
    expect(queueRawgForImportedGames).not.toHaveBeenCalled();
  });

  it("does not schedule the same newly imported game twice for duplicate Steam input", async () => {
    findUniqueExternalId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ gameId: "game-new" });
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 10, name: "Portal", playtimeForever: 120, rtimeLastPlayed: 1700000000 },
      { appid: 10, name: "Portal", playtimeForever: 120, rtimeLastPlayed: 1700000000 },
    ]);

    await expect(importSteamGames()).resolves.toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ imported: 1, updated: 1 }),
    }));
    expect(queueRawgForImportedGames).toHaveBeenCalledWith(["game-new"]);
  });

  it("keeps a committed Steam import successful when RAWG scheduling fails", async () => {
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      { appid: 10, name: "Portal", playtimeForever: 120, rtimeLastPlayed: 1700000000 },
    ]);
    vi.mocked(queueRawgForImportedGames).mockRejectedValue(new Error("Queue unavailable"));

    await expect(importSteamGames()).resolves.toEqual({
      success: true,
      data: {
        imported: 1,
        updated: 0,
        rawgQueue: { status: "DEFERRED", batchId: null, queued: 0, skipped: 0 },
      },
      error: null,
    });
    expect(updateConnection).toHaveBeenCalled();
  });

  it("queues an owned DLC when its Steam base game is not imported", async () => {
    findUniqueExternalId.mockResolvedValue(null);
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      {
        appid: 200,
        name: "Expansion",
        playtimeForever: 0,
        rtimeLastPlayed: 0,
        type: "DLC",
        steamBaseAppId: "100",
      },
    ]);

    const result = await importSteamGames();

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ imported: 0, updated: 1 }),
    }));
    expect(upsertUnresolvedDlc).toHaveBeenCalledWith({
      where: { steamAppId: "200" },
      create: { steamAppId: "200", name: "Expansion", steamBaseAppId: "100" },
      update: {
        name: "Expansion",
        steamBaseAppId: "100",
        status: "PENDING",
        discardedAt: null,
      },
    });
    expect(createGame).not.toHaveBeenCalled();
  });

  it("returns an error when Steam is disconnected", async () => {
    findUniqueConnection.mockResolvedValue(null);

    const result = await importSteamGames();

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Steam account is not connected",
    });
    expect(fetchOwnedGames).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns an error when the Steam API key is missing", async () => {
    delete process.env.STEAM_WEB_API_KEY;

    const result = await importSteamGames();

    expect(result).toEqual({
      success: false,
      data: null,
      error: "STEAM_WEB_API_KEY is not configured",
    });
    expect(fetchOwnedGames).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
