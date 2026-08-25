"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth-guard";
import {
  runWishlistCompatibilityRefresh,
  type WishlistCompatibilityRefreshResult,
} from "@/lib/wishlist-compatibility-runner";

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
      error: error instanceof Error ? error.message : "Failed to refresh wishlist compatibility",
    };
  }
}
