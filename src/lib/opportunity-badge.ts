import { toOfferNumber, type OfferSelectionInput, type OfferNumericValue } from "./offer-selection";

export interface OpportunityBadgeResult {
  hasBadge: boolean;
  reason?: string;
}

export function evaluateOpportunityBadge(
  selectedOffer: OfferSelectionInput | null,
  targetPriceMxn: OfferNumericValue | null,
  isStale: boolean,
): OpportunityBadgeResult {
  if (selectedOffer === null) {
    return { hasBadge: false, reason: "no-offer" };
  }

  if (isStale) {
    return { hasBadge: false, reason: "stale-offer" };
  }

  if (selectedOffer.currency?.trim().toUpperCase() !== "MXN") {
    return { hasBadge: false, reason: "non-mxn-currency" };
  }

  if (selectedOffer.price == null || !Number.isFinite(toOfferNumber(selectedOffer.price))) {
    return { hasBadge: false, reason: "invalid-price" };
  }

  if (targetPriceMxn === null || !Number.isFinite(toOfferNumber(targetPriceMxn))) {
    return { hasBadge: false, reason: "no-target" };
  }

  return toOfferNumber(selectedOffer.price) <= toOfferNumber(targetPriceMxn)
    ? { hasBadge: true, reason: "at-or-below-target" }
    : { hasBadge: false, reason: "above-target" };
}
