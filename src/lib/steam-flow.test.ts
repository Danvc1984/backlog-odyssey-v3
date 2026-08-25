import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { reconcileWishlistImportDlcs } from "./steam-flow";

describe("reconcileWishlistImportDlcs", () => {
  const findMany = vi.fn();
  const findFirst = vi.fn();
  const createWishlist = vi.fn();
  const deleteQueue = vi.fn();
  const client = {
    unresolvedSteamDlc: { findMany, delete: deleteQueue },
    wishlistEntry: { findFirst, create: createWishlist },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ steamAppId: "200", name: "Expansion" }]);
    findFirst.mockResolvedValue(null);
    createWishlist.mockResolvedValue({ id: "wishlist-dlc-1" });
    deleteQueue.mockResolvedValue({});
  });

  it("converts pending wishlist-import DLCs into linked wishlist entries", async () => {
    await reconcileWishlistImportDlcs(client as never, "100", "base-1");

    expect(findMany).toHaveBeenCalledWith({
      where: { steamBaseAppId: "100", source: "WISHLIST_IMPORT", status: "PENDING" },
      select: { steamAppId: true, name: true },
    });
    expect(createWishlist).toHaveBeenCalledWith({
      data: {
        name: "Expansion",
        type: "DLC",
        baseGameId: "base-1",
        interest: 2,
        notes: null,
        steamAppId: "200",
        steamAppIdProvenance: "STEAM_IMPORT",
      },
    });
    expect(deleteQueue).toHaveBeenCalledWith({ where: { steamAppId: "200" } });
  });

  it("does not duplicate an existing wishlist entry", async () => {
    findFirst.mockResolvedValue({ id: "wishlist-dlc-1" });

    await reconcileWishlistImportDlcs(client as never, "100", "base-1");

    expect(createWishlist).not.toHaveBeenCalled();
    expect(deleteQueue).toHaveBeenCalledWith({ where: { steamAppId: "200" } });
  });
});
