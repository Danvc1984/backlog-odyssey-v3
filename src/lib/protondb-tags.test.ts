import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PROTONDB_TIER_CLASSES,
  PROTONDB_TIER_LABELS,
  deriveCardTier,
  deriveCompatTag,
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

describe("deriveCompatTag", () => {
  const now = new Date("2026-09-07T12:00:00.000Z");
  const snapshotResult = { confidence: "strong", tier: "gold" };

  it("returns evidence for a current parsed tier", () => {
    expect(deriveCompatTag({
      active: true,
      steamAppId: "620",
      isRomOnly: false,
      snapshotResult,
      snapshotFetchedAt: new Date("2026-08-01T12:00:00.000Z"),
      now,
    })).toEqual({ kind: "evidence", tier: "gold" });
  });

  it("marks evidence older than 180 days stale but keeps its tier", () => {
    const boundary = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    expect(deriveCompatTag({
      active: true,
      steamAppId: "620",
      isRomOnly: false,
      snapshotResult,
      snapshotFetchedAt: boundary,
      now,
    })).toEqual({ kind: "evidence", tier: "gold" });

    expect(deriveCompatTag({
      active: true,
      steamAppId: "620",
      isRomOnly: false,
      snapshotResult,
      snapshotFetchedAt: new Date(boundary.getTime() - 1),
      now,
    })).toEqual({ kind: "stale", tier: "gold" });
  });

  it("returns unknown for a confirmed App ID without usable evidence", () => {
    expect(deriveCompatTag({
      active: true,
      steamAppId: "620",
      isRomOnly: false,
      snapshotResult: null,
      snapshotFetchedAt: null,
      now,
    })).toEqual({ kind: "unknown" });
  });

  it.each([
    ["inactive setup", { active: false }],
    ["ROM-only game", { isRomOnly: true }],
    ["missing App ID", { steamAppId: null }],
    ["blank App ID", { steamAppId: "   " }],
  ])("returns absent for %s", (_label, overrides) => {
    expect(deriveCompatTag({
      active: true,
      steamAppId: "620",
      isRomOnly: false,
      snapshotResult,
      snapshotFetchedAt: now,
      now,
      ...overrides,
    })).toBeNull();
  });
});
