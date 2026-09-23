import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./wishlist-igdb-enrichment", () => ({
  enrichWishlistBaseGameFromIgdb: vi.fn(),
  enrichWishlistDlcFromIgdb: vi.fn(),
}));
vi.mock("./igdb-metadata-payload", () => ({
  parseIgdbMetadataPayload: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { enrichWishlistBaseGameFromIgdb, enrichWishlistDlcFromIgdb } from "./wishlist-igdb-enrichment";
import { parseIgdbMetadataPayload } from "./igdb-metadata-payload";
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
    vi.mocked(parseIgdbMetadataPayload).mockReturnValue(null);
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

  it("refreshes existing snapshots through their persisted IGDB id when requested", async () => {
    findUnique.mockResolvedValue({
      id: "wish-1",
      name: "Portal 2",
      type: "BASE_GAME",
      steamAppId: null,
      steamAppIdProvenance: null,
      metadataSnapshot: { id: "snapshot", payload: { igdbId: 42 } },
    });
    vi.mocked(parseIgdbMetadataPayload).mockReturnValue({ igdbId: 42 } as never);

    await expect(autoEnrichWishlistEntries(["wish-1"], { refreshExisting: true })).resolves.toEqual({ enriched: 1, skipped: 0 });
    expect(enrichWishlistBaseGameFromIgdb).toHaveBeenCalledWith(expect.objectContaining({ selectedIgdbId: 42 }));
  });

  it("enriches DLC wishes through their own IGDB path", async () => {
    findUnique.mockResolvedValue({
      id: "dlc-1",
      name: "Expansion",
      type: "DLC",
      steamAppId: "70210",
      steamAppIdProvenance: "STEAM_IMPORT",
      metadataSnapshot: null,
      baseGame: { metadataSnapshots: [{ payload: {} }] },
    });
    vi.mocked(enrichWishlistDlcFromIgdb).mockResolvedValue({
      success: true,
      data: { igdbId: 99, name: "Expansion", matchMethod: "EXACT_STEAM_APP_ID", steamAppIdApplied: null, steamAppIdConflict: null },
      error: null,
    });

    await expect(autoEnrichWishlistEntries(["dlc-1"])).resolves.toEqual({ enriched: 1, skipped: 0 });
    expect(enrichWishlistDlcFromIgdb).toHaveBeenCalledWith(expect.objectContaining({ entry: expect.objectContaining({ type: "DLC" }) }));
  });

  it("leaves the IGDB id absent for a DLC without identity or a persisted snapshot id", async () => {
    findUnique.mockResolvedValue({
      id: "dlc-ambiguous",
      name: "Ambiguous expansion",
      type: "DLC",
      steamAppId: null,
      steamAppIdProvenance: null,
      metadataSnapshot: null,
      baseGame: { metadataSnapshots: [] },
    });
    vi.mocked(enrichWishlistDlcFromIgdb).mockResolvedValue({
      success: false,
      data: null,
      error: "IGDB match outcome: AMBIGUOUS",
    });

    await expect(autoEnrichWishlistEntries(["dlc-ambiguous"])).resolves.toEqual({ enriched: 0, skipped: 1 });
    expect(enrichWishlistDlcFromIgdb).toHaveBeenCalledWith({
      entry: expect.objectContaining({ id: "dlc-ambiguous", type: "DLC" }),
    });
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
