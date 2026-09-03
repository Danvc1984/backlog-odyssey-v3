"use server";

import { z } from "zod";
import { friendlyActionError } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { runWishlistCompatSweep } from "@/lib/wishlist-compat-sweep";
import {
  runWishlistCompatibilityRefresh,
  type WishlistCompatibilityRefreshResult,
} from "@/lib/wishlist-compatibility-runner";

export interface WishlistCompatSweepRunView {
  id: string;
  status: string;
  counts: unknown;
  requestedAt: Date;
  finishedAt: Date | null;
}

const refreshSchema = z
  .object({ wishlistEntryId: z.string().trim().min(1) })
  .strict();

export async function refreshWishlistCompatibility(
  input: unknown,
): Promise<WishlistCompatibilityRefreshResult> {
  try {
    await requireUser();
    const parsed = refreshSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, data: null, error: "Invalid input" };
    }

    return await runWishlistCompatibilityRefresh(parsed.data.wishlistEntryId);
  } catch (error) {
    return {
      success: false,
      data: null,
      error: friendlyActionError(error, "Failed to refresh wishlist compatibility"),
    };
  }
}

export async function startWishlistCompatibilitySweep() {
  try {
    await requireUser();

    const result = await runWishlistCompatSweep();
    if (!result.ok) {
      return {
        success: false as const,
        data: { runId: result.runId, reason: result.reason },
        error: "A compatibility sweep is already running",
      };
    }

    const run = await prisma.wishlistCompatSweep.findUnique({
      where: { id: result.runId },
    });
    return { success: true as const, data: run ?? null, error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(error, "Failed to run compatibility sweep"),
    };
  }
}

export async function getLatestWishlistCompatSweep() {
  try {
    await requireUser();

    const run = await prisma.wishlistCompatSweep.findFirst({
      orderBy: { requestedAt: "desc" },
    });
    return { success: true as const, data: run ?? null, error: null };
  } catch (error) {
    return {
      success: false as const,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load wishlist compatibility sweep status",
    };
  }
}
