import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PROTONDB_TIER_CLASSES,
  PROTONDB_TIER_LABELS,
  deriveCardTier,
} from "./protondb-tags";

const TIERS = ["native", "platinum", "gold", "silver", "bronze", "borked"] as const;

describe("ProtonDB tier maps", () => {
  it.each(TIERS)("maps %s to a label and a class", (tier) => {
    expect(PROTONDB_TIER_LABELS[tier]).toEqual(expect.any(String));
    expect(PROTONDB_TIER_CLASSES[tier]).toEqual(expect.any(String));
  });
});

describe("deriveCardTier", () => {
  it("returns the tier for a parseable snapshot", () => {
    expect(
      deriveCardTier({
        steamAppId: "620",
        isRomOnly: false,
        snapshotResult: { confidence: "strong", tier: "gold" },
      }),
    ).toBe("gold");
  });

  it("returns the tier for an insufficient-confidence snapshot", () => {
    expect(
      deriveCardTier({
        steamAppId: "620",
        isRomOnly: false,
        snapshotResult: { confidence: "insufficient", tier: "silver" },
      }),
    ).toBe("silver");
  });

  it("returns null when the snapshot is missing", () => {
    expect(
      deriveCardTier({ steamAppId: "620", isRomOnly: false, snapshotResult: null }),
    ).toBeNull();
  });

  it("returns null when the snapshot is malformed", () => {
    expect(
      deriveCardTier({
        steamAppId: "620",
        isRomOnly: false,
        snapshotResult: { confidence: "strong" },
      }),
    ).toBeNull();
  });

  it("returns null for ROM-only games even with a valid snapshot", () => {
    expect(
      deriveCardTier({
        steamAppId: "620",
        isRomOnly: true,
        snapshotResult: { confidence: "strong", tier: "platinum" },
      }),
    ).toBeNull();
  });

  it("returns null when no Steam identity exists", () => {
    expect(
      deriveCardTier({
        steamAppId: null,
        isRomOnly: false,
        snapshotResult: { confidence: "strong", tier: "gold" },
      }),
    ).toBeNull();
  });
});