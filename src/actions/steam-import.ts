"use server";

import { fetchOwnedGames, type OwnedGame } from "@/lib/steam-api";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { lastPlayedDate } from "@/lib/steam-utils";

async function importGame(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  game: OwnedGame,
): Promise<"imported" | "updated"> {
  const externalId = String(game.appid);
  const existing = await tx.externalGameId.findUnique({
    where: {
      namespace_externalId: {
        namespace: "STEAM_APP",
        externalId,
      },
    },
  });

  const availability = {
    source: "STEAM" as const,
    steamAppId: externalId,
    steamPlaytimeTotal: BigInt(game.playtimeForever),
    steamLastPlayed: lastPlayedDate(game.rtimeLastPlayed),
  };

  if (existing) {
    await tx.gameAvailability.updateMany({
      where: { gameId: existing.gameId, source: "STEAM" },
      data: availability,
    });
    await tx.libraryEntry.upsert({
      where: { gameId: existing.gameId },
      create: { gameId: existing.gameId },
      update: {},
    });
    return "updated";
  }

  await tx.game.create({
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
  });
  return "imported";
}

export async function importSteamGames() {
  try {
    await requireUser();

    const connection = await prisma.steamConnection.findUnique({
      where: { id: 1 },
    });
    if (!connection) {
      return {
        success: false as const,
        data: null,
        error: "Steam account is not connected",
      };
    }

    const apiKey = process.env.STEAM_WEB_API_KEY;
    if (!apiKey) {
      return {
        success: false as const,
        data: null,
        error: "STEAM_WEB_API_KEY is not configured",
      };
    }

    const games = await fetchOwnedGames(connection.steamId64, apiKey);
    const result = await prisma.$transaction(async (tx) => {
      let imported = 0;
      let updated = 0;

      for (const game of games) {
        const outcome = await importGame(tx, game);
        if (outcome === "imported") {
          imported += 1;
        } else {
          updated += 1;
        }
      }

      await tx.steamConnection.update({
        where: { id: 1 },
        data: {
          lastSyncAt: new Date(),
          counts: { imported, updated },
        },
      });

      return { imported, updated };
    });

    return { success: true as const, data: result, error: null };
  } catch (err) {
    return {
      success: false as const,
      data: null,
      error: err instanceof Error ? err.message : "Failed to import Steam games",
    };
  }
}
