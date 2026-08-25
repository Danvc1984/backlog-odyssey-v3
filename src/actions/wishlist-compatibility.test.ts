import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/wishlist-compatibility-runner", () => ({
  runWishlistCompatibilityRefresh: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { runWishlistCompatibilityRefresh } from "@/lib/wishlist-compatibility-runner";
import { refreshWishlistCompatibility } from "./wishlist-compatibility";

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
      error: "Unauthorized",
    });
    expect(runWishlistCompatibilityRefresh).not.toHaveBeenCalled();
  });
});
