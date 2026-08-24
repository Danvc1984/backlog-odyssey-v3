import type { OfferNumericValue } from "@/lib/offer-selection";
import type { OpportunityBadgeResult } from "@/lib/opportunity-badge";

export interface WishlistOfferSource {
  shop: string;
  currency: string | null;
  price: OfferNumericValue | null;
  regularPrice: OfferNumericValue | null;
  discount: number | null;
  historicalLow: OfferNumericValue | null;
  url: string | null;
  itadFlag: string | null;
  drm: string | null;
  fetchedAt: Date | null;
  expiresAt: Date | null;
}

export interface WishlistOfferView {
  shop: string;
  currency: string | null;
  price: number | null;
  regularPrice: number | null;
  discount: number | null;
  historicalLow: number | null;
  url: string | null;
  itadFlag: string | null;
  drm: string | null;
  fetchedAt: Date | null;
  isKeyshop: boolean;
}

export interface WishlistOffersView {
  selected: WishlistOfferView | null;
  alternatives: WishlistOfferView[];
  isStale: boolean;
  targetPriceMxn: number | null;
  opportunity: OpportunityBadgeResult;
}
