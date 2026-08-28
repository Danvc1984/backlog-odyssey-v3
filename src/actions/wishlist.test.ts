import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/wishlist-compatibility-runner", () => ({
  silentlyRefreshWishlistCompatibility: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { silentlyRefreshWishlistCompatibility } from "@/lib/wishlist-compatibility-runner";
import {
  createWishlistEntry,
  deleteWishlistEntry,
  getWishlistEntries,
  updateWishlistEntry,
} from "./wishlist";

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockGameFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const transaction = vi.fn();

function configurePrisma() {
  (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
  (prisma as unknown as { wishlistEntry: Record<string, ReturnType<typeof vi.fn>> }).wishlistEntry = {
    create: mockCreate,
    findUnique: mockFindUnique,
    update: mockUpdate,
    delete: mockDelete,
    findMany: mockFindMany,
    findFirst: mockFindFirst,
  };
  (prisma as unknown as { game: { findUnique: typeof mockGameFindUnique } }).game = {
    findUnique: mockGameFindUnique,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
  transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      game: { findUnique: mockFindUnique },
      wishlistEntry: { create: mockCreate },
    }),
  );
  configurePrisma();
  mockCreate.mockResolvedValue({ id: "wish-1", name: "Hades II", type: "BASE_GAME" });
  mockUpdate.mockResolvedValue({ id: "wish-1", name: "Hades II" });
  mockDelete.mockResolvedValue({ id: "wish-1" });
  mockFindMany.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue(null);
});

describe("createWishlistEntry", () => {
  it("creates a standalone base-game wish", async () => {
    const result = await createWishlistEntry({
      name: " Hades II ",
      type: "BASE_GAME",
      interest: 5,
    });

    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Hades II",
        type: "BASE_GAME",
        baseGameId: null,
        interest: 5,
      }),
    }));
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("creates a DLC wish only for an existing base game", async () => {
    mockFindUnique.mockResolvedValue({ id: "game-1", type: "BASE_GAME" });

    const result = await createWishlistEntry({
      name: "The Frozen Wilds",
      type: "DLC",
      baseGameId: "game-1",
    });

    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baseGameId: "game-1", type: "DLC" }),
    }));
  });

  it("rejects missing, orphan, or DLC parents", async () => {
    const missingParent = await createWishlistEntry({ name: "DLC", type: "DLC" });
    mockFindUnique.mockResolvedValue(null);
    const orphan = await createWishlistEntry({ name: "DLC", type: "DLC", baseGameId: "missing" });
    mockFindUnique.mockResolvedValue({ id: "dlc-1", type: "DLC" });
    const nested = await createWishlistEntry({ name: "DLC", type: "DLC", baseGameId: "dlc-1" });

    expect(missingParent.error).toBe("DLC wishlist entries require a base game");
    expect(orphan.error).toBe("Base game not found");
    expect(nested.error).toBe("DLC parent must be a base game");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a parent on a base-game wish and invalid interest", async () => {
    const parent = await createWishlistEntry({ name: "Game", type: "BASE_GAME", baseGameId: "game-1" });
    const interest = await createWishlistEntry({ name: "Game", type: "BASE_GAME", interest: 6 });

    expect(parent.error).toBe("Base games cannot have a parent");
    expect(interest.error).toBe("Invalid input");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("wishlist CRUD", () => {
  it("updates editable fields", async () => {
    const result = await updateWishlistEntry({
      id: "wish-1",
      name: " New name ",
      interest: 4,
      gameExperience: "COUCH_GAMING",
      notes: "Later",
      steamAppId: "123",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "wish-1" },
      data: {
        name: "New name",
        interest: 4,
        gameExperience: "COUCH_GAMING",
        notes: "Later",
        steamAppId: "123",
        steamAppIdProvenance: "USER",
      },
    }));
  });

  it("sets, clears, and omits game experience without accepting invalid values", async () => {
    const set = await updateWishlistEntry({ id: "wish-1", gameExperience: "ON_THE_GO" });
    const cleared = await updateWishlistEntry({ id: "wish-1", gameExperience: null });
    const omitted = await updateWishlistEntry({ id: "wish-1", name: "Renamed" });
    const invalid = await updateWishlistEntry({
      id: "wish-1",
      gameExperience: "DESKTOP",
    });

    expect(set.success).toBe(true);
    expect(cleared.success).toBe(true);
    expect(omitted.success).toBe(true);
    expect(invalid.success).toBe(false);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: { gameExperience: "ON_THE_GO" },
    }));
    expect(mockUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: { gameExperience: null },
    }));
    expect(mockUpdate).toHaveBeenNthCalledWith(3, expect.objectContaining({
      data: { name: "Renamed" },
    }));
    expect(mockUpdate).toHaveBeenCalledTimes(3);
  });

  it("allows a DLC to change to another base-game parent", async () => {
    mockFindUnique.mockResolvedValue({ id: "wish-1", type: "DLC" });
    mockGameFindUnique.mockResolvedValue({ id: "game-2", type: "BASE_GAME" });

    const result = await updateWishlistEntry({ id: "wish-1", baseGameId: "game-2" });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "wish-1" },
      data: { baseGameId: "game-2" },
    }));
  });

  it("deletes a wish and rejects malformed updates", async () => {
    const deleted = await deleteWishlistEntry({ id: "wish-1" });
    const invalid = await updateWishlistEntry({ id: "wish-1", type: "DLC" });

    expect(deleted.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "wish-1" } });
    expect(invalid.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("filters by type and interest", async () => {
    await getWishlistEntries({ type: "DLC", interest: 4 });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { type: "DLC", interest: 4 },
    }));
  });
});

describe("compatibility auto-trigger on identity writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        game: { findUnique: mockFindUnique },
        wishlistEntry: { create: mockCreate, findFirst: mockFindFirst },
      }),
    );
    configurePrisma();
    mockCreate.mockResolvedValue({ id: "wish-1", name: "Hades II", type: "BASE_GAME" });
    mockUpdate.mockResolvedValue({ id: "wish-1", name: "Hades II" });
    mockFindFirst.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);
  });

  it("triggers one silent refresh when creating a base-game wish with identity", async () => {
    const result = await createWishlistEntry({
      name: "Portal 2",
      type: "BASE_GAME",
      steamAppId: "620",
    });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledTimes(1);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledWith("wish-1");
  });

  it("triggers no refresh when creating a wish without an identity", async () => {
    const result = await createWishlistEntry({ name: "Hollow Knight", type: "BASE_GAME" });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).not.toHaveBeenCalled();
  });

  it("never triggers for a DLC creation even when it carries an identity", async () => {
    mockFindUnique.mockResolvedValue({ id: "game-1", type: "BASE_GAME" });

    const result = await createWishlistEntry({
      name: "The Frozen Wilds",
      type: "DLC",
      baseGameId: "game-1",
      steamAppId: "123",
    });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).not.toHaveBeenCalled();
  });

  it("triggers one silent refresh when updating a base-game wish's identity", async () => {
    mockUpdate.mockResolvedValue({
      id: "wish-1",
      type: "BASE_GAME",
      steamAppId: "620",
      steamAppIdProvenance: "USER",
    });

    const result = await updateWishlistEntry({ id: "wish-1", steamAppId: "620" });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledTimes(1);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledWith("wish-1");
  });

  it("does not trigger on a plain field update or on an identity clear", async () => {
    mockUpdate.mockResolvedValue({ id: "wish-1", type: "BASE_GAME", steamAppId: null });

    const renamed = await updateWishlistEntry({ id: "wish-1", name: "Renamed" });
    const cleared = await updateWishlistEntry({ id: "wish-1", steamAppId: null });

    expect(renamed.success).toBe(true);
    expect(cleared.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).not.toHaveBeenCalled();
  });
});
