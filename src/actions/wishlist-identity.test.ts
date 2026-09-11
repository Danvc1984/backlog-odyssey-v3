import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/wishlist-compatibility-runner", () => ({
  silentlyRefreshWishlistCompatibility: vi.fn(),
}));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { silentlyRefreshWishlistCompatibility } from "@/lib/wishlist-compatibility-runner";
import { identityConflictMessage } from "@/lib/wishlist-identity";
import {
  confirmSteamImportIdentity,
  removeWishlistIdentity,
  resolveManualSteamAppId,
  setWishlistIdentity,
} from "./wishlist-identity";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const transaction = vi.fn();

function configurePrisma() {
  (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
  (prisma as unknown as { wishlistEntry: Record<string, ReturnType<typeof vi.fn>> }).wishlistEntry = {
    findUnique: mockFindUnique,
    findFirst: mockFindFirst,
    update: mockUpdate,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  configurePrisma();
  transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      wishlistEntry: { findFirst: mockFindFirst, update: mockUpdate },
    }),
  );
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
  mockFindUnique.mockResolvedValue({ id: "wish-1" });
  mockFindFirst.mockResolvedValue(null);
  mockUpdate.mockImplementation(async ({ data }) => ({
    id: "wish-1",
    ...data,
  }));
});

describe("setWishlistIdentity", () => {
  it("parses a pasted URL and writes USER provenance", async () => {
    const result = await setWishlistIdentity({
      wishlistEntryId: "wish-1",
      identityInput: "https://store.steampowered.com/app/620/Portal_2/",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wish-1" },
        data: { steamAppId: "620", steamAppIdProvenance: "USER" },
      }),
    );
  });

  it("blocks duplicates with an error naming the conflicting entry", async () => {
    mockFindFirst.mockResolvedValue({ id: "wish-9", name: "Hades II" });

    const result = await setWishlistIdentity({
      wishlistEntryId: "wish-1",
      identityInput: "620",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(identityConflictMessage("620", "Hades II"));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("surfaces parser reasons for malformed input", async () => {
    const result = await setWishlistIdentity({
      wishlistEntryId: "wish-1",
      identityInput: "not an id",
    });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects missing entry or invalid payload", async () => {
    const missingPayload = await setWishlistIdentity({ identityInput: "620" });
    expect(missingPayload.error).toBe("Invalid input");

    mockFindUnique.mockResolvedValue(null);
    const missingEntry = await setWishlistIdentity({
      wishlistEntryId: "gone",
      identityInput: "620",
    });
    expect(missingEntry.error).toBe("Wishlist entry not found");
  });
});

describe("removeWishlistIdentity", () => {
  it("clears both App ID and provenance together", async () => {
    const result = await removeWishlistIdentity({ wishlistEntryId: "wish-1" });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { steamAppId: null, steamAppIdProvenance: null },
      }),
    );
  });
});

describe("confirmSteamImportIdentity", () => {
  it("writes STEAM_IMPORT provenance for the import flow", async () => {
    const result = await confirmSteamImportIdentity({
      wishlistEntryId: "wish-1",
      steamAppId: "570",
    });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { steamAppId: "570", steamAppIdProvenance: "STEAM_IMPORT" },
      }),
    );
  });

  it("requires an authenticated user even though it is import-facing", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));

    const result = await confirmSteamImportIdentity({
      wishlistEntryId: "wish-1",
      steamAppId: "570",
    });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-numeric IDs before touching the database", async () => {
    const result = await confirmSteamImportIdentity({
      wishlistEntryId: "wish-1",
      steamAppId: "portal-two",
    });

    expect(result.error).toBe("Invalid input");
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe("resolveManualSteamAppId", () => {
  it("returns the parsed App ID when no conflict exists", async () => {
    await expect(resolveManualSteamAppId("store.steampowered.com/app/620", "wish-1")).resolves.toEqual({
      ok: true,
      appId: "620",
    });
  });

  it("excludes the edited entry from its own conflict check", async () => {
    await resolveManualSteamAppId("620", "wish-1");

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { steamAppId: "620", id: { not: "wish-1" } },
      }),
    );
  });

  it("rejects before any query when the auth guard fails", async () => {
    (requireUser as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Unauthorized"));

    await expect(resolveManualSteamAppId("620", "wish-1")).rejects.toThrow("Unauthorized");
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});

describe("compatibility auto-trigger on identity confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configurePrisma();
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({});
    transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        wishlistEntry: { findFirst: mockFindFirst, update: mockUpdate },
      }),
    );
    mockFindUnique.mockResolvedValue({ id: "wish-1" });
    mockFindFirst.mockResolvedValue(null);
  });

  it("triggers one silent refresh after a manual identity save on a base game", async () => {
    mockUpdate.mockResolvedValue({
      id: "wish-1",
      type: "BASE_GAME",
      steamAppId: "620",
      steamAppIdProvenance: "USER",
    });

    const result = await setWishlistIdentity({
      wishlistEntryId: "wish-1",
      identityInput: "620",
    });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledTimes(1);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledWith("wish-1");
  });

  it("skips the silent refresh when the saved entry is a DLC wish", async () => {
    mockUpdate.mockResolvedValue({
      id: "wish-dlc",
      type: "DLC",
      steamAppId: "620",
      steamAppIdProvenance: "USER",
    });

    const result = await setWishlistIdentity({
      wishlistEntryId: "wish-dlc",
      identityInput: "620",
    });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).not.toHaveBeenCalled();
  });

  it("does not trigger on identity removal", async () => {
    await removeWishlistIdentity({ wishlistEntryId: "wish-1" });

    expect(silentlyRefreshWishlistCompatibility).not.toHaveBeenCalled();
  });

  it("triggers one silent refresh after confirming a Steam import identity", async () => {
    mockUpdate.mockResolvedValue({
      id: "wish-1",
      type: "BASE_GAME",
      steamAppId: "570",
      steamAppIdProvenance: "STEAM_IMPORT",
    });

    const result = await confirmSteamImportIdentity({
      wishlistEntryId: "wish-1",
      steamAppId: "570",
    });

    expect(result.success).toBe(true);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledTimes(1);
    expect(silentlyRefreshWishlistCompatibility).toHaveBeenCalledWith("wish-1");
  });

});
