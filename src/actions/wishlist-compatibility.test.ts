import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/wishlist-compat-sweep", () => ({
  runWishlistCompatSweep: vi.fn(),
}));
vi.mock("@/lib/wishlist-compatibility-runner", () => ({
  runWishlistCompatibilityRefresh: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { runWishlistCompatSweep } from "@/lib/wishlist-compat-sweep";
import { runWishlistCompatibilityRefresh } from "@/lib/wishlist-compatibility-runner";
import {
  getLatestWishlistCompatSweep,
  refreshWishlistCompatibility,
  startWishlistCompatibilitySweep,
} from "./wishlist-compatibility";

describe("refreshWishlistCompatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({} as never);
    vi.mocked(runWishlistCompatibilityRefresh).mockResolvedValue({
      success: true,
      data: {
        fetchedAt: "2026-08-25T12:00:00.000Z",
        snapshotCount: 2,
        environmentCount: 2,
      },
      error: null,
    });
  });

  it("requires authentication before running the refresh", async () => {
    const result = await refreshWishlistCompatibility({ wishlistEntryId: "wish-1" });

    expect(result.success).toBe(true);
    expect(requireUser).toHaveBeenCalledTimes(1);
    expect(runWishlistCompatibilityRefresh).toHaveBeenCalledWith("wish-1");
  });

  it("rejects malformed input without touching the runner", async () => {
    const result = await refreshWishlistCompatibility({ wishlistEntryId: "  " });

    expect(result).toEqual({ success: false, data: null, error: "Invalid input" });
    expect(runWishlistCompatibilityRefresh).not.toHaveBeenCalled();
  });

  it("preserves runner rejection for a missing entry or ineligible wish", async () => {
    vi.mocked(runWishlistCompatibilityRefresh).mockResolvedValueOnce({
      success: false,
      data: null,
      error: "DLC",
    });

    await expect(refreshWishlistCompatibility({ wishlistEntryId: "wish-dlc" })).resolves.toEqual({
      success: false,
      data: null,
      error: "DLC",
    });
  });

  it("returns quiet provider failures without exposing provider details", async () => {
    vi.mocked(runWishlistCompatibilityRefresh).mockResolvedValueOnce({
      success: false,
      data: null,
      error: "Compatibility provider unavailable",
    });

    await expect(refreshWishlistCompatibility({ wishlistEntryId: "wish-1" })).resolves.toEqual({
      success: false,
      data: null,
      error: "Compatibility provider unavailable",
    });
  });

  it("returns the auth failure in the standard action shape", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(refreshWishlistCompatibility({ wishlistEntryId: "wish-1" })).resolves.toEqual({
      success: false,
      data: null,
      error: "Failed to refresh wishlist compatibility",
    });
    expect(runWishlistCompatibilityRefresh).not.toHaveBeenCalled();
  });
});

const mockSweepFindUnique = vi.fn();
const mockSweepFindFirst = vi.fn();

function configurePrisma() {
  (prisma as unknown as Record<string, unknown>).wishlistCompatSweep = {
    findUnique: mockSweepFindUnique,
    findFirst: mockSweepFindFirst,
  };
}

const finishedRun = {
  id: "sweep-run-1",
  status: "SUCCESS",
  counts: { total: 3, refreshed: 2, upToDate: 1, failed: 0 },
  requestedAt: new Date("2026-08-26T12:00:00.000Z"),
  finishedAt: new Date("2026-08-26T12:01:00.000Z"),
};

describe("startWishlistCompatibilitySweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configurePrisma();
    vi.mocked(requireUser).mockResolvedValue({} as never);
  });

  it("requires authentication before starting the sweep", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await startWishlistCompatibilitySweep();

    expect(result).toEqual({ success: false, data: null, error: "Failed to run compatibility sweep" });
    expect(runWishlistCompatSweep).not.toHaveBeenCalled();
  });

  it("returns the full finished run for a completed sweep", async () => {
    vi.mocked(runWishlistCompatSweep).mockResolvedValue({
      ok: true,
      runId: "sweep-run-1",
    });
    mockSweepFindUnique.mockResolvedValue(finishedRun);

    const result = await startWishlistCompatibilitySweep();

    expect(result).toEqual({ success: true, data: finishedRun, error: null });
    expect(mockSweepFindUnique).toHaveBeenCalledWith({ where: { id: "sweep-run-1" } });
  });

  it("refuses an overlapping start while surfacing the active run id", async () => {
    vi.mocked(runWishlistCompatSweep).mockResolvedValue({
      ok: false,
      reason: "already-running",
      runId: "sweep-active",
    });

    const result = await startWishlistCompatibilitySweep();

    expect(result).toEqual({
      success: false,
      data: { runId: "sweep-active", reason: "already-running" },
      error: "A compatibility sweep is already running",
    });
    expect(mockSweepFindUnique).not.toHaveBeenCalled();
  });
});

describe("getLatestWishlistCompatSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configurePrisma();
    vi.mocked(requireUser).mockResolvedValue({} as never);
  });

  it("loads the most recent run", async () => {
    mockSweepFindFirst.mockResolvedValue(finishedRun);

    const result = await getLatestWishlistCompatSweep();

    expect(result).toEqual({ success: true, data: finishedRun, error: null });
  });

  it("returns null before any run exists", async () => {
    mockSweepFindFirst.mockResolvedValue(null);

    const result = await getLatestWishlistCompatSweep();

    expect(result).toEqual({ success: true, data: null, error: null });
  });

  it("returns the auth failure in the standard action shape", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await getLatestWishlistCompatSweep();

    expect(result).toEqual({ success: false, data: null, error: "Unauthorized" });
    expect(mockSweepFindFirst).not.toHaveBeenCalled();
  });
});
