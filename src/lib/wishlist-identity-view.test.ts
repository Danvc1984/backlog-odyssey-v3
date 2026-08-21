import { describe, expect, it } from "vitest";
import { wishlistIdentitySuggestion } from "./wishlist-identity-view";

const fetchedAt = "2026-08-21T12:00:00.000Z";

const snapshotWithLink = {
  fetchedAt,
  payload: {
    storeLink: {
      steamUrl: "https://store.steampowered.com/app/620/Portal_2/",
      steamAppId: "620",
    },
  },
};

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
      payload: {
        ...snapshotWithLink.payload,
        storeLinkDismissedAt: "2026-08-21T13:00:00.000Z",
      },
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
      payload: {
        ...snapshotWithLink.payload,
        storeLinkDismissedAt: "2026-08-20T00:00:00.000Z",
      },
    };

    expect(
      wishlistIdentitySuggestion({ steamAppId: null, steamAppIdProvenance: null }, stale),
    ).toMatchObject({ dismissed: false });
  });

  it("treats malformed payloads as no suggestion", () => {
    const cases: Parameters<typeof wishlistIdentitySuggestion>[1][] = [
      null,
      { payload: null, fetchedAt },
      { payload: { storeLink: { steamUrl: "x", steamAppId: "abc" } }, fetchedAt },
      { payload: { storeLink: { steamUrl: 5, steamAppId: "620" } }, fetchedAt },
    ];
    for (const snapshot of cases) {
      expect(
        wishlistIdentitySuggestion({ steamAppId: null, steamAppIdProvenance: null }, snapshot),
      ).toEqual({ suggestion: null, dismissed: false });
    }
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
