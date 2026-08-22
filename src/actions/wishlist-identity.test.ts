import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { identityConflictMessage } from "@/lib/wishlist-identity-view";
import {
  confirmRawgSuggestedIdentity,
  confirmSteamImportIdentity,
  dismissRawgIdentitySuggestion,
  removeWishlistIdentity,
  resolveManualSteamAppId,
  setWishlistIdentity,
} from "./wishlist-identity";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const transaction = vi.fn();

function configurePrisma() {
  (prisma as unknown as { $transaction: typeof transaction }).$transaction = transaction;
  (prisma as unknown as { wishlistEntry: Record<string, ReturnType<typeof vi.fn>> }).wishlistEntry = {
    findUnique: mockFindUnique,
    findFirst: mockFindFirst,
    update: mockUpdate,
  };
  (prisma as unknown as { wishlistMetadataSnapshot: Record<string, ReturnType<typeof vi.fn>> }).wishlistMetadataSnapshot = {
    updateMany: mockUpdateMany,
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
  mockUpdateMany.mockResolvedValue({ count: 1 });
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

describe("confirmRawgSuggestedIdentity", () => {
  const suggestionSnapshot = {
    payload: {
      storeLink: {
        steamUrl: "https://store.steampowered.com/app/620/Portal_2/",
        steamAppId: "620",
      },
    },
  };

  it("confirms the snapshot suggestion with RAWG_SUGGESTION provenance", async () => {
    mockFindUnique.mockResolvedValue({
      id: "wish-1",
      steamAppId: null,
      metadataSnapshot: suggestionSnapshot,
    });

    const result = await confirmRawgSuggestedIdentity({ wishlistEntryId: "wish-1" });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { steamAppId: "620", steamAppIdProvenance: "RAWG_SUGGESTION" },
      }),
    );
  });

  it("blocks duplicates using the suggested App ID", async () => {
    mockFindUnique.mockResolvedValue({
      id: "wish-1",
      steamAppId: null,
      metadataSnapshot: suggestionSnapshot,
    });
    mockFindFirst.mockResolvedValue({ id: "wish-9", name: "Hades II" });

    const result = await confirmRawgSuggestedIdentity({ wishlistEntryId: "wish-1" });

    expect(result.success).toBe(false);
    expect(result.error).toBe(identityConflictMessage("620", "Hades II"));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses when the entry already has a confirmed identity", async () => {
    mockFindUnique.mockResolvedValue({
      id: "wish-1",
      steamAppId: "570",
      metadataSnapshot: suggestionSnapshot,
    });

    const result = await confirmRawgSuggestedIdentity({ wishlistEntryId: "wish-1" });

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuses when the snapshot carries no store link", async () => {
    mockFindUnique.mockResolvedValue({
      id: "wish-1",
      steamAppId: null,
      metadataSnapshot: { payload: {} },
    });

    const result = await confirmRawgSuggestedIdentity({ wishlistEntryId: "wish-1" });

    expect(result.error).toBe("No RAWG store-link suggestion to confirm");
  });
});

describe("dismissRawgIdentitySuggestion", () => {
  it("stamps the dismissal inside the snapshot payload", async () => {
    const payload = {
      storeLink: {
        steamUrl: "https://store.steampowered.com/app/620/Portal_2/",
        steamAppId: "620",
      },
      rawgId: 123,
    };
    mockFindUnique.mockResolvedValue({
      id: "wish-1",
      metadataSnapshot: { payload },
    });

    const result = await dismissRawgIdentitySuggestion({ wishlistEntryId: "wish-1" });

    expect(result.success).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const call = mockUpdateMany.mock.calls[0][0] as { data: { payload: Record<string, unknown> } };
    expect(call.data.payload.rawgId).toBe(123);
    expect(typeof call.data.payload.storeLinkDismissedAt).toBe("string");
  });

  it("is a no-op success without a snapshot or store link", async () => {
    mockFindUnique.mockResolvedValue({ id: "wish-1", metadataSnapshot: null });
    const noSnapshot = await dismissRawgIdentitySuggestion({ wishlistEntryId: "wish-1" });
    expect(noSnapshot.success).toBe(true);
    expect(mockUpdateMany).not.toHaveBeenCalled();

    mockFindUnique.mockResolvedValue({ id: "wish-1", metadataSnapshot: { payload: {} } });
    const noLink = await dismissRawgIdentitySuggestion({ wishlistEntryId: "wish-1" });
    expect(noLink.success).toBe(true);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
