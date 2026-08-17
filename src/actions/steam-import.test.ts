import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/steam-api", () => ({ fetchOwnedGames: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchOwnedGames } from "@/lib/steam-api";
import { importSteamGames } from "./steam-import";

describe("importSteamGames", () => {
  const findUniqueConnection = vi.fn();
  const findUniqueExternalId = vi.fn();
  const updateManyAvailability = vi.fn();
  const upsertLibraryEntry = vi.fn();
  const createGame = vi.fn();
  const updateConnection = vi.fn();
  const transaction = vi.fn();
  const tx = {
    externalGameId: { findUnique: findUniqueExternalId },
    game: { create: createGame },
    gameAvailability: { updateMany: updateManyAvailability },
    libraryEntry: { upsert: upsertLibraryEntry },
    steamConnection: { update: updateConnection },
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
    createGame.mockResolvedValue({});
    updateConnection.mockResolvedValue({});
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
      data: { imported: 1, updated: 0 },
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
    });
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

    expect(result.data).toEqual({ imported: 0, updated: 1 });
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
