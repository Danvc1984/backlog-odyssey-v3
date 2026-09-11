import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/igdb-api", () => ({ searchIgdbCandidatePage: vi.fn() }));
vi.mock("@/lib/wishlist-igdb-enrichment", () => ({ enrichWishlistBaseGameFromIgdb: vi.fn() }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { searchIgdbCandidatePage } from "@/lib/igdb-api";
import { enrichWishlistBaseGameFromIgdb } from "@/lib/wishlist-igdb-enrichment";
import {
  enrichWishlistEntryWithIgdb,
  fillWishlistIgdbMetadata,
  refreshWishlistIgdbMetadata,
  removeWishlistMetadata,
  searchWishlistIgdb,
} from "./wishlist-igdb";

const findUnique = vi.fn();

describe("wishlist IGDB actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ user: { id: "user-1" } } as never);
    Object.assign(prisma, { wishlistEntry: { findUnique }, wishlistMetadataSnapshot: { deleteMany: vi.fn() } });
    vi.mocked(searchIgdbCandidatePage).mockResolvedValue({ ok: true, data: [], searchTerm: "Portal 2" });
  });

  it("searches IGDB with offset paging", async () => {
    await expect(searchWishlistIgdb({ title: "Portal 2", page: 2 })).resolves.toEqual({ success: true, data: [], error: null });
    expect(searchIgdbCandidatePage).toHaveBeenCalledWith("Portal 2", { offset: 30 });
  });

  it("rejects fill when a snapshot already exists", async () => {
    findUnique.mockResolvedValue({ id: "wish-1", name: "Portal 2", type: "BASE_GAME", steamAppId: null, steamAppIdProvenance: null, metadataSnapshot: { id: "snapshot-1" } });

    await expect(fillWishlistIgdbMetadata({ wishlistEntryId: "wish-1" })).resolves.toEqual({
      success: false,
      data: null,
      error: "This wish already has IGDB metadata",
    });
    expect(enrichWishlistBaseGameFromIgdb).not.toHaveBeenCalled();
  });

  it("directs ambiguous and missing matches to the edit search", async () => {
    findUnique.mockResolvedValue({ id: "wish-1", name: "Portal 2", type: "BASE_GAME", steamAppId: null, steamAppIdProvenance: null, metadataSnapshot: null });
    vi.mocked(enrichWishlistBaseGameFromIgdb).mockResolvedValueOnce({ success: false, data: null, error: "IGDB match outcome: AMBIGUOUS" });
    await expect(fillWishlistIgdbMetadata({ wishlistEntryId: "wish-1" })).resolves.toMatchObject({ error: "Several IGDB games share this title. Use Edit to search and choose a match." });
    vi.mocked(enrichWishlistBaseGameFromIgdb).mockResolvedValueOnce({ success: false, data: null, error: "IGDB match outcome: NOT_FOUND" });
    await expect(fillWishlistIgdbMetadata({ wishlistEntryId: "wish-1" })).resolves.toMatchObject({ error: "No IGDB match was found for this title. Use Edit to search and choose a match." });
  });

  it("requires overwrite confirmation for refresh and manual replacement", async () => {
    const fetchedAt = new Date("2026-09-10T19:00:00.000Z");
    findUnique.mockResolvedValue({ id: "wish-1", name: "Portal 2", type: "BASE_GAME", steamAppId: null, steamAppIdProvenance: null, metadataSnapshot: { fetchedAt } });

    await expect(refreshWishlistIgdbMetadata({ wishlistEntryId: "wish-1" })).resolves.toEqual({
      success: true,
      data: { kind: "OVERWRITE_REQUIRED", existingFetchedAt: fetchedAt.toISOString() },
      error: null,
    });
    await expect(enrichWishlistEntryWithIgdb({ wishlistEntryId: "wish-1", igdbId: 42 })).resolves.toEqual({
      success: true,
      data: { kind: "OVERWRITE_REQUIRED", existingFetchedAt: fetchedAt.toISOString() },
      error: null,
    });
    expect(enrichWishlistBaseGameFromIgdb).not.toHaveBeenCalled();
  });

  it("replaces metadata after confirmation and removes it provider-agnostically", async () => {
    findUnique
      .mockResolvedValueOnce({ id: "wish-1", name: "Portal 2", type: "BASE_GAME", steamAppId: null, steamAppIdProvenance: null, metadataSnapshot: { fetchedAt: new Date() } })
      .mockResolvedValueOnce({ id: "wish-1" });
    vi.mocked(enrichWishlistBaseGameFromIgdb).mockResolvedValue({
      success: true,
      data: { igdbId: 42, name: "Portal 2", matchMethod: "MANUAL_IGDB_SEARCH", steamAppIdApplied: null, steamAppIdConflict: null },
      error: null,
    });
    await expect(enrichWishlistEntryWithIgdb({ wishlistEntryId: "wish-1", igdbId: 42, confirmOverwrite: true })).resolves.toMatchObject({ success: true, data: { igdbId: 42 } });
    expect(enrichWishlistBaseGameFromIgdb).toHaveBeenCalledWith(expect.objectContaining({ selectedIgdbId: 42 }));

    await expect(removeWishlistMetadata({ wishlistEntryId: "wish-1" })).resolves.toEqual({ success: true, data: null, error: null });
    expect((prisma.wishlistMetadataSnapshot.deleteMany as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ where: { wishlistEntryId: "wish-1" } });
  });
});
