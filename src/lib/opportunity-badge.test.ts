import { describe, expect, it } from "vitest";
import { evaluateOpportunityBadge } from "./opportunity-badge";
import type { OfferSelectionInput } from "./offer-selection";

function offer(price: OfferSelectionInput["price"]): OfferSelectionInput {
  return { price, currency: "MXN", expiresAt: null, fetchedAt: new Date(), itadFlag: null };
}

describe("evaluateOpportunityBadge", () => {
  it("badges a fresh offer at or below the target", () => {
    expect(evaluateOpportunityBadge(offer(100), 100, false).hasBadge).toBe(true);
    expect(evaluateOpportunityBadge(offer(99), 100, false).hasBadge).toBe(true);
  });

  it("does not badge an offer above the target, stale offer, or missing target", () => {
    expect(evaluateOpportunityBadge(offer(101), 100, false).hasBadge).toBe(false);
    expect(evaluateOpportunityBadge(offer(90), 100, true).hasBadge).toBe(false);
    expect(evaluateOpportunityBadge(offer(90), null, false).hasBadge).toBe(false);
  });

  it("accepts a free offer and rejects missing or invalid prices", () => {
    expect(evaluateOpportunityBadge(offer(0), 1, false).hasBadge).toBe(true);
    expect(evaluateOpportunityBadge(offer(null), 1, false).hasBadge).toBe(false);
    expect(evaluateOpportunityBadge({ ...offer(90), price: undefined }, 100, false).hasBadge).toBe(false);
    expect(evaluateOpportunityBadge(null, 1, false).hasBadge).toBe(false);
  });

  it("does not badge a non-MXN offer even when its number is below the target", () => {
    expect(evaluateOpportunityBadge({ ...offer(10), currency: "USD" }, 100, false)).toMatchObject({
      hasBadge: false,
      reason: "non-mxn-currency",
    });
  });
});
