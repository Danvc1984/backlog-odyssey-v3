"use server";

import { fetchOwnedGames, type OwnedGame } from "@/lib/steam-api";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { lastPlayedDate } from "@/lib/steam-utils";
import {
  reconcileWishlistImportDlcs,
  upsertUnresolvedSteamDlc,
  requireSteamFlowContext,
} from "@/lib/steam-flow";
import { queueRawgForImportedGames } from "@/lib/rawg-import-queue";

type ImportGameResult =
  | { kind: "imported"; gameId: string }
  | { kind: "updated" };

type ImportTxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const IMPORT_CHUNK_SIZE = 50;

interface KnownIdentity {
  gameId: string;
  type: "BASE_GAME" | "DLC";
}

async function importGame(
  tx: ImportTxClient,
  identities: Map<string, KnownIdentity>,
  game: OwnedGame,
): Promise<ImportGameResult> {
  const externalId = String(game.appid);
  const availability = {
    source: "STEAM" as const,
    steamAppId: externalId,
    steamPlaytimeTotal: BigInt(game.playtimeForever),
    steamLastPlayed: lastPlayedDate(game.rtimeLastPlayed),
  };

  const known = identities.get(externalId);
  if (known) {
    await tx.gameAvailability.updateMany({
      where: { gameId: known.gameId, source: "STEAM" },
      data: availability,
    });
    if (game.type !== "DLC") {
      await tx.libraryEntry.upsert({
        where: { gameId: known.gameId },
        create: { gameId: known.gameId },
        update: {},
      });
      if (known.type === "BASE_GAME") {
        await reconcileWishlistImportDlcs(tx, externalId, known.gameId);
      }
    }
    return { kind: "updated" };
  }

  if (game.type === "DLC") {
    const baseIdentity = game.steamBaseAppId
      ? identities.get(game.steamBaseAppId)
      : undefined;

    if (!baseIdentity || baseIdentity.type !== "BASE_GAME") {
      await upsertUnresolvedSteamDlc(tx, externalId, game);
      return { kind: "updated" };
    }

    const createdDlc = await tx.game.create({
      data: {
        type: "DLC",
        origin: "STEAM_IMPORT",
        name: game.name,
        baseGameId: baseIdentity.gameId,
        externalIds: {
          create: {
            namespaceId: externalId,
            namespace: "STEAM_APP",
            externalId,
            matchMethod: "EXACT_STEAM_APP_ID",
          },
        },
        availability: { create: availability },
      },
      select: { id: true },
    });
    identities.set(externalId, { gameId: createdDlc.id, type: "DLC" });
    return { kind: "imported", gameId: createdDlc.id };
  }

  const createdGame = await tx.game.create({
    data: {
      type: "BASE_GAME",
      origin: "STEAM_IMPORT",
      name: game.name,
      libraryEntry: { create: {} },
      externalIds: {
        create: {
          namespaceId: externalId,
          namespace: "STEAM_APP",
          externalId,
          matchMethod: "EXACT_STEAM_APP_ID",
        },
      },
      availability: { create: availability },
    },
    select: { id: true },
  });
  identities.set(externalId, { gameId: createdGame.id, type: "BASE_GAME" });
  await reconcileWishlistImportDlcs(tx, externalId, createdGame.id);
  return { kind: "imported", gameId: createdGame.id };
}

async function loadKnownIdentities(
  games: OwnedGame[],
): Promise<Map<string, KnownIdentity>> {
  const identities = new Map<string, KnownIdentity>();
  const appIds = [
    ...games.map((game) => String(game.appid)),
    ...games.flatMap((game) => (game.steamBaseAppId ? [game.steamBaseAppId] : [])),
  ];
  if (appIds.length === 0) {
    return identities;
  }
  const knownRows = await prisma.externalGameId.findMany({
    where: { namespace: "STEAM_APP", externalId: { in: [...new Set(appIds)] } },
    select: { externalId: true, gameId: true, game: { select: { type: true } } },
  });
  for (const row of knownRows) {
    identities.set(row.externalId, { gameId: row.gameId, type: row.game.type });
  }
  return identities;
}

export async function importSteamGames() {
  // Survives into the catch so a failed mid-run can still schedule enrichment
  // for the chunks that already committed.
  const createdGameIds: string[] = [];
  try {
    await requireUser();

    const context = await requireSteamFlowContext();
    if (!context.ok) {
      return {
        success: false as const,
        data: null,
        error: context.error,
      };
    }

    const games = await fetchOwnedGames(context.steamId64, context.apiKey);
    const orderedGames = [...games].sort(
      (left, right) => Number(left.type === "DLC") - Number(right.type === "DLC"),
    );
    const identities = await loadKnownIdentities(games);

    let imported = 0;
    let updated = 0;
    for (let index = 0; index < orderedGames.length; index += IMPORT_CHUNK_SIZE) {
      const chunk = orderedGames.slice(index, index + IMPORT_CHUNK_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const game of chunk) {
          const outcome = await importGame(tx, identities, game);
          if (outcome.kind === "imported") {
            imported += 1;
            createdGameIds.push(outcome.gameId);
          } else {
            updated += 1;
          }
        }
      });
    }

    await prisma.steamConnection.update({
      where: { id: 1 },
      data: {
        lastSyncAt: new Date(),
        counts: { imported, updated },
      },
    });

    const noRawgQueueWork = { batchId: null, queued: 0, skipped: 0 };
    try {
      const rawgQueue = createdGameIds.length > 0
        ? await queueRawgForImportedGames(createdGameIds)
        : noRawgQueueWork;
      return {
        success: true as const,
        data: {
          imported,
          updated,
          rawgQueue: { status: "QUEUED" as const, ...rawgQueue },
        },
        error: null,
      };
    } catch {
      return {
        success: true as const,
        data: {
          imported,
          updated,
          rawgQueue: { status: "DEFERRED" as const, queued: 0, skipped: 0, batchId: null },
        },
        error: null,
      };
    }
  } catch (err) {
    if (createdGameIds.length > 0) {
      try {
        await queueRawgForImportedGames(createdGameIds);
      } catch {
        // Enrichment scheduling must not mask the original import failure.
      }
    }
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to import Steam games",
    };
  }
}
