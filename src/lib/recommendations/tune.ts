import { durationBand, eraBucket } from "@/lib/recommendations/profile";
import type {
  ExplanationCaveat,
  ExplanationFactor,
  SourceTune,
  TuneContext,
  TunePlayStyle,
} from "@/lib/recommendations/types";
import {
  SOURCE_TUNE_MATCH_POINTS,
  TUNE_MATCH_POINTS,
  TUNE_TOTAL_CAP,
} from "@/lib/recommendations/types";
import type { AvailabilitySource } from "@/lib/sources/known-sources";

export interface TuneCandidateInput {
  experience?: string | null;
  releaseDate?: string | null;
  genres?: string[];
  tags?: string[];
  esrbRating?: { name: string } | null;
  seriesGames?: Array<{ name: string; releaseDate?: string | null }>;
  durationHours?: number | null;
  gameModes?: string[];
  multiplayerModes?: string[];
  handheldSuitable?: boolean | null;
}

export interface TuneMatch {
  points: number;
  criteria: string[];
}

export type PlayStyleMatch = "MATCH" | "CONFLICT" | "UNKNOWN";

export function matchPlayStyle(
  style: TunePlayStyle | null | undefined,
  candidate: TuneCandidateInput,
): PlayStyleMatch {
  if (!style) return "MATCH";
  const gameModes = new Set(candidate.gameModes ?? []);
  const multiplayerModes = new Set(candidate.multiplayerModes ?? []);
  const hasSolo = gameModes.has("Single-player");
  const hasOnline = multiplayerModes.has("Online co-op") || multiplayerModes.has("Split-screen online");
  const hasCouch = ["Campaign co-op", "Offline co-op", "Split-screen"].some((mode) => multiplayerModes.has(mode));
  const hasKnownMode = hasSolo || hasOnline || hasCouch;
  if (style === "SOLO") return hasSolo ? "MATCH" : hasOnline || hasCouch ? "CONFLICT" : hasKnownMode ? "UNKNOWN" : "UNKNOWN";
  if (style === "ONLINE") return hasOnline ? "MATCH" : hasSolo || hasCouch ? "CONFLICT" : "UNKNOWN";
  return hasCouch ? "MATCH" : hasSolo || hasOnline ? "CONFLICT" : "UNKNOWN";
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
  const releaseDate = candidate.releaseDate ? new Date(candidate.releaseDate).getTime() : NaN;
  return Number.isFinite(releaseDate) && seriesGames.some((entry) => {
    const relatedRelease = entry.releaseDate ? new Date(entry.releaseDate).getTime() : NaN;
    return entry.name.trim().length > 0 && Number.isFinite(relatedRelease) && relatedRelease > releaseDate;
  });
}

export function matchTuneCriteria(tune: TuneContext, candidate: TuneCandidateInput): TuneMatch {
  const criteria: string[] = [];
  if (tune.experience && tune.experience === candidate.experience) criteria.push("experience");
  if (tune.genres.some((genre) => candidate.genres?.includes(genre))) criteria.push("genre");
  if (tune.tags.some((tag) => candidate.tags?.includes(tag))) criteria.push("tag");
  if (tune.sequelPosture && matchesSequelPosture(tune.sequelPosture, candidate)) criteria.push("sequelPosture");
  if (tune.era && tune.era === eraBucket(candidate.releaseDate ?? null)) criteria.push("era");
  const legacyLength = tune.length && tune.length === durationBand(candidate.durationHours ?? null);
  const time = tune.time === "UNDER_6" ? candidate.durationHours !== null && (candidate.durationHours ?? 0) < 6
    : tune.time === "6_20" ? candidate.durationHours !== null && (candidate.durationHours ?? 0) >= 6 && (candidate.durationHours ?? 0) <= 20
      : tune.time === "20_50" ? candidate.durationHours !== null && (candidate.durationHours ?? 0) > 20 && (candidate.durationHours ?? 0) <= 50
        : tune.time === "OVER_50" ? candidate.durationHours !== null && (candidate.durationHours ?? 0) > 50
          : false;
  if (tune.time && time) criteria.push("time");
  else if (legacyLength) criteria.push("length");
  if (tune.playStyle && matchPlayStyle(tune.playStyle, candidate) === "MATCH") criteria.push("playStyle");
  if (matchesMaturity(tune.maturity, candidate.esrbRating?.name ?? null)) criteria.push("maturity");

  return {
    points: Math.min(criteria.length * TUNE_MATCH_POINTS, TUNE_TOTAL_CAP),
    criteria,
  };
}

export function filterPlayTune<T extends { id: string; caveats?: ExplanationCaveat[] }>(
  pool: readonly T[],
  tune: TuneContext | null,
  inputs: ReadonlyMap<string, TuneCandidateInput>,
): T[] {
  if (!tune) return [...pool];
  return pool.flatMap((item) => {
    const input = inputs.get(item.id) ?? {};
    if (tune.handheld && (input.handheldSuitable !== true)) return [];
    const styleMatch = matchPlayStyle(tune.playStyle, input);
    if (styleMatch === "CONFLICT") return [];
    const caveats = styleMatch === "UNKNOWN"
      ? [...(item.caveats ?? []), { factor: "tune_unknown" as const, label: "Play style metadata is unavailable" }]
      : item.caveats;
    return [{ ...item, ...(caveats ? { caveats } : {}) }];
  });
}

export function applyFamiliarity<T extends { tastePoints: number; caveats: ExplanationCaveat[] }>(
  pool: readonly T[],
  familiarity: TuneContext["familiarity"],
): T[] {
  if (familiarity === "DIFFERENT") return pool.filter((item) => item.tastePoints <= 0);
  if (familiarity !== "FAMILIAR") return [...pool];
  return pool.map((item) => item.tastePoints === 0
    ? { ...item, caveats: [...item.caveats, { factor: "tune_unknown", label: "No familiarity signal yet, using normal ranking" }] }
    : item);
}

export function countTuneMatches(tune: TuneContext, candidates: TuneCandidateInput[], displayCount: number): {
  matchingCount: number;
  thinPool: boolean;
} {
  const matchingCount = candidates.filter((candidate) => matchTuneCriteria(tune, candidate).criteria.length > 0).length;
  return { matchingCount, thinPool: matchingCount < displayCount };
}
