import { prisma } from "@/lib/prisma";
import { enrichWishlistBaseGameFromIgdb } from "./wishlist-igdb-enrichment";

const IGDB_ENRICHMENT_CONCURRENCY = 6;

export interface WishlistIgdbEnrichmentResult {
  enriched: number;
  skipped: number;
}

async function enrichWishlistEntry(entryId: string): Promise<WishlistIgdbEnrichmentResult> {
  try {
    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        name: true,
        type: true,
        steamAppId: true,
        steamAppIdProvenance: true,
        metadataSnapshot: { select: { id: true } },
      },
    });
    if (!entry || entry.type !== "BASE_GAME" || entry.metadataSnapshot) return { enriched: 0, skipped: 1 };

    const result = await enrichWishlistBaseGameFromIgdb({ entry });
    return result.success ? { enriched: 1, skipped: 0 } : { enriched: 0, skipped: 1 };
  } catch {
    return { enriched: 0, skipped: 1 };
  }
}

export async function autoEnrichWishlistEntries(
  entryIds: readonly string[],
): Promise<WishlistIgdbEnrichmentResult> {
  const result = { enriched: 0, skipped: 0 };
  for (let index = 0; index < entryIds.length; index += IGDB_ENRICHMENT_CONCURRENCY) {
    const batch = await Promise.all(entryIds.slice(index, index + IGDB_ENRICHMENT_CONCURRENCY).map(enrichWishlistEntry));
    for (const entryResult of batch) {
      result.enriched += entryResult.enriched;
      result.skipped += entryResult.skipped;
    }
  }
  return result;
}
