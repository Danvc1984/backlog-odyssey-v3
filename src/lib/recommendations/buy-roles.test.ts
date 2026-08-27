import { describe, expect, it } from "vitest";
import { assignBuyRoles, resolveBuySaturation, type BuyRoleCandidate } from "./roles";

function candidate(
  id: string,
  options: Partial<Omit<BuyRoleCandidate, "id">> = {},
): BuyRoleCandidate {
  return {
    id,
    interest: 0,
    tastePoints: 0,
    isFresh: false,
    freshDiscount: null,
    isKeyshop: false,
    ...options,
  };
}

describe("resolveBuySaturation", () => {
  it.each([
    [2, 10, false],
    [3, 16, false],
    [3, 15, true],
    [4, 20, true],
    [0, 0, false],
  ])("applies the count and share thresholds (%i of %i)", (fresh80Count, eligibleCount, saturated) => {
    const wishes = Array.from({ length: eligibleCount }, (_, index) =>
      candidate(`wish-${index}`, {
        isFresh: index < fresh80Count,
        freshDiscount: index < fresh80Count ? 80 : null,
      }),
    );
    expect(resolveBuySaturation(wishes)).toMatchObject({ fresh80Count, eligibleCount, saturated });
  });
});

describe("assignBuyRoles", () => {
  it("assigns two best fits and one highest-discount deal normally", () => {
    const result = assignBuyRoles([
      candidate("fit-1", { interest: 5 }),
      candidate("fit-2", { interest: 4 }),
      candidate("deal", { interest: 2, isFresh: true, freshDiscount: 70 }),
    ]);
    expect(result.assigned.map((item) => [item.id, item.role])).toEqual([
      ["fit-1", "BEST_FIT_1"],
      ["fit-2", "BEST_FIT_2"],
      ["deal", "DEAL"],
    ]);
  });

  it("switches to one best fit and two deals when saturated", () => {
    const result = assignBuyRoles([
      candidate("fit", { interest: 5, isFresh: true, freshDiscount: 80 }),
      candidate("deal-a", { interest: 2, isFresh: true, freshDiscount: 95 }),
      candidate("deal-b", { tastePoints: 1, isFresh: true, freshDiscount: 85 }),
      candidate("deal-c", { interest: 3, isFresh: true, freshDiscount: 80 }),
      candidate("other", { interest: 1 }),
    ]);
    expect(result.saturation.saturated).toBe(true);
    expect(result.assigned.map((item) => [item.id, item.role])).toEqual([
      ["fit", "BEST_FIT_1"],
      ["deal-a", "DEAL"],
      ["deal-b", "DEAL"],
    ]);
  });

  it("enforces deal quality and fit floors, then records fallback caveats", () => {
    const result = assignBuyRoles([
      candidate("fit", { interest: 5 }),
      candidate("fit-2", { interest: 4 }),
      candidate("stale", { interest: 5, freshDiscount: 90 }),
      candidate("keyshop", { interest: 5, isFresh: true, freshDiscount: 95, isKeyshop: true }),
      candidate("low-fit", { isFresh: true, freshDiscount: 99 }),
    ]);
    expect(result.assigned[2]).toMatchObject({
      id: "stale",
      role: "DEAL",
      caveats: [{ factor: "role_fallback", label: "No offer met the deal floor" }],
    });
  });

  it("orders deal batches by fresh discount and excludes displayed ids", () => {
    const result = assignBuyRoles([
      candidate("fit", { interest: 5 }),
      candidate("fit-2", { interest: 4 }),
      candidate("deal", { interest: 2, isFresh: true, freshDiscount: 70 }),
      candidate("lower", { interest: 2, isFresh: true, freshDiscount: 40 }),
    ]);
    expect(result.batches.DEAL).toEqual(["lower"]);
    expect(Object.values(result.batches).flat()).not.toEqual(expect.arrayContaining(["fit", "deal"]));
  });
});
