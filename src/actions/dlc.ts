"use server";

import { z } from "zod";
import { ActionError, friendlyActionError } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { fetchSteamDlcList } from "@/lib/steam-dlc-list";
import { queueIgdbForDlcGames } from "@/lib/igdb-import-queue";
import { matchIgdbGame } from "@/lib/igdb-api";
import { persistIgdbIdentity, persistIgdbSnapshot } from "@/lib/igdb-enrichment";

const createDlcSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    baseGameId: z.string().trim().min(1, "Base game is required"),
  })
  .strict();

const baseGameIdSchema = z.object({ baseGameId: z.string().trim().min(1) }).strict();
const acquireFetchedDlcsSchema = z
  .object({
    baseGameId: z.string().trim().min(1),
    items: z
      .array(
        z
          .object({ steamAppId: z.string().regex(/^\d{1,10}$/), name: z.string().trim().min(1).max(200) })
          .strict(),
      )
      .max(500),
  })
  .strict();

export type CreateDlcInput = z.infer<typeof createDlcSchema>;

async function findBaseGameSteamAppId(baseGameId: string) {
  return prisma.game.findFirst({
    where: {
      id: baseGameId,
      type: "BASE_GAME",
      OR: [
        { externalIds: { some: { namespace: "STEAM_APP" } } },
        { availability: { some: { source: "STEAM", steamAppId: { not: null } } } },
      ],
    },
    select: {
      id: true,
      externalIds: { where: { namespace: "STEAM_APP" }, select: { externalId: true } },
      availability: {
        where: { source: "STEAM", steamAppId: { not: null } },
        select: { steamAppId: true },
      },
    },
  });
}

export async function fetchDlcCandidates(input: unknown) {
  try {
    await requireUser();
    const parsed = baseGameIdSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };

    const baseGame = await findBaseGameSteamAppId(parsed.data.baseGameId);
    if (!baseGame) {
      return { success: false as const, data: null, error: "Base game needs a Steam App ID" };
    }
    const steamAppId = baseGame.externalIds[0]?.externalId ?? baseGame.availability[0]?.steamAppId;
    if (!steamAppId) {
      return { success: false as const, data: null, error: "Base game needs a Steam App ID" };
    }

    const list = await fetchSteamDlcList(steamAppId);
    if (list.status === "EMPTY") return { success: true as const, data: [], error: null };
    const ids = list.candidates.map((candidate) => candidate.steamAppId);
    const [catalogRows, availabilityRows, wishlistRows] = await Promise.all([
      prisma.externalGameId.findMany({
        where: { namespace: "STEAM_APP", externalId: { in: ids } },
        select: { externalId: true, game: { select: { id: true, type: true, baseGameId: true } } },
      }),
      prisma.gameAvailability.findMany({
        where: { source: "STEAM", steamAppId: { in: ids } },
        select: { steamAppId: true, game: { select: { id: true, type: true, baseGameId: true } } },
      }),
      prisma.wishlistEntry.findMany({
        where: { type: "DLC", steamAppId: { in: ids } },
        select: { steamAppId: true },
      }),
    ]);
    const ownedIds = new Set([
      ...catalogRows.filter((row) => row.game.type === "DLC" && row.game.baseGameId === parsed.data.baseGameId).map((row) => row.externalId),
      ...availabilityRows.filter((row) => row.game.type === "DLC" && row.game.baseGameId === parsed.data.baseGameId && row.steamAppId).map((row) => row.steamAppId as string),
    ]);
    const wishlistIds = new Set(wishlistRows.flatMap((row) => row.steamAppId ? [row.steamAppId] : []));
    return {
      success: true as const,
      data: list.candidates.map((candidate) => ({
        ...candidate,
        owned: ownedIds.has(candidate.steamAppId),
        wishlisted: wishlistIds.has(candidate.steamAppId),
      })),
      error: null,
    };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to fetch DLC list") };
  }
}

export async function acquireFetchedDlcs(input: unknown) {
  try {
    await requireUser();
    const parsed = acquireFetchedDlcsSchema.safeParse(input);
    if (!parsed.success) return { success: false as const, data: null, error: "Invalid input" };
    const baseGame = await findBaseGameSteamAppId(parsed.data.baseGameId);
    if (!baseGame) return { success: false as const, data: null, error: "Base game needs a Steam App ID" };
    const baseSteamAppId = baseGame.externalIds[0]?.externalId ?? baseGame.availability[0]?.steamAppId;
    if (!baseSteamAppId) return { success: false as const, data: null, error: "Base game needs a Steam App ID" };

    const fetched = await fetchSteamDlcList(baseSteamAppId);
    const fetchedById = new Map(fetched.status === "OK" ? fetched.candidates.map((item) => [item.steamAppId, item]) : []);
    const selected = parsed.data.items
      .map((item) => fetchedById.get(item.steamAppId))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
    const selectedIds = [...new Set(selected.map((item) => item.steamAppId))];
    if (selectedIds.length === 0) return { success: true as const, data: { created: [], skipped: parsed.data.items.length, queue: null }, error: null };

    const createdItems: Array<{ id: string; candidate: (typeof selected)[number] }> = [];
    let skipped = parsed.data.items.length - selectedIds.length;
    await prisma.$transaction(async (tx) => {
      const [catalogRows, availabilityRows, wishlistRows] = await Promise.all([
        tx.externalGameId.findMany({
          where: { namespace: "STEAM_APP", externalId: { in: selectedIds } },
          select: { externalId: true, game: { select: { id: true, type: true, baseGameId: true } } },
        }),
        tx.gameAvailability.findMany({
          where: { source: "STEAM", steamAppId: { in: selectedIds } },
          select: { steamAppId: true, game: { select: { id: true, type: true, baseGameId: true } } },
        }),
        tx.wishlistEntry.findMany({ where: { type: "DLC", steamAppId: { in: selectedIds } }, select: { steamAppId: true } }),
      ]);
      const existingIds = new Set([
        ...catalogRows.map((row) => row.externalId),
        ...availabilityRows.flatMap((row) => row.steamAppId ? [row.steamAppId] : []),
        ...wishlistRows.flatMap((row) => row.steamAppId ? [row.steamAppId] : []),
      ]);
      for (const item of selected) {
        if (existingIds.has(item.steamAppId)) {
          skipped += 1;
          continue;
        }
        const created = await tx.game.create({
          data: {
            type: "DLC",
            origin: "STEAM_IMPORT",
            name: item.name,
            baseGameId: parsed.data.baseGameId,
            externalIds: {
              create: {
                namespaceId: item.steamAppId,
                namespace: "STEAM_APP",
                externalId: item.steamAppId,
                matchMethod: "EXACT_STEAM_APP_ID",
              },
            },
            availability: { create: { source: "STEAM", steamAppId: item.steamAppId } },
          },
          select: { id: true },
        });
        createdItems.push({ id: created.id, candidate: item });
        existingIds.add(item.steamAppId);
      }
    });
    const pendingIds: string[] = [];
    let enriched = 0;
    for (const created of createdItems) {
      if (created.candidate.igdbId === null) {
        pendingIds.push(created.id);
        continue;
      }
      try {
        const match = await matchIgdbGame({
          title: created.candidate.name,
          category: "DLC",
          steamAppId: created.candidate.steamAppId,
        });
        if (match.outcome === "MATCHED" && !match.classMismatch) {
          const identity = await persistIgdbIdentity(created.id, {
            ...match,
            matchMethod: "EXACT_STEAM_APP_ID",
          });
          const snapshot = identity.success
            ? await persistIgdbSnapshot(created.id, match.game, new Date())
            : null;
          if (identity.success && snapshot?.success) {
            enriched += 1;
            continue;
          }
        }
      } catch {
        // Failed immediate enrichment falls back to the persistent queue.
      }
      pendingIds.push(created.id);
    }
    const queue = pendingIds.length > 0 ? await queueIgdbForDlcGames(pendingIds) : null;
    return {
      success: true as const,
      data: { created: createdItems.map((item) => item.id), enriched, skipped, queue },
      error: null,
    };
  } catch (err) {
    return { success: false as const, data: null, error: friendlyActionError(err, "Failed to acquire DLC") };
  }
}

export async function createDlc(input: CreateDlcInput) {
  try {
    await requireUser();
    const parsed = createDlcSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, data: null, error: "Invalid input" };
    }

    const { name, baseGameId } = parsed.data;
    const game = await prisma.$transaction(async (tx) => {
      const baseGame = await tx.game.findUnique({
        where: { id: baseGameId },
        select: { type: true },
      });

      if (!baseGame) {
        throw new ActionError("Base game not found");
      }
      if (baseGame.type !== "BASE_GAME") {
        throw new ActionError("DLC parent must be a base game");
      }

      return tx.game.create({
        data: {
          type: "DLC",
          origin: "MANUAL",
          name,
          baseGame: { connect: { id: baseGameId } },
        },
        include: { baseGame: true },
      });
    });

    return { success: true as const, data: game, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: friendlyActionError(err, "Failed to create DLC"),
    };
  }
}
