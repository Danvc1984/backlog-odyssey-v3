import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/steam-dlc-list", () => ({ fetchSteamDlcList: vi.fn() }));
vi.mock("@/lib/igdb-import-queue", () => ({ queueIgdbForDlcGames: vi.fn() }));
vi.mock("@/lib/igdb-api", () => ({ matchIgdbGame: vi.fn() }));
vi.mock("@/lib/igdb-enrichment", () => ({
  persistIgdbIdentity: vi.fn(),
  persistIgdbSnapshot: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchSteamDlcList } from "@/lib/steam-dlc-list";
import { queueIgdbForDlcGames } from "@/lib/igdb-import-queue";
import { matchIgdbGame } from "@/lib/igdb-api";
import { persistIgdbIdentity, persistIgdbSnapshot } from "@/lib/igdb-enrichment";
import { acquireFetchedDlcs, createDlc, fetchDlcCandidates } from "./dlc";

describe("createDlc", () => {
  const findUnique = vi.fn();
  const findFirst = vi.fn();
  const create = vi.fn();
  const findManyExternalIds = vi.fn();
  const findManyAvailability = vi.fn();
  const findManyWishlist = vi.fn();
  const tx = {
    game: { findUnique, create },
    externalGameId: { findMany: findManyExternalIds },
    gameAvailability: { findMany: findManyAvailability },
    wishlistEntry: { findMany: findManyWishlist },
  };
  const transaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    prisma.$transaction = transaction;
    (prisma as unknown as { game: unknown }).game = { findFirst };
    (prisma as unknown as { externalGameId: unknown }).externalGameId = { findMany: findManyExternalIds };
    (prisma as unknown as { gameAvailability: unknown }).gameAvailability = { findMany: findManyAvailability };
    (prisma as unknown as { wishlistEntry: unknown }).wishlistEntry = { findMany: findManyWishlist };
    transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );
    create.mockResolvedValue({ id: "dlc-1" });
    findManyExternalIds.mockResolvedValue([]);
    findManyAvailability.mockResolvedValue([]);
    findManyWishlist.mockResolvedValue([]);
    vi.mocked(queueIgdbForDlcGames).mockResolvedValue({ batchId: "batch-1", queued: 1, skipped: 0 });
    vi.mocked(matchIgdbGame).mockResolvedValue({
      outcome: "MATCHED",
      matchMethod: "EXACT_STEAM_APP_ID",
      game: { id: 42, name: "Expansion", category: 1 },
    });
    vi.mocked(persistIgdbIdentity).mockResolvedValue({ success: true, data: { gameId: "dlc-1", igdbId: 42 }, error: null });
    vi.mocked(persistIgdbSnapshot).mockResolvedValue({ success: true, data: { gameId: "dlc-1", fetchedAt: new Date() }, error: null });
  });

  it("creates a DLC attached to a base game", async () => {
    findUnique.mockResolvedValue({ type: "BASE_GAME" });

    const result = await createDlc({
      name: "The DLC",
      baseGameId: "base-1",
    });

    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "DLC",
          baseGame: { connect: { id: "base-1" } },
        }),
      }),
    );
    expect(create.mock.calls[0][0].data).not.toHaveProperty("availability");
  });

  it("rejects a missing base game id", async () => {
    const result = await createDlc({
      name: "The DLC",
      baseGameId: "",
    });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a base game that does not exist", async () => {
    findUnique.mockResolvedValue(null);

    const result = await createDlc({
      name: "The DLC",
      baseGameId: "missing",
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Base game not found",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("fetches ephemeral candidates and marks existing catalog or wishlist DLCs", async () => {
    findFirst.mockResolvedValue({
      id: "base-1",
      externalIds: [{ externalId: "10" }],
      availability: [],
    });
    vi.mocked(fetchSteamDlcList).mockResolvedValue({
      status: "OK",
      candidates: [
        { steamAppId: "101", name: "Owned expansion", resolvedVia: "IGDB", igdbId: 501 },
        { steamAppId: "102", name: "Wishlist expansion", resolvedVia: "STEAM", igdbId: null },
      ],
    });
    findManyExternalIds.mockResolvedValue([
      { externalId: "101", game: { id: "dlc-1", type: "DLC", baseGameId: "base-1" } },
    ]);
    findManyWishlist.mockResolvedValue([{ steamAppId: "102" }]);

    await expect(fetchDlcCandidates({ baseGameId: "base-1" })).resolves.toEqual({
      success: true,
      data: [
        expect.objectContaining({ steamAppId: "101", owned: true, wishlisted: false }),
        expect.objectContaining({ steamAppId: "102", owned: false, wishlisted: true }),
      ],
      error: null,
    });
  });

  it("acquires selected fetched DLCs without a library entry and queues IGDB", async () => {
    findFirst.mockResolvedValue({
      id: "base-1",
      externalIds: [{ externalId: "10" }],
      availability: [],
    });
    vi.mocked(fetchSteamDlcList).mockResolvedValue({
      status: "OK",
      candidates: [{ steamAppId: "101", name: "Expansion", resolvedVia: "IGDB", igdbId: 42 }],
    });
    create.mockResolvedValue({ id: "dlc-1" });

    const result = await acquireFetchedDlcs({
      baseGameId: "base-1",
      items: [{ steamAppId: "101", name: "Client supplied name" }],
    });

    expect(result.success).toBe(true);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "DLC",
        origin: "STEAM_IMPORT",
        name: "Expansion",
        baseGameId: "base-1",
        externalIds: expect.anything(),
        availability: expect.anything(),
      }),
    }));
    expect(create.mock.calls[0][0].data).not.toHaveProperty("libraryEntry");
    expect(persistIgdbIdentity).toHaveBeenCalledWith("dlc-1", expect.objectContaining({ matchMethod: "EXACT_STEAM_APP_ID" }));
    expect(persistIgdbSnapshot).toHaveBeenCalledWith("dlc-1", expect.objectContaining({ id: 42 }), expect.any(Date));
    expect(queueIgdbForDlcGames).not.toHaveBeenCalled();
  });

  it("queues an exact candidate when immediate enrichment cannot persist", async () => {
    findFirst.mockResolvedValue({ id: "base-1", externalIds: [{ externalId: "10" }], availability: [] });
    vi.mocked(fetchSteamDlcList).mockResolvedValue({
      status: "OK",
      candidates: [{ steamAppId: "101", name: "Expansion", resolvedVia: "IGDB", igdbId: 42 }],
    });
    create.mockResolvedValue({ id: "dlc-2" });
    vi.mocked(matchIgdbGame).mockResolvedValue({ outcome: "NOT_FOUND" });

    await expect(acquireFetchedDlcs({
      baseGameId: "base-1",
      items: [{ steamAppId: "101", name: "Expansion" }],
    })).resolves.toMatchObject({ success: true, data: { enriched: 0 } });
    expect(queueIgdbForDlcGames).toHaveBeenCalledWith(["dlc-2"]);
  });

  it("rejects a base game without a Steam identity", async () => {
    findFirst.mockResolvedValue(null);
    await expect(fetchDlcCandidates({ baseGameId: "base-1" })).resolves.toEqual({
      success: false,
      data: null,
      error: "Base game needs a Steam App ID",
    });
  });

  it("rejects another DLC as the parent", async () => {
    findUnique.mockResolvedValue({ type: "DLC" });

    const result = await createDlc({
      name: "Nested DLC",
      baseGameId: "dlc-1",
    });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "DLC parent must be a base game",
    });
    expect(create).not.toHaveBeenCalled();
  });
});
