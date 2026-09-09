import type { CompatibilityStatus, RecommendationDimension } from "@/generated/prisma/client";
import { QUALITY_METACRITIC_HIGH, QUALITY_METACRITIC_LOW } from "./types";

function readableValue(value: string): string {
  const labels: Record<string, string> = {
    PRE_2005: "games from before 2005",
    Y2005_2014: "games from 2005 to 2014",
    Y2015_2019: "games from 2015 to 2019",
    Y2020_PLUS: "games from 2020 onward",
  };
  return labels[value] ?? value.replaceAll("_", " ").toLowerCase();
}

export function interestLabel(interest: number): string {
  if (interest <= 2) return "You have mild interest in this game";
  if (interest === 3) return "You have some interest in this game";
  if (interest === 4) return "You have strong interest in this game";
  return "You have huge interest in this game";
}

export function playTasteLabel(
  dimension: RecommendationDimension,
  value: string,
  points: number,
): string {
  const positive = points >= 0;
  if (positive && (dimension === "GENRE" || dimension === "TAG")) {
    return `Matches your taste for ${readableValue(value)} games`;
  }
  if (positive && dimension === "MATURITY") {
    return `Matches your preference for ${readableValue(value)} games`;
  }
  return positive
    ? `Matches your preference for ${readableValue(value)}`
    : `Less aligned with your taste for ${readableValue(value)}`;
}

export function playPreferenceLabel(value: string, attitude: "AVOID" | "PREFER"): string {
  return attitude === "AVOID"
    ? `Conflicts with your preference against ${readableValue(value)}`
    : `Matches your preference for ${readableValue(value)}`;
}

export function playEnvironmentLabel(status: CompatibilityStatus): string {
  const labels: Record<CompatibilityStatus, string> = {
    READY: "Runs well on your Linux devices",
    READY_WITH_TINKERING: "Runs on Linux with some tinkering",
    FALLBACK_RECOMMENDED: "May need your Windows fallback",
    REQUIRED: "Needs Windows to run",
    UNKNOWN: "Compatibility is still unknown",
  };
  return labels[status];
}

export function playQualityLabel(
  metacriticScore: number | null,
  rating: number | null,
): string[] {
  const labels: string[] = [];
  if (metacriticScore !== null && (metacriticScore >= QUALITY_METACRITIC_HIGH || metacriticScore < QUALITY_METACRITIC_LOW)) {
    labels.push(
      metacriticScore >= QUALITY_METACRITIC_HIGH
        ? `Critics rate it highly (Metacritic ${metacriticScore})`
        : `Critics rate it poorly (Metacritic ${metacriticScore})`,
    );
  }
  if (rating !== null) labels.push(`Players rate it highly (RAWG ${rating})`);
  return labels;
}
