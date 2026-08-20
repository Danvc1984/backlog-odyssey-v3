"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { matchRawgGame, searchRawgCandidates } from "@/lib/rawg-api";
import { toRawgMetadataPayload } from "@/lib/rawg-enrichment";

const searchWishlistRawgSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    page: z.number().int().min(1).default(1),
  })
  .strict();

const enrichWishlistRawgSchema = z
  .object({
    wishlistEntryId: z.string().trim().min(1),
    rawgId: z.number().int().positive(),
  })
  .strict();

const removeWishlistMetadataSchema = z
  .object({ wishlistEntryId: z.string().trim().min(1) })
  .strict();

export type SearchWishlistRawgInput = z.infer<typeof searchWishlistRawgSchema>;
export type EnrichWishlistRawgInput = z.infer<typeof enrichWishlistRawgSchema>;

function providerErrorMessage(value: unknown, fallback: string): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }
  return fallback;
}

export async function searchWishlistRawg(input: unknown) {
  try {
    await requireUser();
    const parsed = searchWishlistRawgSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const candidates = await searchRawgCandidates(parsed.data.title, parsed.data.page);
    if (!Array.isArray(candidates)) {
      return {
        success: false as const,
        data: null,
        error: providerErrorMessage(candidates, "RAWG could not search matches"),
      };
    }

    return { success: true as const, data: candidates, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to search wishlist on RAWG",
    };
  }
}

export async function enrichWishlistEntryWithRawg(input: unknown) {
  try {
    await requireUser();
    const parsed = enrichWishlistRawgSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: parsed.data.wishlistEntryId },
      select: { id: true, name: true, type: true },
    });
    if (!entry) {
      return { success: false as const, data: null, error: "Wishlist entry not found" };
    }
    if (entry.type !== "BASE_GAME") {
      return {
        success: false as const,
        data: null,
        error: "RAWG metadata is only available for base-game wishes",
      };
    }

    const result = await matchRawgGame({
      title: entry.name,
      selectedRawgId: parsed.data.rawgId,
    });
    if (result.outcome !== "MATCHED") {
      return {
        success: false as const,
        data: null,
        error:
          result.outcome === "UNAVAILABLE"
            ? result.error.message
            : "RAWG did not return a usable match",
      };
    }

    const fetchedAt = new Date();
    const payload = toRawgMetadataPayload(result.game, fetchedAt);
    const snapshot = await prisma.wishlistMetadataSnapshot.upsert({
      where: { wishlistEntryId: entry.id },
      update: {
        provider: "RAWG",
        payload: payload as unknown as Prisma.InputJsonValue,
        sourceUrl: result.game.rawgUrl,
        fetchedAt,
        expiresAt: null,
      },
      create: {
        wishlistEntryId: entry.id,
        provider: "RAWG",
        payload: payload as unknown as Prisma.InputJsonValue,
        sourceUrl: result.game.rawgUrl,
        fetchedAt,
      },
    });

    return {
      success: true as const,
      data: { rawgId: result.game.id, snapshot },
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        err instanceof Error
          ? err.message
          : "Failed to enrich wishlist entry with RAWG",
    };
  }
}

export async function removeWishlistMetadata(input: unknown) {
  try {
    await requireUser();
    const parsed = removeWishlistMetadataSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: parsed.data.wishlistEntryId },
      select: { id: true },
    });
    if (!entry) {
      return { success: false as const, data: null, error: "Wishlist entry not found" };
    }

    await prisma.wishlistMetadataSnapshot.deleteMany({
      where: { wishlistEntryId: entry.id },
    });
    return { success: true as const, data: null, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to remove wishlist metadata",
    };
  }
}
