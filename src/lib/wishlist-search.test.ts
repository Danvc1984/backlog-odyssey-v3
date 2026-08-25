import { describe, expect, it } from "vitest";
import { wishlistWhere } from "./wishlist-search";

describe("wishlistWhere", () => {
  it("matches titles and DLC base-game titles while preserving filters", () => {
    expect(wishlistWhere({ type: "DLC", interest: 4, query: "  shadow  " })).toEqual({
      type: "DLC",
      interest: 4,
      OR: [
        { name: { contains: "shadow", mode: "insensitive" } },
        { baseGame: { name: { contains: "shadow", mode: "insensitive" } } },
      ],
    });
  });

  it("does not add a search condition for an empty query", () => {
    expect(wishlistWhere({ type: "BASE_GAME", query: "  " })).toEqual({
      type: "BASE_GAME",
      interest: undefined,
    });
  });
});
