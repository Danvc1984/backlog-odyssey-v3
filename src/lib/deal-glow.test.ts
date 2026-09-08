import { describe, expect, it } from "vitest";

import {
  BUY_HEADING_GLOW_THRESHOLD,
  OFFER_GLOW_THRESHOLD,
  shouldGlowBuyHeading,
  shouldGlowOffer,
} from "./deal-glow";

describe("shouldGlowBuyHeading", () => {
  it.each([null, undefined, BUY_HEADING_GLOW_THRESHOLD])("does not glow at %s", (discount) => {
    expect(shouldGlowBuyHeading(discount)).toBe(false);
  });

  it("glows above the threshold", () => {
    expect(shouldGlowBuyHeading(BUY_HEADING_GLOW_THRESHOLD + 0.01)).toBe(true);
  });
});

describe("shouldGlowOffer", () => {
  it.each([null, undefined, OFFER_GLOW_THRESHOLD])("does not glow at %s", (discount) => {
    expect(shouldGlowOffer(discount)).toBe(false);
  });

  it("glows above the threshold", () => {
    expect(shouldGlowOffer(OFFER_GLOW_THRESHOLD + 0.01)).toBe(true);
  });
});
