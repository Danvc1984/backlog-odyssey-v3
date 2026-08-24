import { describe, expect, it } from "vitest";
import {
  buildEntryOfferView,
  isKeyshopOffer,
  selectCheapestOffers,
  type OfferSelectionInput,
} from "./offer-selection";

const now = new Date("2026-08-24T12:00:00.000Z");

function offer(overrides: Partial<OfferSelectionInput> = {}): OfferSelectionInput {
  return {
    price: 100,
    expiresAt: null,
    fetchedAt: now,
    itadFlag: null,
    ...overrides,
  };
}

describe("selectCheapestOffers", () => {
  it("selects the cheapest fresh valid offer and keeps up to nine alternatives", () => {
    const offers = Array.from({ length: 12 }, (_, index) =>
      offer({ price: 200 - index * 10 }),
    );

    const result = selectCheapestOffers(offers, now);

    expect(result.selected?.price).toBe(90);
    expect(result.alternatives).toHaveLength(9);
    expect(result.isStale).toBe(false);
  });

  it("treats exactly 48 hours as fresh and older offers as stale", () => {
    const boundary = offer({ price: 80, fetchedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000) });
    const old = offer({ price: 90, fetchedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000 - 1) });

    expect(selectCheapestOffers([boundary], now).isStale).toBe(false);
    expect(selectCheapestOffers([old], now).isStale).toBe(true);
  });

  it("falls back to the cheapest stale valid offer when no fresh offer exists", () => {
    const result = selectCheapestOffers([
      offer({ price: 90, fetchedAt: null }),
      offer({ price: 80, fetchedAt: new Date(now.getTime() - 49 * 60 * 60 * 1000) }),
    ], now);

    expect(result.selected?.price).toBe(80);
    expect(result.isStale).toBe(true);
  });

  it("keeps valid stale offers visible as alternatives when a fresh offer is selected", () => {
    const stale = offer({ price: 80, fetchedAt: new Date(now.getTime() - 49 * 60 * 60 * 1000) });
    const fresh = offer({ price: 100 });

    const result = selectCheapestOffers([fresh, stale], now);

    expect(result.selected).toBe(fresh);
    expect(result.alternatives).toEqual([stale]);
  });

  it("prefers MXN and never ranks a different currency against it", () => {
    const usd = offer({ price: 1, currency: "USD" });
    const mxn = offer({ price: 50, currency: "MXN" });

    const result = selectCheapestOffers([usd, mxn], now);

    expect(result.selected).toBe(mxn);
    expect(result.alternatives).toEqual([usd]);
  });

  it("ignores null, non-finite, zero-price, and expired offers appropriately", () => {
    const result = selectCheapestOffers([
      offer({ price: null }),
      { ...offer(), price: undefined },
      offer({ price: Number.NaN }),
      offer({ price: 0 }),
      offer({ price: 1, expiresAt: now }),
    ], now);

    expect(result.selected?.price).toBe(0);
    expect(result.alternatives).toHaveLength(0);
  });

  it("returns no selection for empty or all-expired input", () => {
    expect(selectCheapestOffers([], now)).toMatchObject({ selected: null, alternatives: [], isStale: false });
    expect(selectCheapestOffers([offer({ expiresAt: new Date(now.getTime() - 1) })], now)).toMatchObject({
      selected: null,
      alternatives: [],
      isStale: false,
    });
  });
});

describe("isKeyshopOffer", () => {
  it("detects the ITAD H keyshop flag only", () => {
    expect(isKeyshopOffer(offer({ itadFlag: "H" }))).toBe(true);
    expect(isKeyshopOffer(offer({ itadFlag: "S" }))).toBe(false);
    expect(isKeyshopOffer(offer({ itadFlag: null }))).toBe(false);
  });
});

describe("buildEntryOfferView", () => {
  it("shapes offer values and evaluates the target badge for the card", () => {
    const view = buildEntryOfferView([
      {
        shop: "Store",
        currency: "MXN",
        price: { toNumber: () => 90 },
        regularPrice: { toNumber: () => 100 },
        discount: 10,
        historicalLow: { toNumber: () => 80 },
        url: "https://example.test/offer",
        itadFlag: "H",
        drm: "Steam",
        fetchedAt: now,
        expiresAt: null,
      },
    ], { toNumber: () => 90 }, now);

    expect(view).toMatchObject({
      targetPriceMxn: 90,
      opportunity: { hasBadge: true },
      selected: {
        shop: "Store",
        price: 90,
        regularPrice: 100,
        historicalLow: 80,
        isKeyshop: true,
      },
    });
  });
});
