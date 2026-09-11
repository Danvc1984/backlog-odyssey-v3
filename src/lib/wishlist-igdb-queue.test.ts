import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./wishlist-igdb-enrichment", () => ({ enrichWishlistBaseGameFromIgdb: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { enrichWishlistBaseGameFromIgdb } from "./wishlist-igdb-enrichment";
import { autoEnrichWishlistEntries } from "./wishlist-igdb-queue";

const findUnique = vi.fn();

describe("autoEnrichWishlistEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(prisma, { wishlistEntry: { findUnique } });
    findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: where.id,
      type: "BASE_GAME",
      steamAppId: where.id === "wish-1" ? "620" : null,
      steamAppIdProvenance: where.id === "wish-1" ? "STEAM_IMPORT" : null,
      metadataSnapshot: null,
    }));
    vi.mocked(enrichWishlistBaseGameFromIgdb).mockResolvedValue({
      success: true,
      data: { igdbId: 42, name: "Portal 2", matchMethod: "EXACT_STEAM_APP_ID", steamAppIdApplied: null, steamAppIdConflict: null },
      error: null,
    });
  });

  it("fills eligible entries and preserves the result contract", async () => {
    await expect(autoEnrichWishlistEntries(["wish-1"])).resolves.toEqual({ enriched: 1, skipped: 0 });
    expect(enrichWishlistBaseGameFromIgdb).toHaveBeenCalledWith(expect.objectContaining({ entry: expect.objectContaining({ steamAppId: "620" }) }));
  });

  it("skips existing snapshots, DLC, and per-entry errors", async () => {
    findUnique
      .mockResolvedValueOnce({ id: "wish-1", name: "Portal 2", type: "BASE_GAME", steamAppId: null, steamAppIdProvenance: null, metadataSnapshot: { id: "snapshot" } })
      .mockResolvedValueOnce({ id: "wish-2", name: "DLC", type: "DLC", steamAppId: null, steamAppIdProvenance: null, metadataSnapshot: null })
      .mockResolvedValueOnce({ id: "wish-3", name: "Broken", type: "BASE_GAME", steamAppId: null, steamAppIdProvenance: null, metadataSnapshot: null });
    vi.mocked(enrichWishlistBaseGameFromIgdb).mockRejectedValueOnce(new Error("provider unavailable"));

    await expect(autoEnrichWishlistEntries(["wish-1", "wish-2", "wish-3"])).resolves.toEqual({ enriched: 0, skipped: 3 });
  });

  it("bounds queue work to six entries per batch", async () => {
    let inFlight = 0;
    let peak = 0;
    vi.mocked(enrichWishlistBaseGameFromIgdb).mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return { success: true, data: { igdbId: 42, name: "Game", matchMethod: "INFERRED", steamAppIdApplied: null, steamAppIdConflict: null }, error: null };
    });
    await autoEnrichWishlistEntries(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(peak).toBe(6);
  });
});
