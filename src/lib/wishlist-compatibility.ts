import "server-only";

import type { CompatibilityStatus, Environment } from "@/generated/prisma/client";
import {
  AWAY_URL,
  type AwayProviderError,
  type AwayResult,
} from "@/lib/away-api";
import {
  PROTONDB_URL,
  type ProtonDbProviderError,
  type ProtonDbResult,
} from "@/lib/protondb-api";
import { synthesizeCompatibility } from "@/lib/compat-synthesis";

export const WISHLIST_COMPAT_FRESHNESS_DAYS = 180;

export interface WishlistCompatibilityEligibilityInput {
  type: string;
  steamAppId: string | null;
  steamAppIdProvenance: string | null;
}

export type WishlistCompatibilityEligibility =
  | { eligible: true; steamAppId: string }
  | { eligible: false; reason: "DLC" | "STEAM_ID_REQUIRED" | "STEAM_ID_PROVENANCE_REQUIRED" };

export type WishlistProviderResult =
  | ProtonDbResult
  | ProtonDbProviderError
  | AwayResult
  | AwayProviderError
  | null;

export interface WishlistCompatibilityPersistenceInput {
  wishlistEntryId: string;
  steamAppId: string;
  protonDb: ProtonDbResult | null;
  away: AwayResult | null;
  fetchedAt: Date;
}

export interface WishlistCompatibilitySnapshotRow {
  wishlistEntryId: string;
  provider: "PROTONDB" | "ARE_WE_ANTICHEAT_YET";
  result: Record<string, unknown> | null;
  sourceUrl: string;
  fetchedAt: Date;
  expiresAt: Date;
}

export interface WishlistEnvironmentCompatibilityRow {
  wishlistEntryId: string;
  environment: Environment;
  status: CompatibilityStatus;
  source: string;
}

export function getWishlistCompatibilityEligibility(
  input: WishlistCompatibilityEligibilityInput,
): WishlistCompatibilityEligibility {
  if (input.type === "DLC") return { eligible: false, reason: "DLC" };
  if (!input.steamAppId?.trim()) return { eligible: false, reason: "STEAM_ID_REQUIRED" };
  if (!input.steamAppIdProvenance?.trim()) {
    return { eligible: false, reason: "STEAM_ID_PROVENANCE_REQUIRED" };
  }
  return { eligible: true, steamAppId: input.steamAppId.trim() };
}

export function isWishlistProviderFailure(value: unknown):
  value is ProtonDbProviderError | AwayProviderError {
  return typeof value === "object" && value !== null && "category" in value;
}

export function canPersistWishlistCompatibility(input: {
  protonDb: WishlistProviderResult;
  away: WishlistProviderResult;
}): input is { protonDb: ProtonDbResult | null; away: AwayResult | null } {
  return !isWishlistProviderFailure(input.protonDb) && !isWishlistProviderFailure(input.away);
}

export function buildWishlistCompatibilityPersistence(
  input: WishlistCompatibilityPersistenceInput,
): {
  snapshots: WishlistCompatibilitySnapshotRow[];
  environments: WishlistEnvironmentCompatibilityRow[];
} {
  const expiresAt = new Date(input.fetchedAt.getTime() + 180 * 24 * 60 * 60 * 1000);
  const environments = synthesizeCompatibility({
    protonDb: input.protonDb,
    away: input.away,
    game: { name: "Wishlist entry", hasSteamAppId: true },
  });

  return {
    snapshots: [
      {
        wishlistEntryId: input.wishlistEntryId,
        provider: "PROTONDB",
        result: input.protonDb?.raw ?? null,
        sourceUrl: `${PROTONDB_URL}/${input.steamAppId}.json`,
        fetchedAt: input.fetchedAt,
        expiresAt,
      },
      {
        wishlistEntryId: input.wishlistEntryId,
        provider: "ARE_WE_ANTICHEAT_YET",
        result: input.away ? { ...input.away } : null,
        sourceUrl: AWAY_URL,
        fetchedAt: input.fetchedAt,
        expiresAt,
      },
    ],
    environments: environments.map((row) => ({
      wishlistEntryId: input.wishlistEntryId,
      environment: row.environment,
      status: row.status,
      source: row.source,
    })),
  };
}
