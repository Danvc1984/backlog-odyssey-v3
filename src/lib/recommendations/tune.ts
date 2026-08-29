import { deriveSequelRelationship } from "@/lib/rawg-enrichment";
import type { RawgSeriesEntry } from "@/lib/rawg-types";
import { durationBand, eraBucket } from "@/lib/recommendations/profile";
import type {
  ExplanationFactor,
  SourceTune,
  TuneContext,
} from "@/lib/recommendations/types";
import {
  SOURCE_TUNE_MATCH_POINTS,
  TUNE_MATCH_POINTS,
  TUNE_TOTAL_CAP,
} from "@/lib/recommendations/types";
import type { AvailabilitySource } from "@/lib/sources/known-sources";

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

export interface CandidateSource {
  source: AvailabilitySource;
  alternativeSourceId: string | null;
}

export interface SourceTunableCandidate {
  id: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats?: { factor: string; label: string }[];
  sources: CandidateSource[];
}

export function matchSourceTune(
  sourceTune: SourceTune | null | undefined,
  candidateSources: readonly CandidateSource[],
): CandidateSource[] {
  if (!sourceTune) return [];
  const selectedAlternativeIds = new Set(sourceTune.alternativeSourceIds);
  return candidateSources.filter((candidate) => {
    if (candidate.source === "STEAM") return sourceTune.steam;
    if (candidate.source === "ROM") return sourceTune.rom;
    return sourceTune.allAlternatives || (
      candidate.alternativeSourceId !== null &&
      selectedAlternativeIds.has(candidate.alternativeSourceId)
    );
  });
}

function sourceMatchName(
  source: CandidateSource,
  sourcesById: ReadonlyMap<string, string>,
): string {
  if (source.source === "STEAM") return "Steam";
  if (source.source === "ROM") return "ROM";
  return source.alternativeSourceId
    ? sourcesById.get(source.alternativeSourceId) ?? "Other platform"
    : "Other platform";
}

export function applySourceTune<T extends SourceTunableCandidate>(
  pool: readonly T[],
  sourceTune: SourceTune | null | undefined,
  sourcesById: ReadonlyMap<string, string>,
): T[] {
  if (!sourceTune) return [...pool];
  return pool
    .map((item) => {
      const matchedSources = matchSourceTune(sourceTune, item.sources);
      if (matchedSources.length === 0) return item;
      const sourceNames = [...new Set(matchedSources.map((source) => sourceMatchName(source, sourcesById)))];
      return {
        ...item,
        score: item.score + SOURCE_TUNE_MATCH_POINTS,
        positive: [
          ...item.positive,
          {
            factor: "source_tune",
            label: `Matches your source tune: ${sourceNames.join(", ")}`,
            points: SOURCE_TUNE_MATCH_POINTS,
            sourceNames,
          },
        ],
      };
    })
    .sort((left, right) => right.score - left.score);
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
