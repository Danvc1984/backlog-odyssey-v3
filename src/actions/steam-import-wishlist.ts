"use server";

import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth-guard";
import { normalizeName } from "@/lib/duplicate-utils";
import { prisma } from "@/lib/prisma";
import { fetchSteamWishlist, type SteamWishlistGame } from "@/lib/steam-api";
import {
  requireSteamFlowContext,
  upsertUnresolvedSteamDlc,
} from "@/lib/steam-flow";
import { autoEnrichWishlistEntries } from "@/lib/wishlist-rawg-queue";

const IMPORT_CHUNK_SIZE = 50;

interface Candidate {
  gameId: string;
  name: string;
  type: "BASE_GAME" | "DLC";
}

interface CatalogIdentity {
  gameId: string;
  name: string;
  type: "BASE_GAME" | "DLC";
}

interface WishlistIdentity {
  id: string;
  name: string;
  type: "BASE_GAME" | "DLC";
  steamAppId: string | null;
  steamAppIdProvenance: string | null;
  metadataSnapshot: { id: string } | null;
}

type ImportTxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function candidateJson(candidates: Candidate[]): Prisma.InputJsonValue {
  return candidates as unknown as Prisma.InputJsonValue;
}

function matches(name: string, candidateName: string): boolean {
  return normalizeName(name) === normalizeName(candidateName);
}

async function loadCatalogIdentities(
  appIds: string[],
): Promise<Map<string, CatalogIdentity>> {
  const identities = new Map<string, CatalogIdentity>();
  const [externalIds, availability] = await Promise.all([
    prisma.externalGameId.findMany({
      where: { namespace: "STEAM_APP", externalId: { in: appIds } },
      select: { externalId: true, game: { select: { id: true, name: true, type: true } } },
    }),
    prisma.gameAvailability.findMany({
      where: { source: "STEAM", steamAppId: { in: appIds } },
      select: { steamAppId: true, game: { select: { id: true, name: true, type: true } } },
    }),
  ]);

  for (const row of externalIds) {
    identities.set(row.externalId, { gameId: row.game.id, name: row.game.name, type: row.game.type });
  }
  for (const row of availability) {
    if (row.steamAppId) {
      identities.set(row.steamAppId, { gameId: row.game.id, name: row.game.name, type: row.game.type });
    }
  }
  return identities;
}

async function importWishlistChunk(
  tx: ImportTxClient,
  games: SteamWishlistGame[],
  catalogIdentities: Map<string, CatalogIdentity>,
  wishlistIdentities: Map<string, WishlistIdentity>,
  ignoredIds: Set<string>,
  catalogCandidates: Candidate[],
  wishlistCandidates: Candidate[],
  counters: { created: number; queuedReviews: number; ignored: number },
  enrichmentEntryIds: Set<string>,
): Promise<void> {
  for (const game of games) {
    const steamAppId = String(game.appid);
    const existingWishlistEntry = wishlistIdentities.get(steamAppId);
    if (catalogIdentities.has(steamAppId)) {
      continue;
    }
    if (existingWishlistEntry) {
      if (game.type === "DLC") {
        const base = game.steamBaseAppId
          ? catalogIdentities.get(game.steamBaseAppId)
          : undefined;
        if (!base || base.type !== "BASE_GAME") {
          await upsertUnresolvedSteamDlc(tx, steamAppId, game, "WISHLIST_IMPORT");
          continue;
        }
        if (
          existingWishlistEntry.type === "BASE_GAME" &&
          existingWishlistEntry.steamAppIdProvenance === "STEAM_IMPORT"
        ) {
          const repaired = await tx.wishlistEntry.update({
            where: { id: existingWishlistEntry.id },
            data: { type: "DLC", baseGameId: base.gameId },
            select: {
              id: true,
              name: true,
              type: true,
              steamAppId: true,
              steamAppIdProvenance: true,
              metadataSnapshot: { select: { id: true } },
            },
          });
          wishlistIdentities.set(steamAppId, repaired);
        }
        continue;
      }
      if (
        existingWishlistEntry.type === "BASE_GAME" &&
        existingWishlistEntry.steamAppIdProvenance === "STEAM_IMPORT" &&
        !existingWishlistEntry.metadataSnapshot
      ) {
        enrichmentEntryIds.add(existingWishlistEntry.id);
      }
      continue;
    }
    if (ignoredIds.has(steamAppId)) {
      counters.ignored += 1;
      continue;
    }

    if (game.type === "DLC") {
      const base = game.steamBaseAppId
        ? catalogIdentities.get(game.steamBaseAppId)
        : undefined;
      if (!base || base.type !== "BASE_GAME") {
        await upsertUnresolvedSteamDlc(tx, steamAppId, game, "WISHLIST_IMPORT");
        continue;
      }

      const entry = await tx.wishlistEntry.create({
        data: {
          name: game.name,
          type: "DLC",
          baseGameId: base.gameId,
          interest: 2,
          notes: null,
          steamAppId,
          steamAppIdProvenance: "STEAM_IMPORT",
        },
        select: {
          id: true,
          name: true,
          type: true,
          steamAppId: true,
          steamAppIdProvenance: true,
          metadataSnapshot: { select: { id: true } },
        },
      });
      wishlistIdentities.set(steamAppId, entry);
      counters.created += 1;
      continue;
    }

    const candidates = [
      ...catalogCandidates.filter((candidate) => matches(game.name, candidate.name)),
      ...wishlistCandidates.filter((candidate) => matches(game.name, candidate.name)),
    ];
    if (candidates.length > 0) {
      await tx.wishlistImportReview.upsert({
        where: { steamAppId },
        create: {
          steamAppId,
          name: game.name,
          candidates: candidateJson(candidates),
        },
        update: {
          name: game.name,
          candidates: candidateJson(candidates),
          status: "OPEN",
          reviewedAt: null,
        },
      });
      counters.queuedReviews += 1;
      continue;
    }

    const entry = await tx.wishlistEntry.create({
      data: {
        name: game.name,
        type: "BASE_GAME",
        interest: 2,
        notes: null,
        steamAppId,
        steamAppIdProvenance: "STEAM_IMPORT",
      },
      select: {
        id: true,
        name: true,
        type: true,
        steamAppId: true,
        steamAppIdProvenance: true,
        metadataSnapshot: { select: { id: true } },
      },
    });
    wishlistIdentities.set(steamAppId, entry);
    counters.created += 1;
    enrichmentEntryIds.add(entry.id);
  }
}

async function saveWishlistImportSummary(result: WishlistImportResult): Promise<void> {
  const connection = await prisma.steamConnection.findUnique({
    where: { id: 1 },
    select: { counts: true },
  });
  const currentCounts =
    connection?.counts && typeof connection.counts === "object" && !Array.isArray(connection.counts)
      ? connection.counts as Record<string, unknown>
      : {};
  await prisma.steamConnection.update({
    where: { id: 1 },
    data: {
      counts: {
        ...currentCounts,
        lastWishlistImport: {
          at: new Date().toISOString(),
          created: result.created,
          queuedReviews: result.queuedReviews,
          ignored: result.ignored,
          enriched: result.enrichment.enriched,
          skipped: result.enrichment.skipped,
        },
      },
    },
  });
}

export interface WishlistImportResult {
  created: number;
  queuedReviews: number;
  ignored: number;
  enrichment: { enriched: number; skipped: number };
  enrichmentEntryIds: string[];
}

export async function importSteamWishlist(): Promise<
  | { success: true; data: WishlistImportResult; error: null }
  | { success: false; data: null; error: string }
> {
  try {
    await requireUser();
    const context = await requireSteamFlowContext();
    if (!context.ok) {
      return { success: false, data: null, error: context.error };
    }

    const wishlist = await fetchSteamWishlist(context.steamId64, context.apiKey);
    if (wishlist.status === "UNAVAILABLE") {
      return {
        success: false,
        data: null,
        error: "Steam wishlist could not be read right now. Try again later.",
      };
    }
    if (wishlist.status === "EMPTY") {
      return {
        success: false,
        data: null,
        error: "Steam wishlist appears empty or private",
      };
    }
    const games = wishlist.games;

    const appIds = [...new Set(games.flatMap((game) => [
      String(game.appid),
      ...(game.steamBaseAppId ? [game.steamBaseAppId] : []),
    ]))];
    const [catalogIdentities, wishlistEntries, ignored] = await Promise.all([
      loadCatalogIdentities(appIds),
      prisma.wishlistEntry.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          steamAppId: true,
          steamAppIdProvenance: true,
          metadataSnapshot: { select: { id: true } },
        },
      }),
      prisma.wishlistImportIgnore.findMany({
        where: { steamAppId: { in: appIds } },
        select: { steamAppId: true },
      }),
    ]);

    const wishlistIdentities = new Map(
      wishlistEntries.flatMap((entry) =>
        entry.steamAppId ? [[entry.steamAppId, entry] as const] : [],
      ),
    );
    const catalogGames = await prisma.game.findMany({
      where: { type: "BASE_GAME" },
      select: { id: true, name: true, type: true },
    });
    const catalogCandidates = catalogGames.map((game) => ({
      gameId: game.id,
      name: game.name,
      type: game.type,
    }));
    const wishlistCandidates = wishlistEntries.map((entry) => ({
      gameId: entry.id,
      name: entry.name,
      type: entry.type,
    }));
    const counters = { created: 0, queuedReviews: 0, ignored: 0 };
    const enrichmentEntryIds = new Set<string>();
    const ignoredIds = new Set(ignored.map((row) => row.steamAppId));
    const orderedGames = [...games].sort(
      (left, right) => Number(left.type === "DLC") - Number(right.type === "DLC"),
    );

    for (let index = 0; index < orderedGames.length; index += IMPORT_CHUNK_SIZE) {
      await prisma.$transaction((tx) =>
        importWishlistChunk(
          tx,
          orderedGames.slice(index, index + IMPORT_CHUNK_SIZE),
          catalogIdentities,
          wishlistIdentities,
          ignoredIds,
          catalogCandidates,
          wishlistCandidates,
          counters,
          enrichmentEntryIds,
        ),
      );
    }

    const result: WishlistImportResult = {
      created: counters.created,
      queuedReviews: counters.queuedReviews,
      ignored: counters.ignored,
      enrichment: { enriched: 0, skipped: 0 },
      enrichmentEntryIds: [...enrichmentEntryIds],
    };
    await saveWishlistImportSummary(result);

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : "Failed to import Steam wishlist",
    };
  }
}

export async function enrichImportedWishlist(
  entryIds: readonly string[],
): Promise<{ success: true; data: { enriched: number; skipped: number }; error: null } | { success: false; data: null; error: string }> {
  try {
    await requireUser();
    const uniqueEntryIds = [...new Set(entryIds)].filter(Boolean).slice(0, 500);
    const enrichment = await autoEnrichWishlistEntries(uniqueEntryIds);
    const connection = await prisma.steamConnection.findUnique({
      where: { id: 1 },
      select: { counts: true },
    });
    const currentCounts =
      connection?.counts && typeof connection.counts === "object" && !Array.isArray(connection.counts)
        ? connection.counts as Record<string, unknown>
        : {};
    const lastImport =
      currentCounts.lastWishlistImport && typeof currentCounts.lastWishlistImport === "object"
        ? currentCounts.lastWishlistImport as Record<string, unknown>
        : {};
    await prisma.steamConnection.update({
      where: { id: 1 },
      data: {
        counts: {
          ...currentCounts,
          lastWishlistImport: {
            ...lastImport,
            enriched:
              (typeof lastImport.enriched === "number" ? lastImport.enriched : 0) + enrichment.enriched,
            skipped:
              (typeof lastImport.skipped === "number" ? lastImport.skipped : 0) + enrichment.skipped,
          },
        },
      },
    });
    return { success: true, data: enrichment, error: null };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : "Failed to enrich imported wishlist",
    };
  }
}
