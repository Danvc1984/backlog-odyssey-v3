import { evaluateOpportunityBadge } from "./opportunity-badge";
import type {
  WishlistOfferSource,
  WishlistOfferView,
  WishlistOffersView,
} from "@/types/wishlist-offers";

export type OfferNumericValue = number | string | { toNumber(): number };

export interface OfferSelectionInput {
  price?: OfferNumericValue | null;
  currency?: string | null;
  expiresAt: Date | null;
  fetchedAt: Date | null;
  itadFlag: string | null;
}

export interface OfferSelectionResult<T extends OfferSelectionInput> {
  selected: T | null;
  alternatives: T[];
  isStale: boolean;
}

export const OFFER_FRESHNESS_WINDOW_MS = 48 * 60 * 60 * 1000;

export function toOfferNumber(value: OfferNumericValue): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value.toNumber();
}

function hasValidPrice<T extends OfferSelectionInput>(offer: T): boolean {
  return offer.price != null && Number.isFinite(toOfferNumber(offer.price));
}

function isNotExpired<T extends OfferSelectionInput>(offer: T, now: Date): boolean {
  return offer.expiresAt === null || offer.expiresAt.getTime() > now.getTime();
}

function isFresh<T extends OfferSelectionInput>(offer: T, now: Date): boolean {
  if (offer.fetchedAt === null) {
    return false;
  }

  const age = now.getTime() - offer.fetchedAt.getTime();
  return age <= OFFER_FRESHNESS_WINDOW_MS;
}

function normalizedCurrency(currency: string | null | undefined): string | null {
  const value = currency?.trim().toUpperCase();
  return value ? value : null;
}

function sameCurrency<T extends OfferSelectionInput>(offer: T, currency: string | null): boolean {
  return normalizedCurrency(offer.currency) === currency;
}

function comparableOffers<T extends OfferSelectionInput>(offers: T[]): T[] {
  const hasMxn = offers.some((offer) => normalizedCurrency(offer.currency) === "MXN");
  if (hasMxn) {
    return offers.filter((offer) => sameCurrency(offer, "MXN"));
  }

  const firstCurrency = normalizedCurrency(offers[0]?.currency);
  return offers.filter((offer) => sameCurrency(offer, firstCurrency));
}

function sortByPrice<T extends OfferSelectionInput>(offers: T[]): T[] {
  return offers
    .map((offer, index) => ({ offer, index }))
    .sort((left, right) => {
      const priceDifference = toOfferNumber(left.offer.price!) - toOfferNumber(right.offer.price!);
      return priceDifference || left.index - right.index;
    })
    .map(({ offer }) => offer);
}

export function isKeyshopOffer(offer: Pick<OfferSelectionInput, "itadFlag">): boolean {
  return offer.itadFlag === "H";
}

export function selectCheapestOffers<T extends OfferSelectionInput>(
  allOffers: T[],
  now: Date,
): OfferSelectionResult<T> {
  const validOffers = allOffers.filter(
    (offer) => hasValidPrice(offer) && isNotExpired(offer, now),
  );
  const comparable = comparableOffers(validOffers);
  const freshOffers = comparable.filter((offer) => isFresh(offer, now));
  const candidates = sortByPrice(freshOffers.length > 0 ? freshOffers : comparable);
  const selected = candidates[0] ?? null;
  const rankedAlternatives = selected
    ? sortByPrice(comparable).filter((offer) => offer !== selected)
    : [];
  const otherCurrencyOffers = selected
    ? validOffers.filter((offer) => !sameCurrency(offer, normalizedCurrency(selected.currency)))
    : [];
  const alternatives = selected
    ? [...rankedAlternatives, ...otherCurrencyOffers].slice(0, 9)
    : [];

  return {
    selected,
    alternatives,
    isStale: selected !== null && !isFresh(selected, now),
  };
}

function toNullableNumber(value: OfferNumericValue | null): number | null {
  return value == null ? null : toOfferNumber(value);
}

function toWishlistOfferView(offer: WishlistOfferSource): WishlistOfferView {
  return {
    shop: offer.shop,
    currency: offer.currency,
    price: toNullableNumber(offer.price),
    regularPrice: toNullableNumber(offer.regularPrice),
    discount: offer.discount,
    historicalLow: toNullableNumber(offer.historicalLow),
    url: offer.url,
    itadFlag: offer.itadFlag,
    drm: offer.drm,
    fetchedAt: offer.fetchedAt,
    isKeyshop: isKeyshopOffer(offer),
  };
}

export function buildEntryOfferView(
  offers: WishlistOfferSource[],
  targetPriceMxn: OfferNumericValue | null,
  now: Date,
): WishlistOffersView {
  const selection = selectCheapestOffers(offers, now);

  return {
    selected: selection.selected ? toWishlistOfferView(selection.selected) : null,
    alternatives: selection.alternatives.map(toWishlistOfferView),
    isStale: selection.isStale,
    targetPriceMxn: toNullableNumber(targetPriceMxn),
    opportunity: evaluateOpportunityBadge(selection.selected, targetPriceMxn, selection.isStale),
  };
}
