import { prisma } from "@/lib/prisma";
import { enrichWishlistBaseGameFromIgdb, enrichWishlistDlcFromIgdb } from "./wishlist-igdb-enrichment";
import { parseIgdbMetadataPayload } from "./igdb-metadata-payload";

const IGDB_ENRICHMENT_CONCURRENCY = 6;

export interface WishlistIgdbEnrichmentResult {
  enriched: number;
  skipped: number;
}

async function enrichWishlistEntry(entryId: string, refreshExisting: boolean): Promise<WishlistIgdbEnrichmentResult> {
  try {
    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        name: true,
        type: true,
        steamAppId: true,
        steamAppIdProvenance: true,
        metadataSnapshot: { select: { id: true, payload: true } },
        baseGame: {
          select: {
            metadataSnapshots: {
              where: { provider: "IGDB" },
              orderBy: { fetchedAt: "desc" },
              take: 1,
              select: { payload: true },
            },
          },
        },
      },
    });
    if (!entry || !["BASE_GAME", "DLC"].includes(entry.type) || (entry.metadataSnapshot && !refreshExisting)) {
      return { enriched: 0, skipped: 1 };
    }

    const persistedIgdbId = entry.metadataSnapshot
      ? parseIgdbMetadataPayload(entry.metadataSnapshot.payload)?.igdbId ?? null
      : null;
    const enrichmentInput = persistedIgdbId === null
      ? { entry }
      : { entry, selectedIgdbId: persistedIgdbId };

    const result = entry.type === "DLC"
      ? await enrichWishlistDlcFromIgdb(enrichmentInput)
      : await enrichWishlistBaseGameFromIgdb(enrichmentInput);
    return result.success ? { enriched: 1, skipped: 0 } : { enriched: 0, skipped: 1 };
  } catch {
    return { enriched: 0, skipped: 1 };
  }
}

export async function autoEnrichWishlistEntries(
  entryIds: readonly string[],
  options: { refreshExisting?: boolean } = {},
): Promise<WishlistIgdbEnrichmentResult> {
  const result = { enriched: 0, skipped: 0 };
  const refreshExisting = options.refreshExisting ?? false;
  for (let index = 0; index < entryIds.length; index += IGDB_ENRICHMENT_CONCURRENCY) {
    const batch = await Promise.all(
      entryIds
        .slice(index, index + IGDB_ENRICHMENT_CONCURRENCY)
        .map((entryId) => enrichWishlistEntry(entryId, refreshExisting)),
    );
    for (const entryResult of batch) {
      result.enriched += entryResult.enriched;
      result.skipped += entryResult.skipped;
    }
  }
  return result;
}
