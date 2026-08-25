import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/steam-api", () => ({ fetchSteamWishlist: vi.fn() }));
vi.mock("@/lib/steam-flow", () => ({
  requireSteamFlowContext: vi.fn(),
  upsertUnresolvedSteamDlc: vi.fn(),
}));
vi.mock("@/lib/wishlist-rawg-queue", () => ({
  autoEnrichWishlistEntries: vi.fn().mockResolvedValue({ enriched: 0, skipped: 0 }),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchSteamWishlist } from "@/lib/steam-api";
import { requireSteamFlowContext, upsertUnresolvedSteamDlc } from "@/lib/steam-flow";
import { autoEnrichWishlistEntries } from "@/lib/wishlist-rawg-queue";
import { enrichImportedWishlist, importSteamWishlist } from "./steam-import-wishlist";

const findManyExternalId = vi.fn();
const findManyAvailability = vi.fn();
const findManyWishlist = vi.fn();
const findManyIgnore = vi.fn();
const findManyGames = vi.fn();
const findUniqueConnection = vi.fn();
const updateConnection = vi.fn();
const createWishlist = vi.fn();
const updateWishlist = vi.fn();
const upsertReview = vi.fn();
const deleteManyUnresolved = vi.fn();
const transaction = vi.fn();

const tx = {
  wishlistEntry: { create: createWishlist, update: updateWishlist },
  wishlistImportReview: { upsert: upsertReview },
  unresolvedSteamDlc: { deleteMany: deleteManyUnresolved },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({} as never);
  vi.mocked(requireSteamFlowContext).mockResolvedValue({
    ok: true,
    steamId64: "76561198000000000",
    apiKey: "test-key",
  });
  vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [], status: "EMPTY" });
  vi.mocked(upsertUnresolvedSteamDlc).mockResolvedValue();
  findManyExternalId.mockResolvedValue([]);
  findManyAvailability.mockResolvedValue([]);
  findManyWishlist.mockResolvedValue([]);
  findManyIgnore.mockResolvedValue([]);
  findManyGames.mockResolvedValue([]);
  findUniqueConnection.mockResolvedValue({ counts: null });
  updateConnection.mockResolvedValue({});
  createWishlist.mockImplementation(async ({ data }) => ({
    id: `wish-${createWishlist.mock.calls.length}`,
    name: data.name,
    type: data.type,
    steamAppId: data.steamAppId,
  }));
  updateWishlist.mockImplementation(async ({ where, data }) => ({
    id: where.id,
    name: "Expansion",
    type: data.type,
    steamAppId: "200",
    steamAppIdProvenance: "STEAM_IMPORT",
    metadataSnapshot: null,
  }));
  upsertReview.mockResolvedValue({ id: "review-1" });
  deleteManyUnresolved.mockResolvedValue({ count: 0 });
  transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  (prisma as unknown as Record<string, unknown>).externalGameId = { findMany: findManyExternalId };
  (prisma as unknown as Record<string, unknown>).gameAvailability = { findMany: findManyAvailability };
  (prisma as unknown as Record<string, unknown>).wishlistEntry = { findMany: findManyWishlist };
  (prisma as unknown as Record<string, unknown>).wishlistImportIgnore = { findMany: findManyIgnore };
  (prisma as unknown as Record<string, unknown>).game = { findMany: findManyGames };
  (prisma as unknown as Record<string, unknown>).steamConnection = {
    findUnique: findUniqueConnection,
    update: updateConnection,
  };
  (prisma as unknown as Record<string, unknown>).$transaction = transaction;
});

describe("importSteamWishlist", () => {
  it("distinguishes an unavailable Steam response from an empty wishlist", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [], status: "UNAVAILABLE" });

    await expect(importSteamWishlist()).resolves.toEqual({
      success: false,
      data: null,
      error: "Steam wishlist could not be read right now. Try again later.",
    });
  });

  it("returns a clear error for an empty or private wishlist", async () => {
    const result = await importSteamWishlist();

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Steam wishlist appears empty or private",
    });
  });

  it("creates a new base-game wish and skips it on re-import", async () => {
    const game = { appid: 10, name: "Portal" };
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [game], status: "OK" });

    const first = await importSteamWishlist();
    expect(first).toEqual({
      success: true,
      data: { created: 1, queuedReviews: 0, ignored: 0, enrichment: { enriched: 0, skipped: 0 }, enrichmentEntryIds: ["wish-1"] },
      error: null,
    });
    expect(createWishlist).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Portal",
        type: "BASE_GAME",
        interest: 2,
        steamAppId: "10",
        steamAppIdProvenance: "STEAM_IMPORT",
      }),
    }));
    expect(updateConnection).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({
        counts: expect.objectContaining({
          lastWishlistImport: expect.objectContaining({ created: 1, enriched: 0 }),
        }),
      }),
    }));

    findManyWishlist.mockResolvedValue([{
      id: "wish-1",
      name: "Portal",
      type: "BASE_GAME",
      steamAppId: "10",
      steamAppIdProvenance: "STEAM_IMPORT",
      metadataSnapshot: null,
    }]);
    const second = await importSteamWishlist();
    expect(second).toMatchObject({
      success: true,
      data: { created: 0, enrichmentEntryIds: ["wish-1"] },
    });
    expect(createWishlist).toHaveBeenCalledTimes(1);
  });

  it("silently omits games already owned in the catalog", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [{ appid: 10, name: "Portal" }], status: "OK" });
    findManyExternalId.mockResolvedValue([
      { externalId: "10", game: { id: "game-1", name: "Portal", type: "BASE_GAME" } },
    ]);

    const result = await importSteamWishlist();

    expect(result).toMatchObject({ success: true, data: { created: 0, queuedReviews: 0 } });
    expect(upsertReview).not.toHaveBeenCalled();
    expect(createWishlist).not.toHaveBeenCalled();
  });

  it("queues a persistent review for a normalized local name match", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [{ appid: 10, name: "Portal: Reloaded" }], status: "OK" });
    findManyGames.mockResolvedValue([{ id: "game-1", name: "Portal Reloaded", type: "BASE_GAME" }]);

    const result = await importSteamWishlist();

    expect(result).toMatchObject({ success: true, data: { queuedReviews: 1 } });
    expect(upsertReview).toHaveBeenCalledWith(expect.objectContaining({
      where: { steamAppId: "10" },
      create: expect.objectContaining({
        steamAppId: "10",
        candidates: [{ gameId: "game-1", name: "Portal Reloaded", type: "BASE_GAME" }],
      }),
    }));
  });

  it("creates a DLC wish when its catalog base game is known", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [
      { appid: 100, name: "Portal" },
      { appid: 200, name: "Expansion", type: "DLC", steamBaseAppId: "100" },
    ], status: "OK" });
    findManyExternalId.mockResolvedValue([
      { externalId: "100", game: { id: "game-1", name: "Portal", type: "BASE_GAME" } },
    ]);

    const result = await importSteamWishlist();

    expect(result).toMatchObject({ success: true, data: { created: 1 } });
    expect(createWishlist).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "DLC", baseGameId: "game-1", steamAppId: "200" }),
    }));
  });

  it("skips a DLC when its base game is created in the same wishlist import", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [
      { appid: 100, name: "Portal" },
      { appid: 200, name: "Expansion", type: "DLC", steamBaseAppId: "100" },
    ], status: "OK" });

    const result = await importSteamWishlist();

    expect(result).toMatchObject({ success: true, data: { created: 1 } });
    expect(createWishlist).toHaveBeenCalledTimes(1);
    expect(createWishlist).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: "Portal", type: "BASE_GAME", steamAppId: "100" }),
    }));
    expect(upsertUnresolvedSteamDlc).not.toHaveBeenCalled();
    expect(deleteManyUnresolved).toHaveBeenCalledWith({
      where: { steamAppId: "200", source: "WISHLIST_IMPORT", status: "PENDING" },
    });
  });

  it("skips a DLC when its base game is already in the wishlist", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [
      { appid: 200, name: "Expansion", type: "DLC", steamBaseAppId: "100" },
    ], status: "OK" });
    findManyWishlist.mockResolvedValue([{
      id: "wish-100",
      name: "Portal",
      type: "BASE_GAME",
      steamAppId: "100",
      steamAppIdProvenance: "STEAM_IMPORT",
      metadataSnapshot: null,
    }]);

    const result = await importSteamWishlist();

    expect(result).toMatchObject({ success: true, data: { created: 0 } });
    expect(createWishlist).not.toHaveBeenCalled();
    expect(upsertUnresolvedSteamDlc).not.toHaveBeenCalled();
    expect(deleteManyUnresolved).toHaveBeenCalledWith({
      where: { steamAppId: "200", source: "WISHLIST_IMPORT", status: "PENDING" },
    });
  });

  it("puts a DLC with an unknown catalog base in the wishlist-import queue", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [
      { appid: 200, name: "Expansion", type: "DLC", steamBaseAppId: "100" },
    ], status: "OK" });

    const result = await importSteamWishlist();

    expect(result).toMatchObject({ success: true, data: { created: 0 } });
    expect(upsertUnresolvedSteamDlc).toHaveBeenCalledWith(
      expect.anything(),
      "200",
      expect.objectContaining({ name: "Expansion", steamBaseAppId: "100" }),
      "WISHLIST_IMPORT",
    );
  });

  it("repairs an earlier Steam-imported base entry when Steam identifies it as DLC", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [
      { appid: 200, name: "Expansion", type: "DLC", steamBaseAppId: "100" },
    ], status: "OK" });
    findManyExternalId.mockResolvedValue([
      { externalId: "100", game: { id: "game-1", name: "Portal", type: "BASE_GAME" } },
    ]);
    findManyWishlist.mockResolvedValue([{
      id: "wish-200",
      name: "Expansion",
      type: "BASE_GAME",
      steamAppId: "200",
      steamAppIdProvenance: "STEAM_IMPORT",
      metadataSnapshot: null,
    }]);

    await expect(importSteamWishlist()).resolves.toMatchObject({
      success: true,
      data: { created: 0 },
    });
    expect(updateWishlist).toHaveBeenCalledWith({
      where: { id: "wish-200" },
      data: { type: "DLC", baseGameId: "game-1" },
      select: expect.any(Object),
    });
    expect(createWishlist).not.toHaveBeenCalled();
  });

  it("skips ignored review candidates and reports them", async () => {
    vi.mocked(fetchSteamWishlist).mockResolvedValue({ games: [{ appid: 10, name: "Portal" }], status: "OK" });
    findManyIgnore.mockResolvedValue([{ steamAppId: "10" }]);

    const result = await importSteamWishlist();

    expect(result).toMatchObject({ success: true, data: { ignored: 1, created: 0 } });
    expect(createWishlist).not.toHaveBeenCalled();
    expect(upsertReview).not.toHaveBeenCalled();
  });

  it("enriches imported entries in a separate follow-up action", async () => {
    vi.mocked(autoEnrichWishlistEntries).mockResolvedValue({ enriched: 2, skipped: 1 });

    await expect(enrichImportedWishlist(["wish-1", "wish-1", "wish-2"])).resolves.toEqual({
      success: true,
      data: { enriched: 2, skipped: 1 },
      error: null,
    });
    expect(autoEnrichWishlistEntries).toHaveBeenCalledWith(["wish-1", "wish-2"]);
  });
});
