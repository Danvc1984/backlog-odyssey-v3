import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/wishlist-compatibility-runner", () => ({
  silentlyRefreshWishlistCompatibility: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { acquireWishlistBaseGame, acquireWishlistDlc } from "./wishlist";

const mockFindUniqueWishlist = vi.fn();
const mockFindUniqueExternalId = vi.fn();
const mockGameCreate = vi.fn();
const mockMetadataCreate = vi.fn();
const mockExternalCreate = vi.fn();
const mockWishlistDelete = vi.fn();
const mockLibraryUpsert = vi.fn();
const transaction = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
  transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      wishlistEntry: {
        findUnique: mockFindUniqueWishlist,
        delete: mockWishlistDelete,
      },
      externalGameId: {
        findUnique: mockFindUniqueExternalId,
        create: mockExternalCreate,
      },
      game: { create: mockGameCreate },
      metadataSnapshot: { create: mockMetadataCreate },
      libraryEntry: { upsert: mockLibraryUpsert },
    }),
  );
  (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
  mockFindUniqueExternalId.mockResolvedValue(null);
  mockGameCreate.mockResolvedValue({ id: "game-new", name: "Portal 2", type: "BASE_GAME" });
  mockMetadataCreate.mockResolvedValue({ id: "metadata-new" });
  mockExternalCreate.mockResolvedValue({ id: "external-new" });
  mockWishlistDelete.mockResolvedValue({ id: "wish-1" });
  mockLibraryUpsert.mockResolvedValue({ id: "library-parent" });
});

describe("acquireWishlistBaseGame", () => {
  it("creates catalog records, transfers RAWG metadata, and deletes the wish", async () => {
    mockFindUniqueWishlist.mockResolvedValue({
      id: "wish-1",
      name: "Portal 2",
      type: "BASE_GAME",
      steamAppId: "620",
      metadataSnapshot: {
        payload: { rawgId: 123, title: "Portal 2" },
        sourceUrl: "https://rawg.io/games/portal-2",
        fetchedAt: new Date("2026-08-20T00:00:00Z"),
        expiresAt: null,
      },
    });

    const result = await acquireWishlistBaseGame({
      wishlistEntryId: "wish-1",
      source: "OTHER_PLATFORM",
      displayName: "Portal 2 (GOG)",
    });

    expect(result.success).toBe(true);
    expect(mockGameCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: "BASE_GAME",
        origin: "MANUAL",
        availability: expect.objectContaining({
          create: expect.objectContaining({
            source: "OTHER_PLATFORM",
            displayName: "Portal 2 (GOG)",
            steamAppId: "620",
          }),
        }),
      }),
    }));
    expect(mockMetadataCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ gameId: "game-new", provider: "RAWG" }),
    }));
    expect(mockExternalCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ namespace: "RAWG_GAME", externalId: "123" }),
    }));
    expect(mockWishlistDelete).toHaveBeenCalledWith({ where: { id: "wish-1" } });
  });

  it("rejects acquisition when the RAWG identity is already in the catalog", async () => {
    mockFindUniqueWishlist.mockResolvedValue({
      id: "wish-1",
      name: "Portal 2",
      type: "BASE_GAME",
      steamAppId: null,
      metadataSnapshot: { payload: { rawgId: 123 }, sourceUrl: null, fetchedAt: new Date(), expiresAt: null },
    });
    mockFindUniqueExternalId.mockResolvedValue({ id: "existing" });

    const result = await acquireWishlistBaseGame({ wishlistEntryId: "wish-1", source: "ROM" });

    expect(result.error).toBe("RAWG game identity is already attached to another catalog game");
    expect(mockGameCreate).not.toHaveBeenCalled();
    expect(mockWishlistDelete).not.toHaveBeenCalled();
  });
});

describe("acquireWishlistDlc", () => {
  it("creates a DLC and updates the parent play state and replay flag", async () => {
    mockFindUniqueWishlist.mockResolvedValue({
      id: "wish-1",
      name: "The Frozen Wilds",
      type: "DLC",
      steamAppId: "70210",
      baseGame: { id: "base-1", type: "BASE_GAME" },
    });
    mockGameCreate.mockResolvedValue({
      id: "dlc-new",
      name: "The Frozen Wilds",
      type: "DLC",
      baseGameId: "base-1",
    });

    const result = await acquireWishlistDlc({
      wishlistEntryId: "wish-1",
      source: "STEAM",
      updateParentPlayState: "IN_PROGRESS",
      setParentReplay: true,
    });

    expect(result.success).toBe(true);
    expect(mockGameCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "DLC", baseGameId: "base-1" }),
    }));
    expect(mockLibraryUpsert).toHaveBeenCalledWith({
      where: { gameId: "base-1" },
      create: { gameId: "base-1", playState: "IN_PROGRESS", replayCandidate: true },
      update: { playState: "IN_PROGRESS", replayCandidate: true },
    });
    expect(mockWishlistDelete).toHaveBeenCalledWith({ where: { id: "wish-1" } });
  });

  it("rejects an orphan or non-base parent", async () => {
    mockFindUniqueWishlist.mockResolvedValue({
      id: "wish-1",
      name: "DLC",
      type: "DLC",
      baseGame: null,
    });

    const result = await acquireWishlistDlc({ wishlistEntryId: "wish-1" });

    expect(result.error).toBe("DLC parent must be a base game");
    expect(mockGameCreate).not.toHaveBeenCalled();
  });

  it("maps PLAN_TO_PLAY to the existing playSoon flag", async () => {
    mockFindUniqueWishlist.mockResolvedValue({
      id: "wish-1",
      name: "DLC",
      type: "DLC",
      baseGame: { id: "base-1", type: "BASE_GAME" },
    });

    await acquireWishlistDlc({
      wishlistEntryId: "wish-1",
      updateParentPlayState: "PLAN_TO_PLAY",
    });

    expect(mockLibraryUpsert).toHaveBeenCalledWith({
      where: { gameId: "base-1" },
      create: { gameId: "base-1", playSoon: true },
      update: { playSoon: true },
    });
  });
});
