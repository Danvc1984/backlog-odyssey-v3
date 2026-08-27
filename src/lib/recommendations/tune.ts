import { deriveSequelRelationship } from "@/lib/rawg-enrichment";
import type { RawgSeriesEntry } from "@/lib/rawg-types";
import { durationBand, eraBucket } from "@/lib/recommendations/profile";
import type { TuneContext } from "@/lib/recommendations/types";
import { TUNE_MATCH_POINTS, TUNE_TOTAL_CAP } from "@/lib/recommendations/types";

export interface TuneCandidateInput {
  rawgId?: number;
  experience?: string | null;
  playtimeHours?: number | null;
  releaseDate?: string | null;
  genres?: string[];
  tags?: string[];
  esrbRating?: { name: string } | null;
  seriesGames?: RawgSeriesEntry[];
}

export interface TuneMatch {
  points: number;
  criteria: string[];
}

function matchesMaturity(tune: TuneContext["maturity"], rating: string | null): boolean {
  if (!tune || !rating) return false;
  if (tune === "CASUAL") return rating === "Everyone" || rating === "Everyone 10+";
  return rating === "Teen" || rating === "Mature" || rating === "Adults Only";
}

function matchesSequelPosture(
  posture: TuneContext["sequelPosture"],
  candidate: TuneCandidateInput,
): boolean {
  if (!posture) return false;
  const seriesGames = candidate.seriesGames;
  if (!seriesGames || seriesGames.length === 0) return posture === "STANDALONE";
  if (posture === "STANDALONE") return false;
  if (candidate.rawgId === undefined) return false;
  return deriveSequelRelationship(
    { rawgId: candidate.rawgId, releaseDate: candidate.releaseDate ?? null },
    seriesGames,
  ).length > 0;
}

export function matchTuneCriteria(tune: TuneContext, candidate: TuneCandidateInput): TuneMatch {
  const criteria: string[] = [];
  if (tune.experience && tune.experience === candidate.experience) criteria.push("experience");
  if (tune.length && tune.length === durationBand(candidate.playtimeHours ?? null)) criteria.push("length");
  if (tune.genres.some((genre) => candidate.genres?.includes(genre))) criteria.push("genre");
  if (tune.tags.some((tag) => candidate.tags?.includes(tag))) criteria.push("tag");
  if (tune.sequelPosture && matchesSequelPosture(tune.sequelPosture, candidate)) criteria.push("sequelPosture");
  if (tune.era && tune.era === eraBucket(candidate.releaseDate ?? null)) criteria.push("era");
  if (matchesMaturity(tune.maturity, candidate.esrbRating?.name ?? null)) criteria.push("maturity");

  return {
    points: Math.min(criteria.length * TUNE_MATCH_POINTS, TUNE_TOTAL_CAP),
    criteria,
  };
}

export function countTuneMatches(tune: TuneContext, candidates: TuneCandidateInput[], displayCount: number): {
  matchingCount: number;
  thinPool: boolean;
} {
  const matchingCount = candidates.filter((candidate) => matchTuneCriteria(tune, candidate).criteria.length > 0).length;
  return { matchingCount, thinPool: matchingCount < displayCount };
}
