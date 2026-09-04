import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ExportDocument } from "./export-schema";

export const EXPORT_VERSION = 1 as const;

export interface ExportEnvelope {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  data: unknown;
}

export function toJsonSafe(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry)]),
    );
  }
  return value;
}

export function buildEnvelope(data: unknown): ExportEnvelope {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function buildExportDocument(): Promise<ExportEnvelope> {
  // Snapshot all reads in one transaction so an export never mixes rows from mid-write.
  return prisma.$transaction(async () => {
    const [
      settings,
      games,
      libraryEntries,
      availability,
      externalIds,
      alternativeSources,
      tags,
      gameTags,
      collections,
      collectionMemberships,
      wishlist,
      unresolvedDlc,
      wishlistImportReviews,
      wishlistImportIgnores,
      possibleDuplicates,
      recommendationRuns,
      recommendationItems,
      recommendationFeedback,
      recommendationEvents,
      recommendationProfile,
      recommendationPreferences,
      recommendationTuneState,
      recommendationPresets,
    ] = await Promise.all([
      prisma.appSettings.findUnique({ where: { id: 1 } }),
      prisma.game.findMany(),
      prisma.libraryEntry.findMany(),
      prisma.gameAvailability.findMany(),
      prisma.externalGameId.findMany(),
      prisma.alternativeSource.findMany(),
      prisma.personalTag.findMany(),
      prisma.gameTag.findMany(),
      prisma.collection.findMany(),
      prisma.collectionMembership.findMany(),
      prisma.wishlistEntry.findMany(),
      prisma.unresolvedSteamDlc.findMany(),
      prisma.wishlistImportReview.findMany(),
      prisma.wishlistImportIgnore.findMany(),
      prisma.possibleDuplicate.findMany(),
      prisma.recommendationRun.findMany(),
      prisma.recommendationItem.findMany(),
      prisma.recommendationFeedback.findMany(),
      prisma.recommendationEvent.findMany(),
      prisma.recommendationProfile.findUnique({ where: { id: 1 } }),
      prisma.recommendationPreference.findMany(),
      prisma.recommendationTuneState.findUnique({ where: { id: 1 } }),
      prisma.recommendationPreset.findMany(),
    ]);

    const data: ExportDocument["data"] = {
      settings: toJsonSafe(settings) as ExportDocument["data"]["settings"],
      games: toJsonSafe(games) as ExportDocument["data"]["games"],
      libraryEntries: toJsonSafe(libraryEntries) as ExportDocument["data"]["libraryEntries"],
      availability: toJsonSafe(availability) as ExportDocument["data"]["availability"],
      externalIds: toJsonSafe(externalIds) as ExportDocument["data"]["externalIds"],
      alternativeSources: toJsonSafe(alternativeSources) as ExportDocument["data"]["alternativeSources"],
      tags: toJsonSafe(tags) as ExportDocument["data"]["tags"],
      gameTags: toJsonSafe(gameTags) as ExportDocument["data"]["gameTags"],
      collections: toJsonSafe(collections) as ExportDocument["data"]["collections"],
      collectionMemberships: toJsonSafe(collectionMemberships) as ExportDocument["data"]["collectionMemberships"],
      wishlist: toJsonSafe(wishlist) as ExportDocument["data"]["wishlist"],
      unresolvedDlc: toJsonSafe(unresolvedDlc) as ExportDocument["data"]["unresolvedDlc"],
      wishlistImportReviews: toJsonSafe(wishlistImportReviews) as ExportDocument["data"]["wishlistImportReviews"],
      wishlistImportIgnores: toJsonSafe(wishlistImportIgnores) as ExportDocument["data"]["wishlistImportIgnores"],
      possibleDuplicates: toJsonSafe(possibleDuplicates) as ExportDocument["data"]["possibleDuplicates"],
      recommendations: {
        runs: toJsonSafe(recommendationRuns) as ExportDocument["data"]["recommendations"]["runs"],
        items: toJsonSafe(recommendationItems) as ExportDocument["data"]["recommendations"]["items"],
        feedback: toJsonSafe(recommendationFeedback) as ExportDocument["data"]["recommendations"]["feedback"],
        events: toJsonSafe(recommendationEvents) as ExportDocument["data"]["recommendations"]["events"],
        profile: toJsonSafe(recommendationProfile) as ExportDocument["data"]["recommendations"]["profile"],
        preferences: toJsonSafe(recommendationPreferences) as ExportDocument["data"]["recommendations"]["preferences"],
        tuneState: toJsonSafe(recommendationTuneState) as ExportDocument["data"]["recommendations"]["tuneState"],
        presets: toJsonSafe(recommendationPresets) as ExportDocument["data"]["recommendations"]["presets"],
      },
    };

    return buildEnvelope(data);
  });
}
