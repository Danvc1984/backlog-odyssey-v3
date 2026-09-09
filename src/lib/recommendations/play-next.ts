import type { PlayNextCandidate } from "./types";
import type { ExplanationFactor } from "./types";
import { interestLabel } from "./play-factor-labels";

const PRIORITY_POINTS = {
  NONE: 0,
  LOW: 2,
  MEDIUM: 4,
  HIGH: 6,
} as const;

export const PLAY_NEXT_LIMIT = 3;

export function isEligibleForPlayNext(candidate: PlayNextCandidate): boolean {
  const entry = candidate.libraryEntry;
  if (!entry || candidate.type !== "BASE_GAME") return false;
  if (entry.hidden || entry.isMainGame) return false;
  if (entry.playState === "NOT_STARTED") return true;
  return (
    entry.replayCandidate &&
    (entry.playState === "PLAYED_BEFORE" || entry.playState === "ABANDONED")
  );
}

export interface ScoredPlayNextCandidate {
  id: string;
  name: string;
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
}

export function scorePlayNextCandidate(
  candidate: PlayNextCandidate,
): ScoredPlayNextCandidate {
  const entry = candidate.libraryEntry;
  const positive: ExplanationFactor[] = [];
  const negative: ExplanationFactor[] = [];
  let score = 0;

  if (entry) {
    if (entry.interest != null && entry.interest * 10 !== 0) {
      const points = entry.interest * 10;
      score += points;
      positive.push({ factor: "interest", label: interestLabel(entry.interest), points });
    }
    const priority = entry.priority ?? "NONE";
    const priorityPoints = PRIORITY_POINTS[priority];
    if (priority !== "NONE" && priorityPoints !== 0) {
      score += priorityPoints;
      positive.push({
        factor: "priority",
        label: `${priority[0]}${priority.slice(1).toLowerCase()} priority in your backlog`,
        points: priorityPoints,
      });
    }
    if (entry.playSoon) {
      score += 3;
      positive.push({ factor: "play_soon", label: "Marked for an upcoming session", points: 3 });
    }
    const replayState =
      entry.replayCandidate &&
      (entry.playState === "PLAYED_BEFORE" || entry.playState === "ABANDONED");
    if (replayState) {
      score += 2;
      positive.push({ factor: "replay", label: "You marked it as a replay candidate", points: 2 });
    }
    if (entry.playState === "ABANDONED") {
      score -= 2;
      negative.push({ factor: "abandoned", label: "Previously set aside", points: -2 });
    }
  }

  return { id: candidate.id, name: candidate.name, score, positive, negative };
}

export interface RankedPlayNextItem extends ScoredPlayNextCandidate {
  rank: number;
}

export function compareRankedPlay(
  left: { score: number; name: string },
  right: { score: number; name: string },
): number {
  if (right.score !== left.score) return right.score - left.score;
  return left.name.toLowerCase().localeCompare(right.name.toLowerCase());
}

export function rankAllPlayNextCandidates(
  candidates: readonly PlayNextCandidate[],
): RankedPlayNextItem[] {
  const scored = candidates
    .filter(isEligibleForPlayNext)
    .map(scorePlayNextCandidate)
    .sort(compareRankedPlay);

  return scored.map((item, index) => ({ ...item, rank: index + 1 }));
}

export function rankPlayNextCandidates(
  candidates: readonly PlayNextCandidate[],
): RankedPlayNextItem[] {
  return rankAllPlayNextCandidates(candidates).slice(0, PLAY_NEXT_LIMIT);
}
