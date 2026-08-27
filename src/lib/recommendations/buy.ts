import type { GameType } from "@/generated/prisma/client";
import {
  OFFER_FRESHNESS_WINDOW_MS,
  isKeyshopOffer,
  selectCheapestOffers,
  toOfferNumber,
  type OfferSelectionInput,
} from "@/lib/offer-selection";
import type { ExplanationCaveat, ExplanationFactor } from "./types";

export const BUY_LIMIT = 3;

export const MAX_DISCOUNT_POINTS = 10;

export const TARGET_HIT_SCORE = 8;

const DLC_AFFINITY_POINTS = 6;

type PlayStateLike =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PLAYED_BEFORE"
  | "ABANDONED";

export interface BuyBaseGameView {
  id: string;
  availability: { source: "STEAM" | "OTHER_PLATFORM" | "ROM" }[];
  libraryEntry: {
    rating: number | null;
    playState: PlayStateLike | null;
    replayCandidate: boolean;
  } | null;
}

export interface BuyOffer extends OfferSelectionInput {
  discount?: number | null;
  historicalLow?: OfferSelectionInput["price"] | null;
}

export interface BuyDealInputs {
  isFresh: boolean;
  freshDiscount: number | null;
  isKeyshop: boolean;
}

export interface BuyCandidate {
  id: string;
  name: string;
  updatedAt: Date;
  type: GameType;
  interest: number | null;
  targetPriceMxn: OfferSelectionInput["price"] | null;
  offers: BuyOffer[];
  baseGame: BuyBaseGameView | null;
}

export function isEligibleForBuy(candidate: BuyCandidate): boolean {
  if (candidate.type === "BASE_GAME") {
    return true;
  }
  if (candidate.type !== "DLC") {
    return false;
  }
  const base = candidate.baseGame;
  if (!base) {
    return false;
  }
  const romOnly =
    base.availability.length > 0 &&
    base.availability.every((row) => row.source === "ROM");
  return !romOnly;
}

function freshDiscountPoints(offer: BuyOffer, now: Date): number {
  if (offer.discount == null || offer.fetchedAt === null) {
    return 0;
  }
  const age = now.getTime() - offer.fetchedAt.getTime();
  if (age < 0 || age > OFFER_FRESHNESS_WINDOW_MS) {
    return 0;
  }
  const discount = offer.discount;
  if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
    return 0;
  }
  return Math.min(Math.floor(discount / 10), MAX_DISCOUNT_POINTS);
}

export function getBuyDealInputs(candidate: BuyCandidate, now: Date): BuyDealInputs {
  const selection = selectCheapestOffers(candidate.offers, now);
  const selected = selection.selected;
  if (!selected) return { isFresh: false, freshDiscount: null, isKeyshop: false };
  return {
    isFresh: !selection.isStale,
    freshDiscount: selected.discount ?? null,
    isKeyshop: isKeyshopOffer(selected),
  };
}

export interface ScoredBuyCandidate {
  id: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
  historicalLowGap: number | null;
  selection: ReturnType<typeof selectCheapestOffers<BuyOffer>>;
  targetHit: boolean;
}

export function scoreBuyCandidate(
  candidate: BuyCandidate,
  now: Date,
): ScoredBuyCandidate {
  const positive: ExplanationFactor[] = [];
  const negative: ExplanationFactor[] = [];
  const caveats: ExplanationCaveat[] = [];
  let score = 0;

  if (candidate.interest != null && candidate.interest * 10 !== 0) {
    const points = candidate.interest * 10;
    score += points;
    positive.push({ factor: "interest", label: `Interest ${candidate.interest}`, points });
  }

  const selection = selectCheapestOffers(candidate.offers, now);
  const selected = selection.selected;

  let historicalLowGap: number | null = null;
  let targetHit = false;

  if (!selected) {
    caveats.push({ factor: "no_pricing", label: "No current offer" });
  } else {
    const price = toOfferNumber(selected.price!);

    if (selection.isStale) {
      caveats.push({ factor: "stale_offer", label: "Price data is stale" });
    }

    if (isKeyshopOffer(selected)) {
      caveats.push({ factor: "keyshop", label: "Key shop listing" });
    }

    const currency = selected.currency?.trim().toUpperCase() ?? null;
    const comparableMxn = currency === "MXN";
    if (
      comparableMxn &&
      candidate.targetPriceMxn != null
    ) {
      const target = toOfferNumber(candidate.targetPriceMxn);
      if (Number.isFinite(target) && price <= target) {
        targetHit = true;
        score += TARGET_HIT_SCORE;
        positive.push({
          factor: "target_hit",
          label: `At or below target $${target}`,
          points: TARGET_HIT_SCORE,
        });
      }
    }

    const discountPoints = freshDiscountPoints(selected, now);
    if (discountPoints > 0) {
      score += discountPoints;
      positive.push({
        factor: "offer_discount",
        label: `${selected.discount}% off`,
        points: discountPoints,
      });
    }

    const historicalLow = selected.historicalLow;
    if (comparableMxn && historicalLow != null) {
      const low = toOfferNumber(historicalLow);
      if (Number.isFinite(low) && low > 0) {
        historicalLowGap = (price - low) / low;
      }
    }
  }

  if (candidate.type === "DLC") {
    const base = candidate.baseGame;
    if (base?.libraryEntry) {
      const entry = base.libraryEntry;
      const ratedHigh = entry.rating != null && entry.rating >= 4;
      const playedBefore = entry.playState === "PLAYED_BEFORE";
      const replayFlagged = entry.replayCandidate;
      if (ratedHigh || playedBefore || replayFlagged) {
        score += DLC_AFFINITY_POINTS;
        positive.push({
          factor: "dlc_affinity",
          label: "Owned base game you enjoyed",
          points: DLC_AFFINITY_POINTS,
        });
      }
    }
  }

  return {
    id: candidate.id,
    score,
    positive,
    negative,
    caveats,
    historicalLowGap,
    selection,
    targetHit,
  };
}

export interface RankedBuyItem {
  id: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
  historicalLowGap: number | null;
  targetHit: boolean;
  rank: number;
}

export interface BuyTiebreakView {
  historicalLowGap: number | null;
  updatedAt: Date;
  id: string;
}

export function compareBuyTiebreak(left: BuyTiebreakView, right: BuyTiebreakView): number {
  const leftGap = left.historicalLowGap;
  const rightGap = right.historicalLowGap;
  if (leftGap != null && rightGap == null) return -1;
  if (leftGap == null && rightGap != null) return 1;
  if (leftGap != null && rightGap != null && leftGap !== rightGap) {
    return leftGap - rightGap;
  }
  const byUpdated = right.updatedAt.getTime() - left.updatedAt.getTime();
  if (byUpdated !== 0) return byUpdated;
  return left.id.localeCompare(right.id);
}

export function rankAllBuyCandidates(
  candidates: readonly BuyCandidate[],
  now: Date,
): RankedBuyItem[] {
  const withIdentity = candidates
    .filter(isEligibleForBuy)
    .map((candidate) => ({ candidate, scored: scoreBuyCandidate(candidate, now) }))
    .sort((left, right) => {
      if (right.scored.score !== left.scored.score) {
        return right.scored.score - left.scored.score;
      }
      return compareBuyTiebreak(
        { historicalLowGap: left.scored.historicalLowGap, updatedAt: left.candidate.updatedAt, id: left.candidate.id },
        { historicalLowGap: right.scored.historicalLowGap, updatedAt: right.candidate.updatedAt, id: right.candidate.id },
      );
    });

  return withIdentity.map(({ scored }, index) => ({
    id: scored.id,
    score: scored.score,
    positive: scored.positive,
    negative: scored.negative,
    caveats: scored.caveats,
    historicalLowGap: scored.historicalLowGap,
    targetHit: scored.targetHit,
    rank: index + 1,
  }));
}

export function rankBuyCandidates(
  candidates: readonly BuyCandidate[],
  now: Date,
): RankedBuyItem[] {
  return rankAllBuyCandidates(candidates, now).slice(0, BUY_LIMIT);
}
