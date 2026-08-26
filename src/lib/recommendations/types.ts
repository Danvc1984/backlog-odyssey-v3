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
  | "compat_base_game";

export interface ExplanationFactor {
  factor: ExplanationFactorKey;
  label: string;
  points: number;
}

export interface ExplanationCaveat {
  factor: ExplanationFactorKey;
  label: string;
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
