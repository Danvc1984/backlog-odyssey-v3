import type { CompatibilityStatus, GameExperience, GameType, PlayState, Priority } from "@/generated/prisma/client";
import { z } from "zod";
import type { AwayStatus } from "@/lib/away-api";

export const RUN_RETENTION_DAYS = 365;

export type ExplanationFactorKey =
  | "interest"
  | "priority"
  | "play_soon"
  | "replay"
  | "abandoned"
  | "calibration"
  | "offer_discount"
  | "target_hit"
  | "dlc_affinity"
  | "compat_bazzite"
  | "compat_tinkering"
  | "compat_fallback"
  | "compat_required"
  | "compat_unknown"
  | "compat_stale"
  | "anticheat"
  | "compat_na"
  | "no_pricing"
  | "stale_offer"
  | "keyshop"
  | "compat_base_game"
  | "taste_profile"
  | "preference"
  | "steam_recent"
  | "environment_fit"
  | "quality"
  | "limited_basis"
  | "role_fallback"
  | "tune_match"
  | "tune_thin_pool"
  | "source_tune"
  | "second_chance";

export const RERANK_TASTE_CLAMP = 3;
export const RERANK_TASTE_TOTAL_CAP = 12;
export const RERANK_SUPPORT_FULL_STRENGTH = 2;
export const RERANK_PREFER_POINTS = 4;
export const RERANK_AVOID_POINTS = -6;
export const CALIBRATION_DISMISSALS_PER_POINT = 3;
export const CALIBRATION_POINTS_PER_INTEREST = 10;
export const STEAM_RECENCY_WINDOW_DAYS = 180;
export const STEAM_ACTIVITY_POINTS = 2;
export const QUALITY_METACRITIC_HIGH = 85;
export const QUALITY_METACRITIC_LOW = 55;
export const QUALITY_RATING_HIGH = 4.5;
export const QUALITY_CLAMP = 3;
export const COLD_START_MIN_EVENTS = 5;

export const TUNE_MATCH_POINTS = 5;
export const TUNE_TOTAL_CAP = 10;
export const SOURCE_TUNE_MATCH_POINTS = 3;

export interface SourceTune {
  steam: boolean;
  rom: boolean;
  allAlternatives: boolean;
  alternativeSourceIds: string[];
}

export interface TuneContext {
  experience: GameExperience | null;
  length: "SHORT" | "MEDIUM" | "LONG" | "VERY_LONG" | null;
  genres: string[];
  tags: string[];
  sequelPosture: "SEQUEL" | "STANDALONE" | null;
  era: "PRE_2005" | "Y2005_2014" | "Y2015_2019" | "Y2020_PLUS" | null;
  maturity: "CASUAL" | "MATURE" | null;
  sourceTune?: SourceTune | null;
}

export const tuneContextSchema = z.object({
  experience: z.enum(["PC_GAMING", "MULTIPLAYER_COOP", "COUCH_GAMING", "ON_THE_GO"]).nullable(),
  length: z.enum(["SHORT", "MEDIUM", "LONG", "VERY_LONG"]).nullable(),
  genres: z.array(z.string().trim().min(1)).max(100),
  tags: z.array(z.string().trim().min(1)).max(100),
  sequelPosture: z.enum(["SEQUEL", "STANDALONE"]).nullable(),
  era: z.enum(["PRE_2005", "Y2005_2014", "Y2015_2019", "Y2020_PLUS"]).nullable(),
  maturity: z.enum(["CASUAL", "MATURE"]).nullable(),
  sourceTune: z.object({
    steam: z.boolean(),
    rom: z.boolean(),
    allAlternatives: z.boolean(),
    alternativeSourceIds: z.array(z.string().trim().min(1)).max(100),
  }).strict().nullable().optional(),
}).strict();

export const RERANK_ENVIRONMENT_POINTS: Record<string, number> = {
  READY: 2,
  READY_WITH_TINKERING: 1,
  FALLBACK_RECOMMENDED: -2,
  REQUIRED: -3,
};

export type RerankMode = "RERANKED" | "COLD_START";

export interface RerankAppliedFactors {
  taste: number;
  steam: number;
  environment: number;
  quality: number;
}

export interface RerankRunContext {
  mode: RerankMode;
  applied: RerankAppliedFactors;
}

export interface ExplanationFactor {
  factor: ExplanationFactorKey;
  label: string;
  points: number;
  sourceNames?: string[];
}

export interface ExplanationCaveat {
  factor: ExplanationFactorKey;
  label: string;
}

export const EXPOSURE_COOLDOWN_DAYS = 7;

export interface RotatableCandidate {
  id: string; // gameId (play runs) or wishlistEntryId (buy runs)
  score: number;
  positive: ExplanationFactor[];
  negative: ExplanationFactor[];
  caveats: ExplanationCaveat[];
}

export interface PlayNextLibraryView {
  playState: PlayState;
  priority: Priority | null;
  interest: number | null;
  playSoon: boolean;
  replayCandidate: boolean;
  hidden: boolean;
  isMainGame: boolean;
}

export interface PlayNextCandidate {
  id: string;
  name: string;
  type: GameType;
  libraryEntry: PlayNextLibraryView | null;
}

export interface CompatEvidenceInput {
  hasSteamIdentity: boolean;
  romOnly: boolean;
  overrideStatus: CompatibilityStatus | null;
  protonDbStatus: CompatibilityStatus | null;
  protonDbFetchedAt: Date | null;
  awayStatus: AwayStatus | null;
}
