import { describe, expect, it } from "vitest";
import { rankTodayOffers, type TodayOfferEntry } from "./today-offers";

const now = new Date("2026-08-31T12:00:00.000Z");

function entry(id: string, name: string, price: number, overrides: Partial<TodayOfferEntry> = {}): TodayOfferEntry {
  return {
    wishlistEntryId: id,
    gameName: name,
    targetPriceMxn: null,
    offers: [{ shop: "Store", currency: "MXN", price, regularPrice: 100, sourceCurrency: null, sourcePrice: null, sourceRegularPrice: null, sourceHistoricalLow: null, exchangeRateToMxn: null, discount: 10, historicalLow: null, url: `https://store.test/${id}`, itadFlag: null, drm: null, fetchedAt: now, expiresAt: null }],
    ...overrides,
  };
}

describe("rankTodayOffers", () => {
  it("ranks discount, target, price, and name, excludes stale offers, and caps at three", () => {
    const entries = [
      entry("discount", "Discount", 90, { offers: [{ ...entry("x", "x", 90).offers[0], discount: 20 }] }),
      entry("target", "Target", 80, { targetPriceMxn: 90, offers: [{ ...entry("x", "x", 80).offers[0], discount: 10 }] }),
      entry("cheap", "Cheap", 70),
      entry("z", "Zulu", 60, { offers: [{ ...entry("x", "x", 60).offers[0], discount: 10 }] }),
      entry("a", "Alpha", 60, { offers: [{ ...entry("x", "x", 60).offers[0], discount: 10 }] }),
      entry("stale", "Stale", 1, { offers: [{ ...entry("x", "x", 1).offers[0], fetchedAt: new Date(now.getTime() - 49 * 60 * 60 * 1000) }] }),
    ];
    expect(rankTodayOffers(entries, now).map((offer) => offer.gameName)).toEqual(["Discount", "Target", "Alpha"]);
  });

  it("treats null discounts as zero and absent targets as not met", () => {
    const nullable = entry("null", "Null discount", 20, { offers: [{ ...entry("x", "x", 20).offers[0], discount: null }] });
    const target = entry("target", "Target", 30, { targetPriceMxn: 40, offers: [{ ...entry("x", "x", 30).offers[0], discount: null }] });
    expect(rankTodayOffers([nullable, target], now).map((offer) => offer.gameName)).toEqual(["Target", "Null discount"]);
  });
});
