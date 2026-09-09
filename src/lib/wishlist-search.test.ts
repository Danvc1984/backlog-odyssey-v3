import { describe, expect, it } from "vitest";
import { matchWishlistEntries, sortWishlistEntries, wishlistWhere } from "./wishlist-search";

function entry(
  id: string,
  discount: number | null,
  interest: number | null,
  updatedAt: string,
) {
  return {
    id,
    discount,
    interest,
    updatedAt: new Date(updatedAt),
    offerView: { selected: discount === null ? null : { discount } },
  };
}

describe("wishlistWhere", () => {
  it("keeps only database filters", () => {
    expect(wishlistWhere({ type: "DLC", interest: 4, query: "  shadow  " })).toEqual({
      type: "DLC",
      interest: 4,
    });
  });

  it("does not add a search condition for an empty query", () => {
    expect(wishlistWhere({ type: "BASE_GAME", query: "  " })).toEqual({
      type: "BASE_GAME",
      interest: undefined,
    });
  });
});

describe("matchWishlistEntries", () => {
  const entries = [
    { id: "elden", name: "Elden Ring", type: "BASE_GAME", baseGameName: null },
    { id: "dlc", name: "Shadow of the Erdtree", type: "DLC", baseGameName: "Elden Ring" },
    { id: "other", name: "Hades", type: "BASE_GAME", baseGameName: null },
  ];

  it("tolerates fuzzy typos and matches DLC base-game names", () => {
    expect(matchWishlistEntries("eldin ring", entries).map(({ id }) => id)).toEqual([
      "elden",
      "dlc",
    ]);
  });

  it("returns all entries for an empty query", () => {
    expect(matchWishlistEntries("  ", entries)).toEqual(entries);
  });
});

describe("sortWishlistEntries", () => {
  it("puts the deepest discounts first and entries without discounts last", () => {
    const entries = [
      entry("none", null, 5, "2026-01-03"),
      entry("small", 10, 5, "2026-01-02"),
      entry("deep", 75, 3, "2026-01-01"),
      entry("zero", 0, 5, "2026-01-04"),
    ];

    expect(sortWishlistEntries(entries).map(({ id }) => id)).toEqual([
      "deep",
      "small",
      "zero",
      "none",
    ]);
  });

  it("uses interest, updatedAt, then id as tie-breakers", () => {
    const entries = [
      entry("older", 25, 4, "2026-01-01"),
      entry("lower-interest", 25, 3, "2026-01-03"),
      entry("newer", 25, 4, "2026-01-02"),
      entry("id-b", 25, 4, "2026-01-02"),
      entry("id-a", 25, 4, "2026-01-02"),
    ];

    expect(sortWishlistEntries(entries).map(({ id }) => id)).toEqual([
      "id-a",
      "id-b",
      "newer",
      "older",
      "lower-interest",
    ]);
  });
});
