"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const reviewIdSchema = z.object({ reviewId: z.string().trim().min(1) }).strict();
const linkReviewSchema = reviewIdSchema.extend({ targetId: z.string().trim().min(1) }).strict();

const reviewCandidateSchema = z.object({
  gameId: z.string(),
  name: z.string(),
  type: z.enum(["BASE_GAME", "DLC"]),
});

type ReviewCandidate = z.infer<typeof reviewCandidateSchema>;

function parseCandidates(value: unknown): ReviewCandidate[] {
  const parsed = z.array(reviewCandidateSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function invalidInput() {
  return { success: false as const, data: null, error: "Invalid input" };
}

export async function getWishlistImportReviews() {
  try {
    await requireUser();
    const reviews = await prisma.wishlistImportReview.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
    });
    return { success: true as const, data: reviews, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to load wishlist import reviews",
    };
  }
}

export async function linkWishlistImportReview(input: unknown) {
  try {
    await requireUser();
    const parsed = linkReviewSchema.safeParse(input);
    if (!parsed.success) return invalidInput();

    return await prisma.$transaction(async (tx) => {
      const review = await tx.wishlistImportReview.findUnique({
        where: { id: parsed.data.reviewId },
      });
      if (!review) return { success: false as const, data: null, error: "Review not found" };
      if (review.status !== "OPEN") {
        return { success: true as const, data: review, error: null };
      }

      let candidate = parseCandidates(review.candidates).find(
        (item) => item.gameId === parsed.data.targetId,
      );
      if (!candidate) {
        const gameTarget = await tx.game.findUnique({
          where: { id: parsed.data.targetId },
          select: { id: true, name: true, type: true },
        });
        if (gameTarget) {
          candidate = { gameId: gameTarget.id, name: gameTarget.name, type: gameTarget.type };
        } else {
          const wishlistTarget = await tx.wishlistEntry.findFirst({
            where: { id: parsed.data.targetId },
            select: { id: true, name: true, type: true },
          });
          if (!wishlistTarget) {
            return { success: false as const, data: null, error: "Review candidate not found" };
          }
          candidate = { gameId: wishlistTarget.id, name: wishlistTarget.name, type: wishlistTarget.type };
        }
      }
      if (!candidate) {
        return { success: false as const, data: null, error: "Review candidate not found" };
      }

      const game = await tx.game.findUnique({
        where: { id: candidate.gameId },
        select: { id: true, type: true },
      });
      if (game) {
        await tx.externalGameId.upsert({
          where: { namespace_externalId: { namespace: "STEAM_APP", externalId: review.steamAppId } },
          create: {
            namespaceId: review.steamAppId,
            namespace: "STEAM_APP",
            externalId: review.steamAppId,
            matchMethod: "EXACT_STEAM_APP_ID",
            gameId: game.id,
          },
          update: {
            namespaceId: review.steamAppId,
            matchMethod: "EXACT_STEAM_APP_ID",
            gameId: game.id,
          },
        });
      } else {
        const entry = await tx.wishlistEntry.findUnique({
          where: { id: candidate.gameId },
          select: { id: true },
        });
        if (!entry) {
          return { success: false as const, data: null, error: "Review candidate not found" };
        }
        await tx.wishlistEntry.update({
          where: { id: entry.id },
          data: {
            steamAppId: review.steamAppId,
            steamAppIdProvenance: "STEAM_IMPORT",
          },
        });
      }

      const resolved = await tx.wishlistImportReview.update({
        where: { id: review.id },
        data: { status: "LINKED", reviewedAt: new Date() },
      });
      return { success: true as const, data: resolved, error: null };
    });
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to link wishlist import review",
    };
  }
}

export async function createWishlistImportReviewAsNew(input: unknown) {
  try {
    await requireUser();
    const parsed = reviewIdSchema.safeParse(input);
    if (!parsed.success) return invalidInput();

    return await prisma.$transaction(async (tx) => {
      const review = await tx.wishlistImportReview.findUnique({
        where: { id: parsed.data.reviewId },
      });
      if (!review) return { success: false as const, data: null, error: "Review not found" };
      const existing = await tx.wishlistEntry.findFirst({
        where: { steamAppId: review.steamAppId },
      });
      if (review.status !== "OPEN") {
        return { success: true as const, data: existing ?? review, error: null };
      }

      const entry = existing ?? await tx.wishlistEntry.create({
        data: {
          name: review.name,
          type: "BASE_GAME",
          interest: 2,
          notes: null,
          steamAppId: review.steamAppId,
          steamAppIdProvenance: "STEAM_IMPORT",
        },
      });
      await tx.wishlistImportReview.update({
        where: { id: review.id },
        data: { status: "LINKED", reviewedAt: new Date() },
      });
      return { success: true as const, data: entry, error: null };
    });
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to create wishlist entry from review",
    };
  }
}

export async function ignoreWishlistImportReview(input: unknown) {
  try {
    await requireUser();
    const parsed = reviewIdSchema.safeParse(input);
    if (!parsed.success) return invalidInput();

    return await prisma.$transaction(async (tx) => {
      const review = await tx.wishlistImportReview.findUnique({
        where: { id: parsed.data.reviewId },
      });
      if (!review) return { success: false as const, data: null, error: "Review not found" };
      if (review.status !== "OPEN") {
        return { success: true as const, data: review, error: null };
      }
      await tx.wishlistImportIgnore.upsert({
        where: { steamAppId: review.steamAppId },
        create: { steamAppId: review.steamAppId, name: review.name },
        update: { name: review.name },
      });
      const resolved = await tx.wishlistImportReview.update({
        where: { id: review.id },
        data: { status: "IGNORED", reviewedAt: new Date() },
      });
      return { success: true as const, data: resolved, error: null };
    });
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to ignore wishlist import review",
    };
  }
}
