"use server";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import { resolveManualSteamAppId } from "@/actions/wishlist-identity";

const wishlistTypeSchema = z.enum(["BASE_GAME", "DLC"]);
const interestSchema = z.number().int().min(1).max(5);

const createWishlistEntrySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    type: wishlistTypeSchema,
    baseGameId: z.string().trim().min(1).optional(),
    interest: interestSchema.optional(),
    notes: z.string().optional().nullable(),
    steamAppId: z.string().trim().min(1).optional().nullable(),
  })
  .strict();

const updateWishlistEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1, "Name is required").optional(),
    interest: interestSchema.optional().nullable(),
    notes: z.string().optional().nullable(),
    steamAppId: z.string().trim().min(1).optional().nullable(),
    baseGameId: z.string().trim().min(1).optional(),
  })
  .strict();

const deleteWishlistEntrySchema = z.object({ id: z.string().trim().min(1) }).strict();

const getWishlistEntriesSchema = z
  .object({
    type: z.enum(["ALL", "BASE_GAME", "DLC"]).optional(),
    interest: interestSchema.optional(),
  })
  .strict();

const acquireWishlistBaseGameSchema = z
  .object({
    wishlistEntryId: z.string().trim().min(1),
    source: z.enum(["STEAM", "OTHER_PLATFORM", "ROM"]),
    displayName: z.string().trim().max(200).optional(),
  })
  .strict();

const acquireWishlistDlcSchema = z
  .object({
    wishlistEntryId: z.string().trim().min(1),
    source: z.enum(["STEAM", "OTHER_PLATFORM", "ROM"]).default("OTHER_PLATFORM"),
    updateParentPlayState: z
      .enum(["NOT_STARTED", "IN_PROGRESS", "PLAN_TO_PLAY"])
      .optional(),
    setParentReplay: z.boolean().optional(),
  })
  .strict();

export type UpdateWishlistEntryInput = z.infer<typeof updateWishlistEntrySchema>;
export type GetWishlistEntriesInput = z.infer<typeof getWishlistEntriesSchema>;
export type AcquireWishlistBaseGameInput = z.infer<typeof acquireWishlistBaseGameSchema>;

const wishlistInclude = {
  metadataSnapshot: true,
  baseGame: { select: { id: true, name: true } },
} as const;

export async function createWishlistEntry(input: unknown) {
  try {
    await requireUser();
    const parsed = createWishlistEntrySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { name, type, baseGameId, interest, notes, steamAppId } = parsed.data;
    if (type === "BASE_GAME" && baseGameId !== undefined) {
      return {
        success: false as const,
        data: null,
        error: "Base games cannot have a parent",
      };
    }
    if (type === "DLC" && baseGameId === undefined) {
      return {
        success: false as const,
        data: null,
        error: "DLC wishlist entries require a base game",
      };
    }

    let identity: { appId: string; provenance: "USER" } | null = null;
    if (steamAppId) {
      const resolved = await resolveManualSteamAppId(steamAppId);
      if (!resolved.ok) {
        return { success: false as const, data: null, error: resolved.error };
      }
      identity = { appId: resolved.appId, provenance: "USER" };
    }

    const entry = await prisma.$transaction(async (tx) => {
      if (type === "DLC") {
        const parent = await tx.game.findUnique({
          where: { id: baseGameId },
          select: { id: true, type: true },
        });
        if (!parent) throw new Error("Base game not found");
        if (parent.type !== "BASE_GAME") {
          throw new Error("DLC parent must be a base game");
        }
      }

      return tx.wishlistEntry.create({
        data: {
          name,
          type,
          baseGameId: baseGameId ?? null,
          interest: interest ?? null,
          notes: notes ?? null,
          steamAppId: identity?.appId ?? null,
          steamAppIdProvenance: identity?.provenance ?? null,
        },
        include: wishlistInclude,
      });
    });

    return { success: true as const, data: entry, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to create wishlist entry",
    };
  }
}

export async function updateWishlistEntry(input: unknown) {
  try {
    await requireUser();
    const parsed = updateWishlistEntrySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { id, baseGameId, steamAppId, ...fields } = parsed.data;
    if (baseGameId !== undefined) {
      const entry = await prisma.wishlistEntry.findUnique({
        where: { id },
        select: { type: true },
      });
      if (!entry) {
        return { success: false as const, data: null, error: "Wishlist entry not found" };
      }
      if (entry.type !== "DLC") {
        return { success: false as const, data: null, error: "Only DLC wishes can change parent" };
      }
      const parent = await prisma.game.findUnique({
        where: { id: baseGameId },
        select: { type: true },
      });
      if (!parent) {
        return { success: false as const, data: null, error: "Base game not found" };
      }
      if (parent.type !== "BASE_GAME") {
        return { success: false as const, data: null, error: "DLC parent must be a base game" };
      }
    }
    let identityData: Record<string, string | null> = {};
    if (steamAppId !== undefined) {
      if (steamAppId === null) {
        identityData = { steamAppId: null, steamAppIdProvenance: null };
      } else {
        const resolved = await resolveManualSteamAppId(steamAppId, id);
        if (!resolved.ok) {
          return { success: false as const, data: null, error: resolved.error };
        }
        identityData = { steamAppId: resolved.appId, steamAppIdProvenance: "USER" };
      }
    }
    const entry = await prisma.wishlistEntry.update({
      where: { id },
      data: { ...fields, ...identityData, ...(baseGameId !== undefined && { baseGameId }) },
      include: wishlistInclude,
    });

    return { success: true as const, data: entry, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to update wishlist entry",
    };
  }
}

export async function deleteWishlistEntry(input: unknown) {
  try {
    await requireUser();
    const parsed = deleteWishlistEntrySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    await prisma.wishlistEntry.delete({ where: { id: parsed.data.id } });
    return { success: true as const, data: null, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to delete wishlist entry",
    };
  }
}

export async function getWishlistEntries(input: unknown = {}) {
  try {
    await requireUser();
    const parsed = getWishlistEntriesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const entries = await prisma.wishlistEntry.findMany({
      where: {
        ...(parsed.data.type && parsed.data.type !== "ALL" && { type: parsed.data.type }),
        ...(parsed.data.interest !== undefined && { interest: parsed.data.interest }),
      },
      orderBy: [{ interest: "desc" }, { updatedAt: "desc" }],
      include: wishlistInclude,
    });

    return { success: true as const, data: entries, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to load wishlist entries",
    };
  }
}

function rawgIdFromPayload(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null || !("rawgId" in payload)) {
    return null;
  }
  const rawgId = payload.rawgId;
  return typeof rawgId === "number" && Number.isInteger(rawgId) && rawgId > 0
    ? rawgId
    : null;
}

export async function acquireWishlistBaseGame(input: unknown) {
  try {
    await requireUser();
    const parsed = acquireWishlistBaseGameSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const game = await prisma.$transaction(async (tx) => {
      const wishlist = await tx.wishlistEntry.findUnique({
        where: { id: parsed.data.wishlistEntryId },
        include: { metadataSnapshot: true },
      });
      if (!wishlist) throw new Error("Wishlist entry not found");
      if (wishlist.type !== "BASE_GAME") {
        throw new Error("Only base-game wishes can be acquired as base games");
      }

      const rawgId = wishlist.metadataSnapshot
        ? rawgIdFromPayload(wishlist.metadataSnapshot.payload)
        : null;
      if (rawgId !== null) {
        const existingIdentity = await tx.externalGameId.findUnique({
          where: {
            namespace_externalId: {
              namespace: "RAWG_GAME",
              externalId: String(rawgId),
            },
          },
          select: { id: true },
        });
        if (existingIdentity) {
          throw new Error("RAWG game identity is already attached to another catalog game");
        }
      }

      const created = await tx.game.create({
        data: {
          type: "BASE_GAME",
          origin: "MANUAL",
          name: wishlist.name,
          availability: {
            create: {
              source: parsed.data.source,
              displayName: parsed.data.displayName ?? null,
              steamAppId: wishlist.steamAppId,
            },
          },
          libraryEntry: { create: { playState: "NOT_STARTED" } },
        },
        select: { id: true, name: true, type: true },
      });

      if (wishlist.metadataSnapshot) {
        await tx.metadataSnapshot.create({
          data: {
            gameId: created.id,
            provider: "RAWG",
            payload: wishlist.metadataSnapshot.payload as Prisma.InputJsonValue,
            sourceUrl: wishlist.metadataSnapshot.sourceUrl,
            fetchedAt: wishlist.metadataSnapshot.fetchedAt,
            expiresAt: wishlist.metadataSnapshot.expiresAt,
          },
        });
        if (rawgId !== null) {
          await tx.externalGameId.create({
            data: {
              namespaceId: String(rawgId),
              namespace: "RAWG_GAME",
              externalId: String(rawgId),
              matchMethod: "MANUAL_RAWG_SEARCH",
              gameId: created.id,
            },
          });
        }
      }

      await tx.wishlistEntry.delete({ where: { id: wishlist.id } });
      return created;
    });

    return { success: true as const, data: game, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to acquire wishlist base game",
    };
  }
}

export async function acquireWishlistDlc(input: unknown) {
  try {
    await requireUser();
    const parsed = acquireWishlistDlcSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const game = await prisma.$transaction(async (tx) => {
      const wishlist = await tx.wishlistEntry.findUnique({
        where: { id: parsed.data.wishlistEntryId },
        include: { baseGame: { select: { id: true, type: true } } },
      });
      if (!wishlist) throw new Error("Wishlist entry not found");
      if (wishlist.type !== "DLC") {
        throw new Error("Only DLC wishes can be acquired as DLC");
      }
      if (!wishlist.baseGame || wishlist.baseGame.type !== "BASE_GAME") {
        throw new Error("DLC parent must be a base game");
      }

      const created = await tx.game.create({
        data: {
          type: "DLC",
          origin: "MANUAL",
          name: wishlist.name,
          baseGameId: wishlist.baseGame.id,
          availability: {
            create: {
              source: parsed.data.source,
              steamAppId: wishlist.steamAppId,
            },
          },
          libraryEntry: { create: { playState: "NOT_STARTED" } },
        },
        select: { id: true, name: true, type: true, baseGameId: true },
      });

      const parentUpdate: {
        playState?: "NOT_STARTED" | "IN_PROGRESS";
        playSoon?: boolean;
        replayCandidate?: boolean;
      } = {};
      if (parsed.data.updateParentPlayState === "PLAN_TO_PLAY") {
        parentUpdate.playSoon = true;
      } else if (parsed.data.updateParentPlayState !== undefined) {
        parentUpdate.playState = parsed.data.updateParentPlayState;
      }
      Object.assign(parentUpdate, {
        ...(parsed.data.setParentReplay !== undefined && {
          replayCandidate: parsed.data.setParentReplay,
        }),
      });
      if (Object.keys(parentUpdate).length > 0) {
        await tx.libraryEntry.upsert({
          where: { gameId: wishlist.baseGame.id },
          create: { gameId: wishlist.baseGame.id, ...parentUpdate },
          update: parentUpdate,
        });
      }

      await tx.wishlistEntry.delete({ where: { id: wishlist.id } });
      return created;
    });

    return { success: true as const, data: game, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to acquire wishlist DLC",
    };
  }
}
