import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/wishlist-compatibility-runner", () => ({
  silentlyRefreshWishlistCompatibility: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { silentlyRefreshWishlistCompatibility } from "@/lib/wishlist-compatibility-runner";
import {
  createWishlistImportReviewAsNew,
  getWishlistImportReviews,
  ignoreWishlistImportReview,
  linkWishlistImportReview,
} from "./wishlist-import-review";

const findManyReviews = vi.fn();
const findUniqueReview = vi.fn();
const updateReview = vi.fn();
const findGame = vi.fn();
const upsertExternalId = vi.fn();
const findWishlist = vi.fn();
const findFirstWishlist = vi.fn();
const updateWishlist = vi.fn();
const createWishlist = vi.fn();
const upsertIgnore = vi.fn();
const transaction = vi.fn();

const tx = {
  wishlistImportReview: { findUnique: findUniqueReview, update: updateReview },
  game: { findUnique: findGame },
  externalGameId: { upsert: upsertExternalId },
  wishlistEntry: {
    findUnique: findWishlist,
    findFirst: findFirstWishlist,
    update: updateWishlist,
    create: createWishlist,
  },
  wishlistImportIgnore: { upsert: upsertIgnore },
};

const openReview = () => ({
  id: "review-1",
  steamAppId: "620",
  name: "Portal 2",
  candidates: [{ gameId: "target-1", name: "Portal 2", type: "BASE_GAME" }],
  status: "OPEN",
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({} as never);
  findManyReviews.mockResolvedValue([openReview()]);
  findUniqueReview.mockResolvedValue(openReview());
  updateReview.mockImplementation(async ({ data }) => ({ ...openReview(), ...data }));
  findGame.mockResolvedValue({ id: "target-1", type: "BASE_GAME" });
  upsertExternalId.mockResolvedValue({ id: "external-1" });
  findWishlist.mockResolvedValue(null);
  findFirstWishlist.mockResolvedValue(null);
  updateWishlist.mockResolvedValue({ id: "target-1" });
  createWishlist.mockResolvedValue({ id: "wish-new", name: "Portal 2", type: "BASE_GAME" });
  upsertIgnore.mockResolvedValue({ id: "ignore-1" });
  transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  (prisma as unknown as Record<string, unknown>).wishlistImportReview = {
    findMany: findManyReviews,
  };
  (prisma as unknown as Record<string, unknown>).$transaction = transaction;
});

describe("wishlist import review actions", () => {
  it("lists open reviews", async () => {
    await expect(getWishlistImportReviews()).resolves.toEqual({
      success: true,
      data: [openReview()],
      error: null,
    });
    expect(findManyReviews).toHaveBeenCalledWith({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("links a review to a catalog game without creating a wish", async () => {
    const result = await linkWishlistImportReview({ reviewId: "review-1", targetId: "target-1" });

    expect(result.success).toBe(true);
    expect(upsertExternalId).toHaveBeenCalledWith(expect.objectContaining({
      where: { namespace_externalId: { namespace: "STEAM_APP", externalId: "620" } },
      create: expect.objectContaining({ gameId: "target-1", externalId: "620" }),
    }));
    expect(createWishlist).not.toHaveBeenCalled();
    expect(updateReview).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "LINKED", reviewedAt: expect.any(Date) },
    }));
  });

  it("links a review to an existing wishlist entry", async () => {
    findGame.mockResolvedValue(null);
    findWishlist.mockResolvedValue({ id: "target-1" });

    const result = await linkWishlistImportReview({ reviewId: "review-1", targetId: "target-1" });

    expect(result.success).toBe(true);
    expect(updateWishlist).toHaveBeenCalledWith({
      where: { id: "target-1" },
      data: { steamAppId: "620", steamAppIdProvenance: "STEAM_IMPORT" },
    });
    expect(upsertExternalId).not.toHaveBeenCalled();
  });

  it("creates a new wishlist entry and resolves the review", async () => {
    const result = await createWishlistImportReviewAsNew({ reviewId: "review-1" });

    expect(result).toMatchObject({ success: true, data: { id: "wish-new" } });
    expect(createWishlist).toHaveBeenCalledWith({
      data: {
        name: "Portal 2",
        type: "BASE_GAME",
        interest: 2,
        notes: null,
        steamAppId: "620",
        steamAppIdProvenance: "STEAM_IMPORT",
      },
    });
    expect(updateReview).toHaveBeenCalled();
  });

  it("creates an ignore record and resolves the review", async () => {
    const result = await ignoreWishlistImportReview({ reviewId: "review-1" });

    expect(result.success).toBe(true);
    expect(upsertIgnore).toHaveBeenCalledWith({
      where: { steamAppId: "620" },
      create: { steamAppId: "620", name: "Portal 2" },
      update: { name: "Portal 2" },
    });
    expect(updateReview).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "IGNORED", reviewedAt: expect.any(Date) },
    }));
  });

  it("does not repeat a link after the review is already resolved", async () => {
    findUniqueReview.mockResolvedValue({ ...openReview(), status: "LINKED" });

    const result = await linkWishlistImportReview({ reviewId: "review-1", targetId: "target-1" });

    expect(result.success).toBe(true);
    expect(upsertExternalId).not.toHaveBeenCalled();
    expect(updateReview).not.toHaveBeenCalled();
  });

  it("does not create an ignore record for an already resolved review", async () => {
    findUniqueReview.mockResolvedValue({ ...openReview(), status: "LINKED" });

    const result = await ignoreWishlistImportReview({ reviewId: "review-1" });

    expect(result.success).toBe(true);
    expect(upsertIgnore).not.toHaveBeenCalled();
    expect(updateReview).not.toHaveBeenCalled();
  });
});

describe("compatibility auto-trigger on import review resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    findUniqueReview.mockResolvedValue(openReview());
    updateReview.mockImplementation(async ({ data }) => ({ ...openReview(), ...data }));
    findGame.mockResolvedValue(null);
    upsertExternalId.mockResolvedValue({ id: "external-1" });
    findWishlist.mockResolvedValue({ id: "target-1" });
    findFirstWishlist.mockResolvedValue(null);
    updateWishlist.mockResolvedValue({ id: "target-1" });
    createWishlist.mockResolvedValue({
      id: "wish-new",
      name: "Portal 2",
      type: "BASE_GAME",
      steamAppId: "620",
      steamAppIdProvenance: "STEAM_IMPORT",
    });
    transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
  });

  it("triggers one silent refresh when linking a review to a base-game wish", async () => {
    const result = await linkWishlistImportReview({ reviewId: "review-1", targetId: "target-1" });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledTimes(1);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledWith("target-1");
  });

  it("does not trigger when the linked wish is a DLC", async () => {
    findUniqueReview.mockResolvedValue({
      ...openReview(),
      candidates: [{ gameId: "target-dlc", name: "Expansion", type: "DLC" }],
    });

    const result = await linkWishlistImportReview({ reviewId: "review-1", targetId: "target-dlc" });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).not.toHaveBeenCalled();
  });

  it("triggers one silent refresh for a wish created from a review", async () => {
    const result = await createWishlistImportReviewAsNew({ reviewId: "review-1" });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledTimes(1);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledWith("wish-new");
  });

  it("triggers no refresh when a resolved review's wish lacks identity fields", async () => {
    createWishlist.mockResolvedValue({ id: "wish-new", name: "Portal 2", type: "BASE_GAME" });

    await createWishlistImportReviewAsNew({ reviewId: "review-1" });

    expect(silentlyRefreshWishlistCompatibility).not.toHaveBeenCalled();
  });
});
