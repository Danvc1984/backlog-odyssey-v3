import type { CompatibilityStatus, GameType, PlayState, Priority } from "@/generated/prisma/client";
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
  | "role_fallback";

export const RERANK_TASTE_CLAMP = 3;
export const RERANK_TASTE_TOTAL_CAP = 12;
export const RERANK_SUPPORT_FULL_STRENGTH = 2;
export const RERANK_PREFER_POINTS = 4;
export const RERANK_AVOID_POINTS = -6;
export const STEAM_RECENCY_WINDOW_DAYS = 180;
export const STEAM_ACTIVITY_POINTS = 2;
export const QUALITY_METACRITIC_HIGH = 85;
export const QUALITY_METACRITIC_LOW = 55;
export const QUALITY_RATING_HIGH = 4.5;
export const QUALITY_CLAMP = 3;
export const COLD_START_MIN_EVENTS = 5;

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
