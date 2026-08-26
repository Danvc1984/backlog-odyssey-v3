import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { lookupAway } from "@/lib/away-api";
import { prisma } from "@/lib/prisma";
import { lookupProtonDb } from "@/lib/protondb-api";
import {
  buildWishlistCompatibilityPersistence,
  canPersistWishlistCompatibility,
  getWishlistCompatibilityEligibility,
  isWishlistProviderFailure,
} from "@/lib/wishlist-compatibility";

export interface WishlistCompatibilityRefreshView {
  fetchedAt: string;
  snapshotCount: number;
  environmentCount: number;
}

export type WishlistCompatibilityRefreshResult = {
  success: boolean;
  data: WishlistCompatibilityRefreshView | null;
  error: string | null;
};

function providerFailureMessage(value: unknown): string {
  if (isWishlistProviderFailure(value)) return "Compatibility provider unavailable";
  return "Compatibility provider returned no usable evidence";
}

export async function runWishlistCompatibilityRefresh(
  wishlistEntryId: string,
): Promise<WishlistCompatibilityRefreshResult> {
  const entry = await prisma.wishlistEntry.findUnique({
    where: { id: wishlistEntryId },
    select: {
      id: true,
      type: true,
      steamAppId: true,
      steamAppIdProvenance: true,
    },
  });
  if (!entry) return { success: false, data: null, error: "Wishlist entry not found" };

  const eligibility = getWishlistCompatibilityEligibility(entry);
  if (!eligibility.eligible) {
    return { success: false, data: null, error: eligibility.reason };
  }

  const [protonDb, away] = await Promise.all([
    lookupProtonDb(eligibility.steamAppId),
    lookupAway(eligibility.steamAppId),
  ]);
  const providerResults = { protonDb, away };
  if (!canPersistWishlistCompatibility(providerResults)) {
    const failedProvider = isWishlistProviderFailure(providerResults.protonDb)
      ? providerResults.protonDb
      : providerResults.away;
    return {
      success: false,
      data: null,
      error: providerFailureMessage(failedProvider),
    };
  }

  const fetchedAt = new Date();
  const persistence = buildWishlistCompatibilityPersistence({
    wishlistEntryId: entry.id,
    steamAppId: eligibility.steamAppId,
    protonDb: providerResults.protonDb,
    away: providerResults.away,
    fetchedAt,
  });

  try {
    await prisma.$transaction(async (tx) => {
      for (const snapshot of persistence.snapshots) {
        await tx.wishlistCompatibilitySnapshot.upsert({
          where: {
            wishlistEntryId_provider: {
              wishlistEntryId: snapshot.wishlistEntryId,
              provider: snapshot.provider,
            },
          },
          create: {
            ...snapshot,
            result: snapshot.result === null ? Prisma.JsonNull : snapshot.result as Prisma.InputJsonValue,
          },
          update: {
            result: snapshot.result === null ? Prisma.JsonNull : snapshot.result as Prisma.InputJsonValue,
            sourceUrl: snapshot.sourceUrl,
            fetchedAt: snapshot.fetchedAt,
            expiresAt: snapshot.expiresAt,
          },
        });
      }
      for (const environment of persistence.environments) {
        await tx.wishlistEnvironmentCompatibility.upsert({
          where: {
            wishlistEntryId_environment: {
              wishlistEntryId: environment.wishlistEntryId,
              environment: environment.environment,
            },
          },
          create: environment,
          update: { status: environment.status, source: environment.source },
        });
      }
    });
  } catch {
    return {
      success: false,
      data: null,
      error: "Compatibility evidence could not be saved",
    };
  }

  return {
    success: true,
    data: {
      fetchedAt: fetchedAt.toISOString(),
      snapshotCount: persistence.snapshots.length,
      environmentCount: persistence.environments.length,
    },
    error: null,
  };
}

export async function silentlyRefreshWishlistCompatibility(
  wishlistEntryId: string,
): Promise<void> {
  try {
    await runWishlistCompatibilityRefresh(wishlistEntryId);
  } catch {
    return;
  }
}
