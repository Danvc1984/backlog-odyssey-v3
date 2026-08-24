import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { matchRawgGame } from "@/lib/rawg-api";
import { toWishlistMetadataPayload } from "@/lib/rawg-enrichment";

const RAWG_ENRICHMENT_CONCURRENCY = 3;
const RAWG_REQUEST_DELAY_MS = 150;

export interface WishlistRawgEnrichmentResult {
  enriched: number;
  skipped: number;
}

function waitForRateLimit(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RAWG_REQUEST_DELAY_MS));
}

async function enrichWishlistEntry(entryId: string): Promise<WishlistRawgEnrichmentResult> {
  try {
    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        name: true,
        type: true,
        metadataSnapshot: { select: { id: true } },
      },
    });
    if (!entry || entry.type !== "BASE_GAME" || entry.metadataSnapshot) {
      return { enriched: 0, skipped: 1 };
    }

    const match = await matchRawgGame({ title: entry.name, selectedRawgId: null });
    if (match.outcome !== "MATCHED") {
      return { enriched: 0, skipped: 1 };
    }

    const fetchedAt = new Date();
    const payload = toWishlistMetadataPayload(match.game, fetchedAt);
    await prisma.wishlistMetadataSnapshot.upsert({
      where: { wishlistEntryId: entry.id },
      update: {
        provider: "RAWG",
        payload: payload as unknown as Prisma.InputJsonValue,
        sourceUrl: match.game.rawgUrl,
        fetchedAt,
        expiresAt: null,
      },
      create: {
        wishlistEntryId: entry.id,
        provider: "RAWG",
        payload: payload as unknown as Prisma.InputJsonValue,
        sourceUrl: match.game.rawgUrl,
        fetchedAt,
        expiresAt: null,
      },
    });
    return { enriched: 1, skipped: 0 };
  } catch {
    return { enriched: 0, skipped: 1 };
  }
}

export async function autoEnrichWishlistEntries(
  entryIds: readonly string[],
): Promise<WishlistRawgEnrichmentResult> {
  const result = { enriched: 0, skipped: 0 };

  for (let index = 0; index < entryIds.length; index += RAWG_ENRICHMENT_CONCURRENCY) {
    const batch = await Promise.all(
      entryIds.slice(index, index + RAWG_ENRICHMENT_CONCURRENCY).map(enrichWishlistEntry),
    );
    for (const entryResult of batch) {
      result.enriched += entryResult.enriched;
      result.skipped += entryResult.skipped;
    }
    if (index + RAWG_ENRICHMENT_CONCURRENCY < entryIds.length) {
      await waitForRateLimit();
    }
  }

  return result;
}
