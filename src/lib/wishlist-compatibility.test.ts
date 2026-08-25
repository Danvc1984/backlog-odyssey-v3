import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildWishlistCompatibilityPersistence,
  canPersistWishlistCompatibility,
  getWishlistCompatibilityEligibility,
} from "./wishlist-compatibility";

const base = {
  type: "BASE_GAME",
  steamAppId: " 620 ",
  steamAppIdProvenance: "USER",
};

const protonDb = {
  appId: "620",
  confidence: "strong" as const,
  tier: "gold" as const,
  status: "READY" as const,
  raw: { confidence: "strong", tier: "gold" },
};

const away = {
  appId: "620",
  name: "Portal 2",
  status: "Supported" as const,
  anticheats: ["Easy Anti-Cheat"],
};

describe("wishlist compatibility contracts", () => {
  it("accepts only a base-game wish with an App ID and provenance", () => {
    expect(getWishlistCompatibilityEligibility(base)).toEqual({ eligible: true, steamAppId: "620" });
  });

  it.each([
    [{ ...base, type: "DLC" }, "DLC"],
    [{ ...base, steamAppId: null }, "STEAM_ID_REQUIRED"],
    [{ ...base, steamAppIdProvenance: null }, "STEAM_ID_PROVENANCE_REQUIRED"],
    [{ ...base, steamAppId: "   " }, "STEAM_ID_REQUIRED"],
  ] as const)("rejects an ineligible wish (%s)", (input, reason) => {
    expect(getWishlistCompatibilityEligibility(input)).toEqual({ eligible: false, reason });
  });

  it("preserves existing evidence when either provider fails", () => {
    expect(canPersistWishlistCompatibility({ protonDb, away })).toBe(true);
    expect(canPersistWishlistCompatibility({ protonDb: { category: "NETWORK", message: "offline" }, away })).toBe(false);
    expect(canPersistWishlistCompatibility({ protonDb, away: { category: "HTTP", message: "failed", status: 503 } })).toBe(false);
  });

  it("builds parallel provider and environment rows with a 180-day expiry", () => {
    const fetchedAt = new Date("2026-08-25T12:00:00.000Z");
    const result = buildWishlistCompatibilityPersistence({
      wishlistEntryId: "wish-1",
      steamAppId: "620",
      protonDb,
      away,
      fetchedAt,
    });

    expect(result.snapshots).toEqual([
      expect.objectContaining({
        wishlistEntryId: "wish-1",
        provider: "PROTONDB",
        result: protonDb.raw,
        sourceUrl: "https://www.protondb.com/api/v1/reports/summaries/620.json",
        fetchedAt,
        expiresAt: new Date("2027-02-21T12:00:00.000Z"),
      }),
      expect.objectContaining({
        provider: "ARE_WE_ANTICHEAT_YET",
        result: away,
        sourceUrl: "https://raw.githubusercontent.com/AreWeAntiCheatYet/AreWeAntiCheatYet/master/games.json",
      }),
    ]);
    expect(result.environments).toEqual([
      expect.objectContaining({ wishlistEntryId: "wish-1", environment: "BAZZITE", status: "READY" }),
      expect.objectContaining({ wishlistEntryId: "wish-1", environment: "WINDOWS", status: "READY" }),
    ]);
  });

  it("represents missing provider evidence as unknown rows without inventing data", () => {
    const result = buildWishlistCompatibilityPersistence({
      wishlistEntryId: "wish-1",
      steamAppId: "620",
      protonDb: null,
      away: null,
      fetchedAt: new Date("2026-08-25T12:00:00.000Z"),
    });

    expect(result.snapshots[0].result).toBeNull();
    expect(result.snapshots[1].result).toBeNull();
    expect(result.environments).toEqual([
      expect.objectContaining({ environment: "BAZZITE", status: "UNKNOWN" }),
      expect.objectContaining({ environment: "WINDOWS", status: "REQUIRED" }),
    ]);
  });
});
