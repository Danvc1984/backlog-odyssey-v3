"use server";

import { z } from "zod";
import { ActionError, friendlyActionError } from "@/lib/action-error";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { parseSteamAppIdInput } from "@/lib/steam-identity";
import { silentlyRefreshWishlistCompatibility } from "@/lib/wishlist-compatibility-runner";
import { findConflictingEntry, identityConflictMessage } from "@/lib/wishlist-identity";

type DbClient = typeof prisma | Prisma.TransactionClient;

async function triggerCompatibilityIfEligible(entry: {
  id: string;
  type: string;
}): Promise<void> {
  if (entry.type === "BASE_GAME") {
    await silentlyRefreshWishlistCompatibility(entry.id);
  }
}

const setWishlistIdentitySchema = z
  .object({
    wishlistEntryId: z.string().trim().min(1),
    identityInput: z.string().min(1).max(500),
  })
  .strict();

const entryRefSchema = z
  .object({ wishlistEntryId: z.string().trim().min(1) })
  .strict();

const steamImportIdentitySchema = z
  .object({
    wishlistEntryId: z.string().trim().min(1),
    steamAppId: z.string().trim().regex(/^\d{1,10}$/),
  })
  .strict();

export type SetWishlistIdentityInput = z.infer<typeof setWishlistIdentitySchema>;
export type SteamImportIdentityInput = z.infer<typeof steamImportIdentitySchema>;

async function writeConfirmedIdentity(
  client: DbClient,
  input: SteamImportIdentityInput,
  provenance: "STEAM_IMPORT" | "USER",
) {
  const conflict = await findConflictingEntry(client, input.steamAppId, input.wishlistEntryId);
  if (conflict) {
    throw new ActionError(identityConflictMessage(input.steamAppId, conflict.name));
  }
  return client.wishlistEntry.update({
    where: { id: input.wishlistEntryId },
    data: {
      steamAppId: input.steamAppId,
      steamAppIdProvenance: provenance,
    },
  });
}

export async function setWishlistIdentity(input: unknown) {
  try {
    await requireUser();
    const parsed = setWishlistIdentitySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const parsedId = parseSteamAppIdInput(parsed.data.identityInput);
    if (!parsedId.ok) {
      return { success: false as const, data: null, error: parsedId.reason };
    }

    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: parsed.data.wishlistEntryId },
      select: { id: true },
    });
    if (!entry) {
      return { success: false as const, data: null, error: "Wishlist entry not found" };
    }

    const updated = await prisma.$transaction(async (tx) =>
      writeConfirmedIdentity(tx, {
        wishlistEntryId: parsed.data.wishlistEntryId,
        steamAppId: parsedId.appId,
      }, "USER"),
    );
    await triggerCompatibilityIfEligible(updated);

    return { success: true as const, data: updated, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to save Steam identity"),
    };
  }
}

export async function removeWishlistIdentity(input: unknown) {
  try {
    await requireUser();
    const parsed = entryRefSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const updated = await prisma.wishlistEntry.update({
      where: { id: parsed.data.wishlistEntryId },
      data: { steamAppId: null, steamAppIdProvenance: null },
    });

    return { success: true as const, data: updated, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to remove Steam identity"),
    };
  }
}

export async function confirmSteamImportIdentity(input: unknown) {
  try {
    await requireUser();
    const parsed = steamImportIdentitySchema.safeParse(input);
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

    const updated = await prisma.$transaction(async (tx) =>
      writeConfirmedIdentity(tx, parsed.data, "STEAM_IMPORT"),
    );
    await triggerCompatibilityIfEligible(updated);

    return { success: true as const, data: updated, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to confirm imported identity"),
    };
  }
}

export async function resolveManualSteamAppId(
  raw: string,
  excludeEntryId?: string,
): Promise<{ ok: true; appId: string } | { ok: false; error: string }> {
  await requireUser();
  const parsedId = parseSteamAppIdInput(raw);
  if (!parsedId.ok) {
    return { ok: false, error: parsedId.reason };
  }
  const conflict = await findConflictingEntry(prisma, parsedId.appId, excludeEntryId);
  if (conflict) {
    return {
      ok: false,
      error: identityConflictMessage(parsedId.appId, conflict.name),
    };
  }
  return { ok: true, appId: parsedId.appId };
}
