import { describe, expect, it } from "vitest";
import {
  wishlistIdentitySnapshotView,
  wishlistIdentitySuggestion,
} from "./wishlist-identity-view";

const fetchedAt = "2026-08-21T12:00:00.000Z";

const snapshotWithLink = {
  fetchedAt,
  storeLink: {
    steamUrl: "https://store.steampowered.com/app/620/Portal_2/",
    steamAppId: "620",
  },
  storeLinkDismissedAt: null,
};

describe("wishlistIdentitySnapshotView", () => {
  it("extracts only identity fields from a RAWG payload", () => {
    expect(
      wishlistIdentitySnapshotView({
        storeLink: snapshotWithLink.storeLink,
        storeLinkDismissedAt: "2026-08-21T13:00:00.000Z",
        description: "large payload omitted from the client view",
      }),
    ).toEqual({
      storeLink: snapshotWithLink.storeLink,
      storeLinkDismissedAt: new Date("2026-08-21T13:00:00.000Z").getTime(),
    });
  });

  it("returns null when the payload has no valid store link", () => {
    const cases = [
      { genres: ["RPG"] },
      { storeLink: { steamUrl: "x", steamAppId: "abc" } },
      { storeLink: { steamUrl: 5, steamAppId: "620" } },
    ];
    for (const payload of cases) {
      expect(wishlistIdentitySnapshotView(payload)).toBeNull();
    }
  });
});

describe("wishlistIdentitySuggestion", () => {
  it("returns no suggestion for an entry without identity or snapshot", () => {
    expect(
      wishlistIdentitySuggestion({ steamAppId: null, steamAppIdProvenance: null }, null),
    ).toEqual({ suggestion: null, dismissed: false });
  });

  it("returns no suggestion once identity is confirmed", () => {
    expect(
      wishlistIdentitySuggestion(
        { steamAppId: "620", steamAppIdProvenance: "RAWG_SUGGESTION" },
        snapshotWithLink,
      ),
    ).toEqual({ suggestion: null, dismissed: false });
  });

  it("surfaces a live suggestion from the snapshot payload", () => {
    expect(
      wishlistIdentitySuggestion({ steamAppId: null, steamAppIdProvenance: null }, snapshotWithLink),
      ).toEqual({
        suggestion: {
          steamUrl: "https://store.steampowered.com/app/620/Portal_2/",
          steamAppId: "620",
        },
        dismissed: false,
      });
  });

  it("marks a suggestion dismissed when dismissed after the snapshot fetch", () => {
    const dismissed = {
      ...snapshotWithLink,
      storeLinkDismissedAt: new Date("2026-08-21T13:00:00.000Z").getTime(),
    };

    const result = wishlistIdentitySuggestion(
      { steamAppId: null, steamAppIdProvenance: null },
      dismissed,
    );

    expect(result.dismissed).toBe(true);
    expect(result.suggestion).toEqual({
      steamUrl: "https://store.steampowered.com/app/620/Portal_2/",
      steamAppId: "620",
    });
  });

  it("ignores dismissals that predate the current snapshot", () => {
    const stale = {
      fetchedAt,
      storeLink: snapshotWithLink.storeLink,
      storeLinkDismissedAt: new Date("2026-08-20T00:00:00.000Z").getTime(),
    };

    expect(
      wishlistIdentitySuggestion({ steamAppId: null, steamAppIdProvenance: null }, stale),
    ).toMatchObject({ dismissed: false });
  });

  it("treats a missing snapshot as no suggestion", () => {
    expect(
      wishlistIdentitySuggestion({ steamAppId: null, steamAppIdProvenance: null }, null),
    ).toEqual({ suggestion: null, dismissed: false });
  });

  it("does not treat an App ID without provenance as confirmed", () => {
    expect(
      wishlistIdentitySuggestion(
        { steamAppId: "620", steamAppIdProvenance: null },
        snapshotWithLink,
      ),
    ).toMatchObject({ dismissed: false, suggestion: { steamAppId: "620" } });
  });
});
