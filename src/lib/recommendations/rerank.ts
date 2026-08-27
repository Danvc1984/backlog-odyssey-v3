import type {
  CompatibilityStatus,
  PlayState,
  RecommendationDimension,
  RecommendationPreferenceAttitude,
} from "@/generated/prisma/client";
import type { ExplanationCaveat, ExplanationFactor, RerankAppliedFactors, RerankMode, RerankRunContext } from "./types";
import {
  COLD_START_MIN_EVENTS,
  QUALITY_CLAMP,
  QUALITY_METACRITIC_HIGH,
  QUALITY_METACRITIC_LOW,
  QUALITY_RATING_HIGH,
  RERANK_AVOID_POINTS,
  RERANK_ENVIRONMENT_POINTS,
  RERANK_PREFER_POINTS,
  RERANK_SUPPORT_FULL_STRENGTH,
  RERANK_TASTE_CLAMP,
  RERANK_TASTE_TOTAL_CAP,
  STEAM_ACTIVITY_POINTS,
  STEAM_RECENCY_WINDOW_DAYS,
} from "./types";
import type { CandidateDimensionValues, RecommendationProfilePayload } from "./profile";
import { profileDimensionKeys } from "./profile";
import { PLAY_NEXT_LIMIT, compareRankedPlay } from "./play-next";
import { BUY_LIMIT, compareBuyTiebreak, type BuyTiebreakView } from "./buy";

export interface TastePreference {
  dimension: RecommendationDimension;
  value: string;
  attitude: RecommendationPreferenceAttitude;
}

export interface TasteInput {
  profile: RecommendationProfilePayload;
  dimensionValues: CandidateDimensionValues;
  preferences: readonly TastePreference[];
}

export interface TasteResult {
  points: number;
  factors: ExplanationFactor[];
}

interface TasteContribution {
  dimension: RecommendationDimension;
  points: number;
  factor: ExplanationFactor;
}

const OVERRIDE_PRECEDENCE: Record<RecommendationPreferenceAttitude, number> = {
  AVOID: 3,
  PREFER: 2,
  NEUTRAL: 1,
};

function clampPoints(points: number): number {
  return Math.max(-RERANK_TASTE_CLAMP, Math.min(RERANK_TASTE_CLAMP, points));
}

function scaledWeight(weight: number, support: number): number {
  return weight * Math.min(1, support / RERANK_SUPPORT_FULL_STRENGTH);
}

function strongestValue(values: string[], scaled: Map<string, number>): string {
  let best = values[0];
  for (const value of values) {
    if (Math.abs(scaled.get(value) ?? 0) > Math.abs(scaled.get(best) ?? 0)) {
      best = value;
    }
  }
  return best;
}

function derivedContributions(
  profile: RecommendationProfilePayload,
  dimensionValues: CandidateDimensionValues,
): TasteContribution[] {
  const contributions: TasteContribution[] = [];
  for (const dimension of profileDimensionKeys()) {
    const values = dimensionValues[dimension];
    if (!values || values.length === 0) continue;

    const signals = profile.dimensions[dimension] ?? {};
    const scaled = new Map<string, number>();
    let total = 0;
    for (const value of values) {
      const signal = signals[value];
      if (!signal) continue;
      const scaledValue = scaledWeight(signal.weight, signal.support);
      scaled.set(value, (scaled.get(value) ?? 0) + scaledValue);
      total += scaledValue;
    }

    const clamped = clampPoints(total);
    if (clamped === 0) continue;
    const value = strongestValue(values, scaled);
    contributions.push({
      dimension,
      points: clamped,
      factor: {
        factor: "taste_profile",
        label: clamped > 0 ? `${value} affinity` : `${value} aversion`,
        points: clamped,
      },
    });
  }
  return contributions;
}

function resolveOverride(
  dimension: RecommendationDimension,
  values: string[],
  preferences: readonly TastePreference[],
): { attitude: RecommendationPreferenceAttitude; value: string } | null {
  let best: { attitude: RecommendationPreferenceAttitude; value: string } | null = null;
  for (const value of values) {
    for (const preference of preferences) {
      if (preference.dimension !== dimension || preference.value !== value) continue;
      if (!best || OVERRIDE_PRECEDENCE[preference.attitude] > OVERRIDE_PRECEDENCE[best.attitude]) {
        best = { attitude: preference.attitude, value };
      }
    }
  }
  return best;
}

function overrideContributions(
  dimensionValues: CandidateDimensionValues,
  preferences: readonly TastePreference[],
): TasteContribution[] {
  const contributions: TasteContribution[] = [];
  for (const dimension of profileDimensionKeys()) {
    const values = dimensionValues[dimension];
    if (!values || values.length === 0) continue;

    const override = resolveOverride(dimension, values, preferences);
    if (!override || override.attitude === "NEUTRAL") continue;
    const points = override.attitude === "AVOID" ? RERANK_AVOID_POINTS : RERANK_PREFER_POINTS;
    contributions.push({
      dimension,
      points,
      factor: {
        factor: "preference",
        label: override.attitude === "AVOID" ? `You avoid ${override.value}` : `You marked ${override.value} as preferred`,
        points,
      },
    });
  }
  return contributions;
}

export function scoreTaste(input: TasteInput): TasteResult {
  const { profile, dimensionValues, preferences } = input;

  const derived = derivedContributions(profile, dimensionValues);
  const vetoes = new Set<RecommendationDimension>();
  for (const dimension of profileDimensionKeys()) {
    const values = dimensionValues[dimension];
    if (!values || values.length === 0) continue;
    const override = resolveOverride(dimension, values, preferences);
    if (override?.attitude === "NEUTRAL") vetoes.add(dimension);
  }

  const overrides = overrideContributions(dimensionValues, preferences);
  const contributions = [
    ...derived.filter((contribution) => !vetoes.has(contribution.dimension)),
    ...overrides,
  ];

  const ordered = [...contributions].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const applied: TasteContribution[] = [];
  let points = 0;
  for (const contribution of ordered) {
    if (Math.abs(points + contribution.points) <= RERANK_TASTE_TOTAL_CAP) {
      applied.push(contribution);
      points += contribution.points;
    }
  }

  return { points, factors: applied.map((contribution) => contribution.factor) };
}

export interface SteamActivityInput {
  playState: PlayState | null;
  replayCandidate: boolean;
  steamLastPlayed: Date | null;
}

const ENVIRONMENT_LABELS: Record<string, string> = {
  READY: "Ready on your setup",
  READY_WITH_TINKERING: "Ready with tinkering",
  FALLBACK_RECOMMENDED: "Fallback recommended",
  REQUIRED: "Requires extra setup",
};

export function scoreSteamActivity(input: SteamActivityInput, now: Date): ExplanationFactor | null {
  if (!input.steamLastPlayed) return null;
  const isReplayOrAbandoned =
    input.playState === "ABANDONED" || (input.replayCandidate && input.playState === "PLAYED_BEFORE");
  if (!isReplayOrAbandoned) return null;

  const ageDays = (now.getTime() - input.steamLastPlayed.getTime()) / 86400000;
  if (ageDays < 0 || ageDays > STEAM_RECENCY_WINDOW_DAYS) return null;
  return { factor: "steam_recent", label: "Played recently on Steam", points: STEAM_ACTIVITY_POINTS };
}

export function scoreEnvironmentFit(status: CompatibilityStatus | null): ExplanationFactor | null {
  if (status === null) return null;
  const points = RERANK_ENVIRONMENT_POINTS[status];
  if (!points) return null;
  return {
    factor: "environment_fit",
    label: ENVIRONMENT_LABELS[status] ?? status,
    points,
  };
}

export interface QualityInput {
  metacriticScore: number | null;
  rating: number | null;
}

export function scoreQuality(input: QualityInput): ExplanationFactor | null {
  let points = 0;
  const parts: string[] = [];
  if (input.metacriticScore !== null) {
    if (input.metacriticScore >= QUALITY_METACRITIC_HIGH) {
      points += 2;
      parts.push(`Metacritic ${input.metacriticScore}`);
    } else if (input.metacriticScore < QUALITY_METACRITIC_LOW) {
      points -= 1;
      parts.push(`Metacritic ${input.metacriticScore}`);
    }
  }
  if (input.rating !== null && input.rating >= QUALITY_RATING_HIGH) {
    points += 1;
    parts.push(`RAWG rating ${input.rating}`);
  }
  if (points === 0) return null;
  const clamped = Math.max(-QUALITY_CLAMP, Math.min(QUALITY_CLAMP, points));
  return { factor: "quality", label: parts.join(", "), points: clamped };
}

export function resolveRerankMode(profile: RecommendationProfilePayload): RerankMode {
  const hasTasteEvidence = profileDimensionKeys().some(
    (dimension) => Object.keys(profile.dimensions[dimension] ?? {}).length > 0,
  );
  if (profile.evidence.eventsConsidered < COLD_START_MIN_EVENTS || !hasTasteEvidence) {
    return "COLD_START";
  }
  return "RERANKED";
}

export interface ColdStartPick {
  genres: string[];
}

export function selectColdStartPicks<T extends ColdStartPick>(pool: readonly T[], limit: number): T[] {
  const picked: T[] = [];
  const pickedGenres = new Set<string>();
  const deferred: T[] = [];
  for (const item of pool) {
    if (picked.length >= limit) break;
    if (item.genres.some((genre) => pickedGenres.has(genre))) {
      deferred.push(item);
      continue;
    }
    picked.push(item);
    for (const genre of item.genres) pickedGenres.add(genre);
  }
  for (const item of deferred) {
    if (picked.length >= limit) break;
    picked.push(item);
  }
  return picked;
}

export function limitedBasisCaveat(): ExplanationCaveat {
  return { factor: "limited_basis", label: "Cold start: limited history, showing a varied mix" };
}

export interface RerankPlayInput {
  id: string;
  name: string;
  baselineScore: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  dimensionValues: CandidateDimensionValues;
  steam: SteamActivityInput;
  envStatus: CompatibilityStatus | null;
  quality: QualityInput;
}

export interface RerankedPlayItem {
  id: string;
  name: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
}

export function rerankPlayCandidates(
  pool: readonly RerankPlayInput[],
  profile: RecommendationProfilePayload,
  preferences: readonly TastePreference[],
  now: Date,
): { items: RerankedPlayItem[]; context: RerankRunContext } {
  const mode = resolveRerankMode(profile);
  const applied: RerankAppliedFactors = { taste: 0, steam: 0, environment: 0, quality: 0 };

  const scored = pool.map((candidate) => {
    const steamFactor = scoreSteamActivity(candidate.steam, now);
    const envFactor = scoreEnvironmentFit(candidate.envStatus);
    let score = candidate.baselineScore + (steamFactor?.points ?? 0) + (envFactor?.points ?? 0);
    const positive = [...candidate.positive];
    const negative = [...candidate.negative];
    const caveats: ExplanationCaveat[] = [];
    if (steamFactor) positive.push(steamFactor);
    if (envFactor) {
      if (envFactor.points >= 0) positive.push(envFactor);
      else negative.push(envFactor);
    }

    let tasteCounted = false;
    let qualityCounted = false;
    if (mode === "RERANKED") {
      const taste = scoreTaste({ profile, dimensionValues: candidate.dimensionValues, preferences });
      for (const factor of taste.factors) {
        if (factor.points >= 0) positive.push(factor);
        else negative.push(factor);
      }
      score += taste.points;
      tasteCounted = taste.points !== 0;

      const quality = scoreQuality(candidate.quality);
      if (quality) {
        if (quality.points >= 0) positive.push(quality);
        else negative.push(quality);
        score += quality.points;
        qualityCounted = quality.points !== 0;
      }
    } else {
      caveats.push(limitedBasisCaveat());
    }

    if (tasteCounted) applied.taste += 1;
    if (steamFactor) applied.steam += 1;
    if (envFactor) applied.environment += 1;
    if (qualityCounted) applied.quality += 1;

    return {
      id: candidate.id,
      genres: candidate.dimensionValues.GENRE ?? [],
      item: { id: candidate.id, name: candidate.name, score, positive, negative, caveats } as RerankedPlayItem,
    };
  });

  let items: RerankedPlayItem[];
  if (mode === "COLD_START") {
    const pickPool = scored.map((entry, index) => ({ index, genres: entry.genres }));
    const picked = new Set(selectColdStartPicks(pickPool, PLAY_NEXT_LIMIT).map((pick) => pick.index));
    items = scored.filter((_, index) => picked.has(index)).map((entry) => entry.item);
  } else {
    items = scored
      .map((entry) => entry.item)
      .sort(compareRankedPlay)
      .slice(0, PLAY_NEXT_LIMIT);
  }

  return { items, context: { mode, applied } };
}

export interface RerankBuyInput {
  id: string;
  baselineScore: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
  dimensionValues: CandidateDimensionValues;
  quality: QualityInput;
  tiebreak: BuyTiebreakView;
}

export interface RerankedBuyItem {
  id: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
}

export function rerankBuyCandidates(
  pool: readonly RerankBuyInput[],
  profile: RecommendationProfilePayload,
  preferences: readonly TastePreference[],
): { items: RerankedBuyItem[]; context: RerankRunContext } {
  const mode = resolveRerankMode(profile);
  const applied: RerankAppliedFactors = { taste: 0, steam: 0, environment: 0, quality: 0 };

  const scored = pool.map((candidate) => {
    const positive = [...candidate.positive];
    const negative = [...candidate.negative];
    const caveats = [...candidate.caveats];
    let score = candidate.baselineScore;
    let tasteCounted = false;
    let qualityCounted = false;

    if (mode === "RERANKED") {
      const taste = scoreTaste({ profile, dimensionValues: candidate.dimensionValues, preferences });
      for (const factor of taste.factors) {
        if (factor.points >= 0) positive.push(factor);
        else negative.push(factor);
      }
      score += taste.points;
      tasteCounted = taste.points !== 0;

      const quality = scoreQuality(candidate.quality);
      if (quality) {
        if (quality.points >= 0) positive.push(quality);
        else negative.push(quality);
        score += quality.points;
        qualityCounted = quality.points !== 0;
      }
    } else {
      caveats.push(limitedBasisCaveat());
    }

    if (tasteCounted) applied.taste += 1;
    if (qualityCounted) applied.quality += 1;

    return {
      genres: candidate.dimensionValues.GENRE ?? [],
      tiebreak: candidate.tiebreak,
      item: { id: candidate.id, score, positive, negative, caveats } as RerankedBuyItem,
    };
  });

  let items: RerankedBuyItem[];
  if (mode === "COLD_START") {
    const pickPool = scored.map((entry, index) => ({ index, genres: entry.genres }));
    const picked = new Set(selectColdStartPicks(pickPool, BUY_LIMIT).map((pick) => pick.index));
    items = scored.filter((_, index) => picked.has(index)).map((entry) => entry.item);
  } else {
    items = scored
      .slice()
      .sort((left, right) => {
        if (right.item.score !== left.item.score) return right.item.score - left.item.score;
        return compareBuyTiebreak(left.tiebreak, right.tiebreak);
      })
      .slice(0, BUY_LIMIT)
      .map((entry) => entry.item);
  }

  return { items, context: { mode, applied } };
}
