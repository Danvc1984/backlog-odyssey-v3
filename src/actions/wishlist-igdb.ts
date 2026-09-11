"use server";

import { z } from "zod";
import { friendlyActionError } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { searchIgdbCandidatePage } from "@/lib/igdb-api";
import { enrichWishlistBaseGameFromIgdb } from "@/lib/wishlist-igdb-enrichment";

const searchSchema = z.object({ title: z.string().trim().min(1).max(200), page: z.number().int().min(1).default(1) }).strict();
const entrySchema = z.object({ wishlistEntryId: z.string().trim().min(1) }).strict();
const replaceSchema = entrySchema.extend({ confirmOverwrite: z.boolean().default(false) }).strict();
const manualSchema = replaceSchema.extend({ igdbId: z.number().int().positive() }).strict();

export async function searchWishlistIgdb(input: unknown) {
  try {
    await requireUser();
    const parsed = searchSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const result = await searchIgdbCandidatePage(parsed.data.title, { offset: (parsed.data.page - 1) * 30 });
    if (!result.ok) return { success: false as const, data: null, error: result.error.message };
    return { success: true as const, data: result.data, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to search wishlist on IGDB") };
  }
}

export async function fillWishlistIgdbMetadata(input: unknown) {
  try {
    await requireUser();
    const parsed = entrySchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: parsed.data.wishlistEntryId },
      select: { id: true, name: true, type: true, steamAppId: true, steamAppIdProvenance: true, metadataSnapshot: { select: { id: true } } },
    });
    if (!entry) return { success: false as const, data: null, error: "Wishlist entry not found" };
    if (entry.type !== "BASE_GAME") return { success: false as const, data: null, error: "IGDB metadata is only available for base-game wishes" };
    if (entry.metadataSnapshot) return { success: false as const, data: null, error: "This wish already has IGDB metadata" };

    const result = await enrichWishlistBaseGameFromIgdb({ entry });
    if (!result.success) {
      if (result.error === "IGDB match outcome: AMBIGUOUS") return { ...result, error: "Several IGDB games share this title. Use Edit to search and choose a match." };
      if (result.error === "IGDB match outcome: NOT_FOUND") return { ...result, error: "No IGDB match was found for this title. Use Edit to search and choose a match." };
      return result;
    }
    return result;
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to load IGDB metadata for this wish") };
  }
}

async function replaceWishlistMetadata(input: unknown, selectedIgdbId: number | null) {
  const parsed = replaceSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
  const entry = await prisma.wishlistEntry.findUnique({
    where: { id: parsed.data.wishlistEntryId },
    select: { id: true, name: true, type: true, steamAppId: true, steamAppIdProvenance: true, metadataSnapshot: { select: { fetchedAt: true } } },
  });
  if (!entry) return { success: false as const, data: null, error: "Wishlist entry not found" };
  if (entry.type !== "BASE_GAME") return { success: false as const, data: null, error: "IGDB metadata is only available for base-game wishes" };
  if (entry.metadataSnapshot && !parsed.data.confirmOverwrite) {
    return {
      success: true as const,
      data: { kind: "OVERWRITE_REQUIRED" as const, existingFetchedAt: entry.metadataSnapshot.fetchedAt.toISOString() },
      error: null,
    };
  }
  const result = await enrichWishlistBaseGameFromIgdb({ entry, selectedIgdbId });
  return result;
}

export async function refreshWishlistIgdbMetadata(input: unknown) {
  try {
    await requireUser();
    return await replaceWishlistMetadata(input, null);
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to refresh IGDB metadata for this wish") };
  }
}

export async function enrichWishlistEntryWithIgdb(input: unknown) {
  try {
    await requireUser();
    const parsed = manualSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const { igdbId, ...replaceInput } = parsed.data;
    return await replaceWishlistMetadata(replaceInput, igdbId);
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to save IGDB metadata for this wish") };
  }
}

export async function removeWishlistMetadata(input: unknown) {
  try {
    await requireUser();
    const parsed = entrySchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const entry = await prisma.wishlistEntry.findUnique({ where: { id: parsed.data.wishlistEntryId }, select: { id: true } });
    if (!entry) return { success: false as const, data: null, error: "Wishlist entry not found" };
    await prisma.wishlistMetadataSnapshot.deleteMany({ where: { wishlistEntryId: entry.id } });
    return { success: true as const, data: null, error: null };
  } catch (error) {
    return { success: false as const, data: null, error: friendlyActionError(error, "Failed to remove wishlist metadata") };
  }
}
