"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { parseSteamAppIdInput } from "@/lib/steam-identity";
import { storeLinkFromSnapshotPayload, identityConflictMessage } from "@/lib/wishlist-identity-view";

type DbClient = typeof prisma | Prisma.TransactionClient;

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

async function findConflictingEntry(
  client: DbClient,
  appId: string,
  excludeEntryId?: string,
) {
  return client.wishlistEntry.findFirst({
    where: {
      steamAppId: appId,
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
    select: { id: true, name: true },
  });
}

async function writeConfirmedIdentity(
  client: DbClient,
  input: SteamImportIdentityInput,
  provenance: "STEAM_IMPORT" | "USER",
) {
  const conflict = await findConflictingEntry(client, input.steamAppId, input.wishlistEntryId);
  if (conflict) {
    throw new Error(identityConflictMessage(input.steamAppId, conflict.name));
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

    return { success: true as const, data: updated, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to save Steam identity",
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
      error: err instanceof Error ? err.message : "Failed to remove Steam identity",
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

    return { success: true as const, data: updated, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to confirm imported identity",
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

export async function confirmRawgSuggestedIdentity(input: unknown) {
  try {
    await requireUser();
    const parsed = entryRefSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: parsed.data.wishlistEntryId },
      select: { id: true, steamAppId: true, metadataSnapshot: { select: { payload: true } } },
    });
    if (!entry) {
      return { success: false as const, data: null, error: "Wishlist entry not found" };
    }
    if (entry.steamAppId) {
      return {
        success: false as const,
        data: null,
        error: "This entry already has a confirmed Steam identity",
      };
    }

    const suggestion = storeLinkFromSnapshotPayload(entry.metadataSnapshot?.payload);
    if (!suggestion) {
      return {
        success: false as const,
        data: null,
        error: "No RAWG store-link suggestion to confirm",
      };
    }

    const conflict = await findConflictingEntry(prisma, suggestion.steamAppId, entry.id);
    if (conflict) {
      return {
        success: false as const,
        data: null,
        error: identityConflictMessage(suggestion.steamAppId, conflict.name),
      };
    }

    const updated = await prisma.wishlistEntry.update({
      where: { id: entry.id },
      data: {
        steamAppId: suggestion.steamAppId,
        steamAppIdProvenance: "RAWG_SUGGESTION",
      },
    });

    return { success: true as const, data: updated, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        err instanceof Error ? err.message : "Failed to confirm the suggested identity",
    };
  }
}

export async function dismissRawgIdentitySuggestion(input: unknown) {
  try {
    await requireUser();
    const parsed = entryRefSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const entry = await prisma.wishlistEntry.findUnique({
      where: { id: parsed.data.wishlistEntryId },
      select: { id: true, metadataSnapshot: { select: { payload: true } } },
    });
    if (!entry) {
      return { success: false as const, data: null, error: "Wishlist entry not found" };
    }

    const snapshot = entry.metadataSnapshot;
    if (!snapshot || !storeLinkFromSnapshotPayload(snapshot.payload)) {
      return { success: true as const, data: null, error: null };
    }

    const currentPayload =
      typeof snapshot.payload === "object" && snapshot.payload !== null
        ? (snapshot.payload as Record<string, unknown>)
        : {};
    const payload = {
      ...currentPayload,
      storeLinkDismissedAt: new Date().toISOString(),
    };
    await prisma.wishlistMetadataSnapshot.updateMany({
      where: { wishlistEntryId: entry.id },
      data: { payload: payload as Prisma.InputJsonValue },
    });

    return { success: true as const, data: null, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to dismiss the suggestion",
    };
  }
}
