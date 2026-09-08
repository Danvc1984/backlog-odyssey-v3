export const BUY_HEADING_GLOW_THRESHOLD = 60;
export const OFFER_GLOW_THRESHOLD = 80;

export function shouldGlowBuyHeading(discount: number | null | undefined): boolean {
  return discount != null && discount > BUY_HEADING_GLOW_THRESHOLD;
}

export function shouldGlowOffer(discount: number | null | undefined): boolean {
  return discount != null && discount > OFFER_GLOW_THRESHOLD;
}
