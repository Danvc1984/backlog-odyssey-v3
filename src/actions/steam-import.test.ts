import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/steam-api", () => ({ fetchOwnedGames: vi.fn() }));
vi.mock("@/lib/steam-flow", () => ({
  requireSteamFlowContext: vi.fn(),
  reconcileWishlistImportDlcs: vi.fn(),
  upsertUnresolvedSteamDlc: vi.fn(),
}));
vi.mock("@/lib/rawg-import-queue", () => ({ queueRawgForImportedGames: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchOwnedGames } from "@/lib/steam-api";
import {
  reconcileWishlistImportDlcs,
  requireSteamFlowContext,
  upsertUnresolvedSteamDlc,
} from "@/lib/steam-flow";
import { queueRawgForImportedGames } from "@/lib/rawg-import-queue";
import { importSteamGames } from "./steam-import";

describe("importSteamGames", () => {
  const findUniqueConnection = vi.fn();
  const findManyExternalId = vi.fn();
  const updateManyAvailability = vi.fn();
  const upsertLibraryEntry = vi.fn();
  const createGame = vi.fn();
  const updateConnection = vi.fn();
  const upsertUnresolvedDlc = vi.mocked(upsertUnresolvedSteamDlc);
  const transaction = vi.fn();
  const tx = {
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
    vi.mocked(requireSteamFlowContext).mockResolvedValue({
      ok: true,
      steamId64: "76561198000000000",
      apiKey: "test-key",
    });
    vi.mocked(reconcileWishlistImportDlcs).mockResolvedValue(undefined);
    (prisma as unknown as { steamConnection: Record<string, unknown> }).steamConnection = {
      findUnique: findUniqueConnection,
      update: updateConnection,
    };
    (prisma as unknown as { externalGameId: unknown }).externalGameId = {
      findMany: findManyExternalId,
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
    findManyExternalId.mockResolvedValue([]);
    updateManyAvailability.mockResolvedValue({ count: 1 });
    upsertLibraryEntry.mockResolvedValue({});
    createGame.mockResolvedValue({ id: "game-new" });
    updateConnection.mockResolvedValue({});
    upsertUnresolvedDlc.mockResolvedValue(undefined);
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
    expect(reconcileWishlistImportDlcs).toHaveBeenCalledWith(tx, "10", "game-new");
    expect(updateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ counts: { imported: 1, updated: 0 } }),
      }),
    );
  });

  it("updates playtime and last played for an existing Steam game", async () => {
    findManyExternalId.mockResolvedValue([
      { externalId: "10", gameId: "game-1", game: { type: "BASE_GAME" } },
    ]);
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
    expect(upsertUnresolvedDlc).toHaveBeenCalledWith(
      tx,
      "200",
      expect.objectContaining({ name: "Expansion", steamBaseAppId: "100" }),
    );
    expect(createGame).not.toHaveBeenCalled();
  });

  it("creates an owned DLC under its imported base game", async () => {
    findManyExternalId.mockResolvedValue([
      { externalId: "100", gameId: "game-base", game: { type: "BASE_GAME" } },
    ]);
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      {
        appid: 200,
        name: "Expansion",
        playtimeForever: 45,
        rtimeLastPlayed: 1700000000,
        type: "DLC",
        steamBaseAppId: "100",
      },
    ]);

    const result = await importSteamGames();

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ imported: 1, updated: 0 }),
    }));
    expect(createGame).toHaveBeenCalledWith({
      data: {
        type: "DLC",
        origin: "STEAM_IMPORT",
        name: "Expansion",
        baseGameId: "game-base",
        externalIds: {
          create: {
            namespaceId: "200",
            namespace: "STEAM_APP",
            externalId: "200",
            matchMethod: "EXACT_STEAM_APP_ID",
          },
        },
        availability: {
          create: {
            source: "STEAM",
            steamAppId: "200",
            steamPlaytimeTotal: BigInt(45),
            steamLastPlayed: new Date(1700000000000),
          },
        },
      },
      select: { id: true },
    });
    expect(upsertUnresolvedDlc).not.toHaveBeenCalled();
    expect(upsertLibraryEntry).not.toHaveBeenCalled();
  });

  it("updates a known DLC's availability without touching its library entry", async () => {
    findManyExternalId.mockResolvedValue([
      { externalId: "200", gameId: "game-dlc", game: { type: "DLC" } },
    ]);
    vi.mocked(fetchOwnedGames).mockResolvedValue([
      {
        appid: 200,
        name: "Expansion",
        playtimeForever: 90,
        rtimeLastPlayed: 1700000100,
        type: "DLC",
        steamBaseAppId: "100",
      },
    ]);

    const result = await importSteamGames();

    expect(result).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ imported: 0, updated: 1 }),
    }));
    expect(updateManyAvailability).toHaveBeenCalledWith({
      where: { gameId: "game-dlc", source: "STEAM" },
      data: {
        source: "STEAM",
        steamAppId: "200",
        steamPlaytimeTotal: BigInt(90),
        steamLastPlayed: new Date(1700000100000),
      },
    });
    expect(upsertLibraryEntry).not.toHaveBeenCalled();
    expect(createGame).not.toHaveBeenCalled();
  });

  it("keeps earlier chunks committed when a later chunk fails mid-import", async () => {
    const games = Array.from({ length: 60 }, (_, index) => ({
      appid: index + 1,
      name: `Game ${index + 1}`,
      playtimeForever: 0,
      rtimeLastPlayed: 0,
    }));
    vi.mocked(fetchOwnedGames).mockResolvedValue(games);
    let createCalls = 0;
    createGame.mockImplementation(async () => {
      createCalls += 1;
      if (createCalls === 51) {
        throw new Error("chunk 2 exploded");
      }
      return { id: `game-${createCalls}` };
    });

    const result = await importSteamGames();

    expect(result).toEqual({
      success: false,
      data: null,
      error: "chunk 2 exploded",
    });
    expect(createCalls).toBe(51);
    expect(updateConnection).not.toHaveBeenCalled();
    expect(queueRawgForImportedGames).toHaveBeenCalledTimes(1);
    expect(queueRawgForImportedGames).toHaveBeenCalledWith(
      Array.from({ length: 50 }, (_, index) => `game-${index + 1}`),
    );
  });

  it("returns an error when Steam is disconnected", async () => {
    vi.mocked(requireSteamFlowContext).mockResolvedValueOnce({
      ok: false,
      error: "Steam account is not connected",
    });

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
    vi.mocked(requireSteamFlowContext).mockResolvedValueOnce({
      ok: false,
      error: "STEAM_WEB_API_KEY is not configured",
    });

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
