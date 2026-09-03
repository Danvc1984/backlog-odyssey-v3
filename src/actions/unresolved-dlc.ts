"use server";

import { z } from "zod";
import { ActionError, friendlyActionError } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { silentlyRefreshWishlistCompatibility } from "@/lib/wishlist-compatibility-runner";

const unresolvedIdSchema = z.object({ unresolvedId: z.string().trim().min(1) }).strict();
const linkSchema = unresolvedIdSchema.extend({
  targetBaseGameId: z.string().trim().min(1),
});
const createBaseSchema = unresolvedIdSchema.extend({
  baseGameName: z.string().trim().min(1, "Base game name is required"),
});

export async function getUnresolvedSteamDlcs() {
  try {
    await requireUser();
    const items = await prisma.unresolvedSteamDlc.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return { success: true as const, data: items, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to load unresolved DLC"),
    };
  }
}

export async function linkUnresolvedDlc(input: unknown) {
  try {
    await requireUser();
    const parsed = linkSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    let compatEntryId: string | null = null;
    const result = await prisma.$transaction(async (tx) => {
      const unresolved = await tx.unresolvedSteamDlc.findUnique({
        where: { id: parsed.data.unresolvedId },
      });
      if (!unresolved) throw new ActionError("Unresolved DLC not found");

      const baseGame = await tx.game.findUnique({
        where: { id: parsed.data.targetBaseGameId },
        select: { id: true, type: true },
      });
      if (!baseGame) throw new ActionError("Base game not found");
      if (baseGame.type !== "BASE_GAME") {
        throw new ActionError("DLC parent must be a base game");
      }

      if (unresolved.source === "WISHLIST_IMPORT") {
        const wishlistEntry = await tx.wishlistEntry.create({
          data: {
            name: unresolved.name,
            type: "DLC",
            baseGameId: baseGame.id,
            interest: 2,
            notes: null,
            steamAppId: unresolved.steamAppId,
            steamAppIdProvenance: "STEAM_IMPORT",
          },
          select: { id: true, name: true, type: true, baseGameId: true },
        });
        if (wishlistEntry.type === "BASE_GAME" && wishlistEntry.id) {
          compatEntryId = wishlistEntry.id;
        }
        await tx.unresolvedSteamDlc.delete({ where: { id: unresolved.id } });
        return wishlistEntry;
      }

      const game = await tx.game.create({
        data: {
          type: "DLC",
          origin: "STEAM_IMPORT",
          name: unresolved.name,
          baseGameId: baseGame.id,
          externalIds: {
            create: {
              namespaceId: unresolved.steamAppId,
              namespace: "STEAM_APP",
              externalId: unresolved.steamAppId,
              matchMethod: "EXACT_STEAM_APP_ID",
            },
          },
          availability: {
            create: { source: "STEAM", steamAppId: unresolved.steamAppId },
          },
        },
        select: { id: true, name: true, type: true, baseGameId: true },
      });
      await tx.unresolvedSteamDlc.delete({ where: { id: unresolved.id } });
      return game;
    });
    if (compatEntryId) {
      await silentlyRefreshWishlistCompatibility(compatEntryId);
    }

    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to link unresolved DLC"),
    };
  }
}

export async function resolveUnresolvedDlcWithNewBase(input: unknown) {
  try {
    await requireUser();
    const parsed = createBaseSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const result = await prisma.$transaction(async (tx) => {
      const unresolved = await tx.unresolvedSteamDlc.findUnique({
        where: { id: parsed.data.unresolvedId },
      });
      if (!unresolved) throw new ActionError("Unresolved DLC not found");
      if (unresolved.source === "WISHLIST_IMPORT") {
        throw new ActionError("Wishlist DLC needs an existing catalog base game");
      }
      if (!unresolved.steamBaseAppId) {
        throw new ActionError("Steam base game identity is unavailable");
      }

      const baseGame = await tx.game.create({
        data: {
          type: "BASE_GAME",
          origin: "STEAM_IMPORT",
          name: parsed.data.baseGameName,
          libraryEntry: { create: {} },
          externalIds: {
            create: {
              namespaceId: unresolved.steamBaseAppId,
              namespace: "STEAM_APP",
              externalId: unresolved.steamBaseAppId,
              matchMethod: "EXACT_STEAM_APP_ID",
            },
          },
          availability: {
            create: { source: "STEAM", steamAppId: unresolved.steamBaseAppId },
          },
        },
        select: { id: true, name: true },
      });
      const dlc = await tx.game.create({
        data: {
          type: "DLC",
          origin: "STEAM_IMPORT",
          name: unresolved.name,
          baseGameId: baseGame.id,
          externalIds: {
            create: {
              namespaceId: unresolved.steamAppId,
              namespace: "STEAM_APP",
              externalId: unresolved.steamAppId,
              matchMethod: "EXACT_STEAM_APP_ID",
            },
          },
          availability: {
            create: { source: "STEAM", steamAppId: unresolved.steamAppId },
          },
        },
        select: { id: true, name: true, type: true, baseGameId: true },
      });
      await tx.unresolvedSteamDlc.delete({ where: { id: unresolved.id } });
      return { baseGame, dlc };
    });

    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error:
        err instanceof Error
          ? err.message
          : "Failed to resolve unresolved DLC",
    };
  }
}

async function updateUnresolvedStatus(input: unknown, status: "PENDING" | "DISCARDED") {
  const parsed = unresolvedIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, data: null, error: "Invalid input" };
  }
  const item = await prisma.unresolvedSteamDlc.findUnique({
    where: { id: parsed.data.unresolvedId },
    select: { id: true },
  });
  if (!item) throw new ActionError("Unresolved DLC not found");
  const updated = await prisma.unresolvedSteamDlc.update({
    where: { id: item.id },
    data: { status, discardedAt: status === "DISCARDED" ? new Date() : null },
  });
  return { success: true as const, data: updated, error: null };
}

export async function discardUnresolvedDlc(input: unknown) {
  try {
    await requireUser();
    return await updateUnresolvedStatus(input, "DISCARDED");
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to discard unresolved DLC"),
    };
  }
}

export async function restoreUnresolvedDlc(input: unknown) {
  try {
    await requireUser();
    return await updateUnresolvedStatus(input, "PENDING");
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to restore unresolved DLC"),
    };
  }
}
