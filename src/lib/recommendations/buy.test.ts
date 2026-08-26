import { describe, expect, it } from "vitest";

import {
  BUY_LIMIT,
  isEligibleForBuy,
  rankBuyCandidates,
  scoreBuyCandidate,
} from "./buy";
import type { BuyCandidate, BuyOffer } from "./buy";

const now = new Date("2026-08-26T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function offer(overrides: Partial<BuyOffer> = {}): BuyOffer {
  return {
    price: "299.00",
    currency: "MXN",
    expiresAt: null,
    fetchedAt: new Date(now.getTime() - 2 * HOUR_MS),
    itadFlag: null,
    discount: null,
    ...overrides,
  };
}

function baseGame(
  overrides: Partial<BuyCandidate["baseGame"]> = {},
): BuyCandidate["baseGame"] {
  return {
    id: "game-base",
    availability: [{ source: "STEAM" }],
    libraryEntry: {
      rating: null,
      playState: "PLAYED_BEFORE",
      replayCandidate: false,
    },
    ...overrides,
  };
}

function candidate(overrides: Partial<BuyCandidate> = {}): BuyCandidate {
  return {
    id: "wish-1",
    name: "Portal 2",
    updatedAt: new Date("2026-08-20T00:00:00.000Z"),
    type: "BASE_GAME",
    interest: null,
    targetPriceMxn: null,
    offers: [offer()],
    baseGame: null,
    ...overrides,
  };
}

describe("isEligibleForBuy", () => {
  it("treats every standalone base-game wish as eligible, even unpriced or stale", () => {
    expect(isEligibleForBuy(candidate())).toBe(true);
    expect(isEligibleForBuy(candidate({ offers: [] }))).toBe(true);
    expect(isEligibleForBuy(candidate({ offers: [offer({ fetchedAt: new Date("2020-01-01T00:00:00.000Z") })] }))).toBe(true);
  });

  it("excludes a DLC wish without a resolvable catalog base game", () => {
    expect(isEligibleForBuy(candidate({ type: "DLC" }))).toBe(false);
  });

  it("excludes a DLC whose owned base has only ROM availability", () => {
    const dlc = candidate({
      type: "DLC",
      baseGame: baseGame({ availability: [{ source: "ROM" }] }),
    });

    expect(isEligibleForBuy(dlc)).toBe(false);
  });

  it("keeps a DLC eligible when its owned base has ROM and a non-ROM availability", () => {
    const dlc = candidate({
      type: "DLC",
      baseGame: baseGame({ availability: [{ source: "ROM" }, { source: "OTHER_PLATFORM" }] }),
    });

    expect(isEligibleForBuy(dlc)).toBe(true);
  });

  it("includes a DLC whose owned base exists on Steam", () => {
    const dlc = candidate({
      type: "DLC",
      baseGame: baseGame(),
    });

    expect(isEligibleForBuy(dlc)).toBe(true);
  });
});

describe("scoreBuyCandidate", () => {
  it("awards ten points per interest level and zero for null interest", () => {
    const scored = scoreBuyCandidate(candidate({ interest: 4 }), now);
    expect(scored.score).toBe(40);
    expect(scored.positive).toEqual([
      { factor: "interest", label: "Interest 4", points: 40 },
    ]);

    const quiet = scoreBuyCandidate(candidate(), now);
    expect(quiet.score).toBe(0);
    expect(quiet.positive).toEqual([]);
  });

  it("caps fresh-discount points at floor(discount/10) up to ten and ignores stale data", () => {
    const fresh = scoreBuyCandidate(candidate({ offers: [offer({ discount: 45 })] }), now);
    expect(fresh.positive).toContainEqual({
      factor: "offer_discount",
      label: "45% off",
      points: 4,
    });

    const capped = scoreBuyCandidate(candidate({ offers: [offer({ discount: 100 })] }), now);
    expect(capped.positive).toContainEqual({
      factor: "offer_discount",
      label: "100% off",
      points: 10,
    });

    const staleData = scoreBuyCandidate(
      candidate({ offers: [offer({ discount: 80, fetchedAt: new Date(now.getTime() - 49 * HOUR_MS) })] }),
      now,
    );
    expect(staleData.positive).toEqual([]);

    const malformed = scoreBuyCandidate(
      candidate({ offers: [offer({ discount: Number.NaN })] }),
      now,
    );
    expect(malformed.positive).toEqual([]);

    const zero = scoreBuyCandidate(candidate({ offers: [offer({ discount: 0 })] }), now);
    expect(zero.positive).toEqual([]);
  });

  it("adds the locked +8 only for a comparable MXN offer at or below target", () => {
    const hit = scoreBuyCandidate(candidate({ targetPriceMxn: "350.00" }), now);
    expect(hit.targetHit).toBe(true);
    expect(hit.positive).toContainEqual({ factor: "target_hit", label: "At or below target $350", points: 8 });
    expect(hit.score).toBe(8);

    const above = scoreBuyCandidate(candidate({ targetPriceMxn: "250.00" }), now);
    expect(above.targetHit).toBe(false);

    const foreignCurrency = scoreBuyCandidate(
      candidate({ targetPriceMxn: "100.00", offers: [offer({ currency: "USD", price: "50.00" })] }),
      now,
    );
    expect(foreignCurrency.targetHit).toBe(false);
    expect(foreignCurrency.score).toBe(0);

    const noTarget = scoreBuyCandidate(candidate(), now);
    expect(noTarget.positive.filter((factor) => factor.factor === "target_hit")).toEqual([]);
  });

  it("boosts an eligible DLC once when its owned base was enjoyed", () => {
    const dlcBase = (overrides: Partial<NonNullable<BuyCandidate["baseGame"]>>): BuyCandidate =>
      candidate({ id: "wish-dlc", type: "DLC", baseGame: baseGame(overrides) });

    const rated = scoreBuyCandidate(dlcBase({ libraryEntry: { rating: 5, playState: "NOT_STARTED", replayCandidate: false } }), now);
    expect(rated.positive).toContainEqual({ factor: "dlc_affinity", label: "Owned base game you enjoyed", points: 6 });
    expect(rated.score).toBe(6);

    const replayed = scoreBuyCandidate(dlcBase({ libraryEntry: { rating: null, playState: "ABANDONED", replayCandidate: true } }), now);
    expect(replayed.positive.filter((factor) => factor.factor === "dlc_affinity")).toHaveLength(1);

    const neutral = scoreBuyCandidate(dlcBase({ libraryEntry: { rating: 3, playState: "NOT_STARTED", replayCandidate: false } }), now);
    expect(neutral.positive).toEqual([]);
    expect(neutral.score).toBe(0);
  });

  it("adds each caveat for the selected offer without touching eligibility or score", () => {
    const flagged = scoreBuyCandidate(
      candidate({
        offers: [
          offer({
            itadFlag: "H",
            fetchedAt: new Date(now.getTime() - 72 * HOUR_MS),
          }),
        ],
      }),
      now,
    );

    expect(flagged.caveats.map((caveat) => caveat.factor)).toEqual([
      "stale_offer",
      "keyshop",
    ]);
    expect(flagged.score).toBe(0);
  });

  it("emits no_pricing when no valid selectable offer exists", () => {
    const unpriced = scoreBuyCandidate(candidate({ offers: [] }), now);
    expect(unpriced.caveats).toEqual([{ factor: "no_pricing", label: "No current offer" }]);

    const expiredOnly = scoreBuyCandidate(
      candidate({ offers: [offer({ expiresAt: new Date(now.getTime() - HOUR_MS) })] }),
      now,
    );
    expect(expiredOnly.caveats[0]?.factor).toBe("no_pricing");
  });

  it("computes a historical-low gap only for comparable MXN offers with a positive low", () => {
    const scored = scoreBuyCandidate(
      candidate({ offers: [offer({ price: "250.00", historicalLow: "500.00" })] }),
      now,
    );
    expect(scored.historicalLowGap).toBeCloseTo(-0.5);

    const zeroLow = scoreBuyCandidate(
      candidate({ offers: [offer({ price: "250.00", historicalLow: "0.00" })] }),
      now,
    );
    expect(zeroLow.historicalLowGap).toBeNull();

    const foreign = scoreBuyCandidate(
      candidate({ offers: [offer({ currency: "USD", price: "25.00", historicalLow: "50.00" })] }),
      now,
    );
    expect(foreign.historicalLowGap).toBeNull();
  });

  it("uses the display-currency historical low, not an unconverted source historical low", () => {
    const scored = scoreBuyCandidate(
      candidate({
        offers: [offer({
          price: "200.00",
          historicalLow: "100.00",
          sourceHistoricalLow: "5.00",
        })],
      }),
      now,
    );

    expect(scored.historicalLowGap).toBe(1);
  });
});

describe("rankBuyCandidates", () => {
  it("orders by score descending and caps at three", () => {
    const ranked = rankBuyCandidates(
      [
        candidate({ id: "low", interest: 1 }),
        candidate({ id: "high", interest: 5 }),
        candidate({ id: "mid-high", interest: 4 }),
        candidate({ id: "mid-low", interest: 3 }),
      ],
      now,
    );

    expect(ranked.map((item) => item.id)).toEqual(["high", "mid-high", "mid-low"]);
    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 3]);
    expect(ranked).toHaveLength(BUY_LIMIT);
  });

  it("breaks equal scores by smaller historical-low gap before any stable tail", () => {
    const closeGap = candidate({
      id: "close-gap",
      interest: 2,
      offers: [offer({ price: "450.00", historicalLow: "500.00" })],
    });
    const farGap = candidate({
      id: "far-gap",
      interest: 2,
      offers: [offer({ price: "900.00", historicalLow: "500.00" })],
    });

    const ranked = rankBuyCandidates([farGap, closeGap], now);

    expect(ranked.map((item) => item.id)).toEqual(["close-gap", "far-gap"]);
  });

  it("ranks candidates without a comparable historical low behind those with one", () => {
    const withLow = candidate({ id: "with-low", interest: 2, offers: [offer({ historicalLow: "400.00" })] });
    const withoutLow = candidate({ id: "without-low", interest: 2, offers: [offer()] });

    const ranked = rankBuyCandidates([withoutLow, withLow], now);

    expect(ranked.map((item) => item.id)).toEqual(["with-low", "without-low"]);
  });

  it("falls back to updatedAt desc then opaque id, never alphabetical by name", () => {
    const alphaNameNewer = candidate({
      id: "zzz",
      name: "Aardvark Quest",
      updatedAt: new Date("2026-08-25T00:00:00.000Z"),
    });
    const zetaOlder = candidate({
      id: "aaa",
      name: "Zorbian Empire",
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    });

    expect(rankBuyCandidates([zetaOlder, alphaNameNewer], now).map((item) => item.id)).toEqual([
      "zzz",
      "aaa",
    ]);

    const sameTimeB = candidate({ id: "wish-b", name: "Beta", updatedAt: new Date("2026-08-20T00:00:00.000Z") });
    const sameTimeA = candidate({ id: "wish-a", name: "Zeta", updatedAt: new Date("2026-08-20T00:00:00.000Z") });

    expect(rankBuyCandidates([sameTimeB, sameTimeA], now).map((item) => item.id)).toEqual([
      "wish-a",
      "wish-b",
    ]);
  });

  it("never surfaces ineligible DLC candidates even when they outscore everyone", () => {
    const orphanDlc = candidate({
      id: "orphan-dlc",
      name: "Orphan Expansion",
      type: "DLC",
      interest: 9,
    });
    const plainWish = candidate({ id: "plain", interest: 1 });

    const ranked = rankBuyCandidates([orphanDlc, plainWish], now);

    expect(ranked.map((item) => item.id)).toEqual(["plain"]);
    expect(ranked[0].rank).toBe(1);
  });
});
