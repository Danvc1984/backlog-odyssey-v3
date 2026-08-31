import {
  buildEntryOfferView,
  OFFER_FRESHNESS_WINDOW_MS,
  toOfferNumber,
  type OfferNumericValue,
} from "@/lib/offer-selection";
import type { WishlistOfferSource } from "@/types/wishlist-offers";

export interface TodayOfferEntry {
  wishlistEntryId: string;
  gameName: string;
  targetPriceMxn: OfferNumericValue | null;
  offers: WishlistOfferSource[];
}

export interface TodayOfferView {
  wishlistEntryId: string;
  gameName: string;
  discountPercent: number | null;
  price: number;
  currency: string;
  store: string;
  fetchedAt: string;
  targetMet: boolean;
  sellerUrl: string | null;
}

export function rankTodayOffers(entries: readonly TodayOfferEntry[], now: Date): TodayOfferView[] {
  return entries
    .map((entry) => {
      const view = buildEntryOfferView(entry.offers, entry.targetPriceMxn, now);
      const offer = view.selected;
      if (!offer || offer.price === null || !offer.currency || !offer.fetchedAt) return null;
      if (now.getTime() - offer.fetchedAt.getTime() > OFFER_FRESHNESS_WINDOW_MS) return null;
      return {
        wishlistEntryId: entry.wishlistEntryId,
        gameName: entry.gameName,
        discountPercent: offer.discount,
        price: offer.price,
        currency: offer.currency,
        store: offer.shop,
        fetchedAt: offer.fetchedAt.toISOString(),
        targetMet: entry.targetPriceMxn !== null && offer.price <= toOfferNumber(entry.targetPriceMxn),
        sellerUrl: offer.url,
      };
    })
    .filter((offer): offer is TodayOfferView => offer !== null)
    .sort((left, right) => {
      const discount = (right.discountPercent ?? 0) - (left.discountPercent ?? 0);
      if (discount !== 0) return discount;
      if (left.targetMet !== right.targetMet) return left.targetMet ? -1 : 1;
      return left.price - right.price || left.gameName.toLowerCase().localeCompare(right.gameName.toLowerCase());
    })
    .slice(0, 3);
}
