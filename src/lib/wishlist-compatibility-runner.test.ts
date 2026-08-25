import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/protondb-api", () => ({
  lookupProtonDb: vi.fn(),
  PROTONDB_URL: "https://protondb.test",
}));
vi.mock("@/lib/away-api", () => ({
  lookupAway: vi.fn(),
  AWAY_URL: "https://away.test/games.json",
}));

import { lookupAway } from "@/lib/away-api";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { lookupProtonDb } from "@/lib/protondb-api";
import { runWishlistCompatibilityRefresh } from "./wishlist-compatibility-runner";

const findUnique = vi.fn();
const snapshotUpsert = vi.fn();
const environmentUpsert = vi.fn();
const transaction = vi.fn();

const entry = {
  id: "wish-1",
  type: "BASE_GAME" as const,
  steamAppId: "620",
  steamAppIdProvenance: "USER" as const,
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

describe("wishlist compatibility runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(prisma, {
      wishlistEntry: { findUnique },
      $transaction: transaction,
    });
    findUnique.mockResolvedValue(entry);
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        wishlistCompatibilitySnapshot: { upsert: snapshotUpsert },
        wishlistEnvironmentCompatibility: { upsert: environmentUpsert },
      }),
    );
    snapshotUpsert.mockResolvedValue({});
    environmentUpsert.mockResolvedValue({});
    vi.mocked(lookupProtonDb).mockResolvedValue(protonDb);
    vi.mocked(lookupAway).mockResolvedValue(away);
  });

  it("persists parallel snapshots and derived environment rows atomically", async () => {
    const result = await runWishlistCompatibilityRefresh("wish-1");

    expect(result).toMatchObject({
      success: true,
      data: { snapshotCount: 2, environmentCount: 2 },
      error: null,
    });
    expect(lookupProtonDb).toHaveBeenCalledWith("620");
    expect(lookupAway).toHaveBeenCalledWith("620");
    expect(snapshotUpsert).toHaveBeenCalledTimes(2);
    expect(environmentUpsert).toHaveBeenCalledTimes(2);
    expect(snapshotUpsert.mock.calls.map(([call]) => call.where.wishlistEntryId_provider.provider)).toEqual([
      "PROTONDB",
      "ARE_WE_ANTICHEAT_YET",
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("persists unknown rows when providers return no matching evidence", async () => {
    vi.mocked(lookupProtonDb).mockResolvedValue(null);
    vi.mocked(lookupAway).mockResolvedValue(null);

    const result = await runWishlistCompatibilityRefresh("wish-1");

    expect(result.success).toBe(true);
    expect(snapshotUpsert.mock.calls[0][0].create.result).toBe(Prisma.JsonNull);
    expect(environmentUpsert.mock.calls.map(([call]) => call.create.status)).toEqual([
      "UNKNOWN",
      "REQUIRED",
    ]);
  });

  it("preserves existing evidence by skipping persistence on provider failure", async () => {
    vi.mocked(lookupProtonDb).mockResolvedValue({ category: "NETWORK", message: "offline" });

    const result = await runWishlistCompatibilityRefresh("wish-1");

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Compatibility provider unavailable",
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(snapshotUpsert).not.toHaveBeenCalled();
  });

  it("preserves existing evidence when persistence fails", async () => {
    transaction.mockRejectedValue(new Error("database unavailable"));

    const result = await runWishlistCompatibilityRefresh("wish-1");

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Compatibility evidence could not be saved",
    });
  });

  it("does not call providers for an ineligible DLC wish", async () => {
    findUnique.mockResolvedValue({ ...entry, type: "DLC" });

    const result = await runWishlistCompatibilityRefresh("wish-1");

    expect(result).toEqual({ success: false, data: null, error: "DLC" });
    expect(lookupProtonDb).not.toHaveBeenCalled();
    expect(lookupAway).not.toHaveBeenCalled();
  });
});
