import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/wishlist-identity", () => ({ findConflictingEntry: vi.fn() }));
vi.mock("./wishlist-compatibility-runner", () => ({ silentlyRefreshWishlistCompatibility: vi.fn() }));
vi.mock("./igdb-enrichment", () => ({ captureIgdbPalette: vi.fn().mockResolvedValue(null) }));
vi.mock("./igdb-api", () => ({
  fetchIgdbGameTimeToBeats: vi.fn(),
  fetchIgdbSteamAppId: vi.fn(),
  matchIgdbGame: vi.fn(),
}));
vi.mock("./steamspy-api", () => ({ fetchSteamSpyMedian: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { findConflictingEntry } from "@/lib/wishlist-identity";
import { silentlyRefreshWishlistCompatibility } from "./wishlist-compatibility-runner";
import { fetchIgdbGameTimeToBeats, fetchIgdbSteamAppId, matchIgdbGame } from "./igdb-api";
import { fetchSteamSpyMedian } from "./steamspy-api";
import { enrichWishlistBaseGameFromIgdb } from "./wishlist-igdb-enrichment";

const findFirst = vi.mocked(findConflictingEntry);
const match = vi.mocked(matchIgdbGame);
const fetchAppId = vi.mocked(fetchIgdbSteamAppId);
const fetchDuration = vi.mocked(fetchIgdbGameTimeToBeats);
const fetchSteamSpy = vi.mocked(fetchSteamSpyMedian);
const update = vi.fn();
const deleteSnapshot = vi.fn();
const createSnapshot = vi.fn();
const transaction = vi.fn();

const game = { id: 42, slug: "portal-2", name: "Portal 2", category: 0 };
const entry = {
  id: "wish-1",
  name: "Portal 2",
  type: "BASE_GAME",
  steamAppId: null,
  steamAppIdProvenance: null,
};

describe("wishlist IGDB enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(prisma, {
      wishlistEntry: { update },
      $transaction: transaction,
    });
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      wishlistMetadataSnapshot: { deleteMany: deleteSnapshot, create: createSnapshot },
    }));
    match.mockResolvedValue({ outcome: "MATCHED", matchMethod: "INFERRED", game });
    fetchAppId.mockResolvedValue({ ok: true, data: "620" });
    findFirst.mockResolvedValue(null);
    update.mockResolvedValue({ ...entry, steamAppId: "620", steamAppIdProvenance: "IGDB_SUGGESTION" });
    fetchDuration.mockResolvedValue({ ok: true, data: { count: 4, hastilySeconds: 3_600, normallySeconds: 7_200, completelySeconds: null } });
    fetchSteamSpy.mockResolvedValue({ ok: true, data: { medianForeverMinutes: 900 } });
    vi.mocked(silentlyRefreshWishlistCompatibility).mockResolvedValue(undefined);
  });

  it("matches, applies a derived identity, refreshes compatibility, and persists IGDB duration", async () => {
    await expect(enrichWishlistBaseGameFromIgdb({ entry })).resolves.toMatchObject({
      success: true,
      data: { igdbId: 42, name: "Portal 2", matchMethod: "INFERRED", steamAppIdApplied: "620", steamAppIdConflict: null },
    });
    expect(match).toHaveBeenCalledWith({ title: "Portal 2", category: "MAIN_GAME", steamAppId: null, selectedIgdbId: null });
    expect(update).toHaveBeenCalledWith({ where: { id: "wish-1" }, data: { steamAppId: "620", steamAppIdProvenance: "IGDB_SUGGESTION" } });
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledWith("wish-1");
    expect(createSnapshot).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provider: "IGDB", payload: expect.objectContaining({ durationEvidence: expect.objectContaining({ provider: "IGDB" }) }) }) }));
    expect(fetchSteamSpy).not.toHaveBeenCalled();
  });

  it("preserves existing identity and falls back to SteamSpy duration", async () => {
    fetchDuration.mockResolvedValue({ ok: true, data: null });
    const existing = { ...entry, steamAppId: "730", steamAppIdProvenance: "USER" };

    await expect(enrichWishlistBaseGameFromIgdb({ entry: existing })).resolves.toMatchObject({ success: true, data: { steamAppIdApplied: null } });
    expect(update).not.toHaveBeenCalled();
    expect(fetchAppId).not.toHaveBeenCalled();
    expect(fetchSteamSpy).toHaveBeenCalledWith("730");
    expect(createSnapshot).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ payload: expect.objectContaining({ durationEvidence: expect.objectContaining({ provider: "STEAMSPY" }) }) }) }));
  });

  it("skips a conflicting derived identity but still persists the snapshot", async () => {
    findFirst.mockResolvedValue({ id: "other", name: "Other wish" });
    fetchDuration.mockResolvedValue({ ok: true, data: null });

    await expect(enrichWishlistBaseGameFromIgdb({ entry })).resolves.toMatchObject({
      success: true,
      data: { steamAppIdApplied: null, steamAppIdConflict: "Steam App ID 620 is already used by Other wish" },
    });
    expect(update).not.toHaveBeenCalled();
    expect(fetchSteamSpy).toHaveBeenCalledWith("620");
  });

  it("starts identity and duration lookups together for an identity-less wish", async () => {
    let identityStarted = false;
    let durationStarted = false;
    let releaseIdentity!: (value: { ok: true; data: string }) => void;
    let releaseDuration!: (value: { ok: true; data: null }) => void;
    fetchAppId.mockImplementation(() => {
      identityStarted = true;
      return new Promise((resolve) => { releaseIdentity = resolve; });
    });
    fetchDuration.mockImplementation(() => {
      durationStarted = true;
      return new Promise((resolve) => { releaseDuration = resolve; });
    });

    const pending = enrichWishlistBaseGameFromIgdb({ entry });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(identityStarted).toBe(true);
    expect(durationStarted).toBe(true);
    releaseIdentity({ ok: true, data: "620" });
    releaseDuration({ ok: true, data: null });
    await expect(pending).resolves.toMatchObject({ success: true });
  });

  it("rejects DLC wishes before matching", async () => {
    await expect(enrichWishlistBaseGameFromIgdb({ entry: { ...entry, type: "DLC" } })).resolves.toEqual({
      success: false,
      data: null,
      error: "IGDB metadata is only available for base-game wishes",
    });
    expect(match).not.toHaveBeenCalled();
  });
});
